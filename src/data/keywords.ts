import liveData from "./keywords.json";
// keywords-staging.json(5.5MB/2.4만개)은 정적 import 하지 않는다 — generateCount 가
// 라이브 수를 초과할 때만 buildKeywords() 안에서 지연 로드한다(콜드스타트 절감).
import { galleryItems } from "./gallery";
import type { KeywordEntry } from "./taxonomy";
import { caseGroupLabelFor } from "@/lib/caseGroups";
import seoSettings from "../../content/seo.json";

// CMS(/admin → ⑪ 색인·SEO 설정, content/seo.json)에서 색인 정책을 편집한다.
//  · generateCount        : 생성할 키워드 페이지 수(아래 GENERATE_COUNT 기본값).
//  · autoIndexByGalleryCase: 지역+품목 일치 시공사례가 있으면 자동 색인 승급(기본 on).
//  · extraIndexSlugs       : 사례 없이도 색인을 강제할 슬러그 목록(실제 콘텐츠를 채운 뒤에만 사용).
//                            ⚠ scripts/seo-index-decision.mjs --write 가 통째로 재생성한다.
//                            사람이 손으로 넣은 값은 다음 실행에서 지워지므로 여기 두지 말 것.
//  · manualIndexSlugs      : 운영자가 직접 승인한 슬러그. 자동 산출이 건드리지 않는 영구 목록.
//                            (2026-07-28 수동 승인 7건이 재생성 시 전부 삭제되는 걸 확인하고 분리)
const seo = seoSettings as {
  generateCount?: number;
  autoIndexByGalleryCase?: boolean;
  extraIndexSlugs?: string[];
  manualIndexSlugs?: string[];
  noindexTypes?: string[];
  requireEvidenceForIndex?: boolean;
};
const AUTO_INDEX_BY_CASE = seo.autoIndexByGalleryCase !== false; // 기본 true
// 자동 산출 허용목록 ∪ 운영자 수동 승인 — 색인 판정은 둘을 합쳐서 본다.
const EXTRA_INDEX_SLUGS = new Set([...(seo.extraIndexSlugs || []), ...(seo.manualIndexSlugs || [])]);
// 약한 롱테일 유형은 noindex,follow 로 강등한다(색인 경쟁에서 제외).
//   · 지역+품목(region-item)·지역 허브는 색인 유지(핵심 로컬 페이지).
//   · b2b·synonym·consumer·target·item-tail 등 얇은 템플릿 유형은 색인 제외 →
//     크롤 예산과 품질 신호를 대표(region-item) 페이지에 집중, 도어웨이 신호 완화.
//   · 단, 실제 시공사례(hasRealCase)나 수동 승인(extraIndexSlugs)은 유형과 무관히 색인(오버라이드).
// CMS(content/seo.json)의 noindexTypes 로 조정한다. 빈 배열이면 현행(전체 색인)로 복귀.
const NOINDEX_TYPES = new Set(seo.noindexTypes || []);

// ─── 증거 게이트(requireEvidenceForIndex) ──────────────────────────────────────
// true 면 "큐레이션 라이브에 있다"는 사실만으로는 색인하지 않는다. 검증된 시공사례
// (hasRealCase) 또는 수동 승인(extraIndexSlugs)에 해당하는 페이지만 색인 대상이다.
//
// 근거(2026-07-27 GSC 실측):
//   · 라이브 표시 Tier A 1,361개 중 실제 색인 139개. 라이브 여부는 색인 근거가 못 된다.
//   · 「크롤링됨 - 현재 색인이 생성되지 않음」 829개와 나머지 Tier A 사이에 본문 길이·
//     FAQ 수·사례 보유율 차이가 없다(1,318자 vs 1,317자 / 2% vs 2%) — 구글이 이미
//     "지역·품목만 바꾼 같은 페이지"로 판정했다는 뜻.
//   · 따라서 색인 유지 근거는 콘텐츠 분량이 아니라 실측 증거(검증 사례·클릭·반복 노출)로 둔다.
//     허용목록은 scripts/seo-index-decision.mjs 가 실측 데이터에서 산출한다.
//
// 안전 방향: 설정이 비거나 깨져도 색인이 늘지 않고 noindex 쪽으로 닫힌다.
// (지역 허브·블로그·코어 정적 페이지는 별도 라우트라 이 게이트의 영향을 받지 않는다.)
const REQUIRE_EVIDENCE = seo.requireEvidenceForIndex === true;

// 큐레이션 라이브 키워드(검수·고가치) — 항상 생성 + 색인 대상.
const live = liveData as KeywordEntry[];
// isIndexable 등에서 참조 — 라이브(1.5천개) 기준이라 상시 상주해도 가볍다.
const liveSlugSet = new Set(live.map((k) => k.slug));

// =============================================================================
// GENERATE_COUNT — "넷리파이에서 숫자만 바꾸면 그 개수만큼 페이지 생성"
// -----------------------------------------------------------------------------
// 클라이언트는 코드를 만지지 않고 Netlify 환경변수 GENERATE_COUNT 숫자만 바꿔
// 빌드 시 생성되는 키워드 페이지 수를 조절한다(예: 1546 → 5000 → 20000).
//
//  · 미설정/0/오류 → 큐레이션 라이브(keywords.json)만 생성 = 현행 동작(가장 안전).
//  · N 설정       → 라이브 + staging(우선순위 순)을 합쳐 앞에서 N개만 생성.
//  · 최소값        → 큐레이션 라이브 수 미만으로는 내려가지 않음(검수 페이지 보호).
//  · 안전장치      → staging 에서 추가된 페이지는 기본 noindex,follow + 상위
//                    지역+품목(base)로 canonical (decideIndexing 참고). 즉 페이지는
//                    생성/크롤되지만 색인 경쟁은 대표 페이지로 모아 도어웨이 패널티를 피한다.
//                    ("2만 생성하되 큐레이션·사례 페이지만 색인"하는 안전 모델)
// =============================================================================
function resolveGenerateCount(): number {
  // 우선순위: Netlify 환경변수 GENERATE_COUNT(운영 긴급 오버라이드) >
  //           CMS content/seo.json 의 generateCount > 라이브 수(기본).
  const envRaw = parseInt(process.env.GENERATE_COUNT || "", 10);
  const raw = Number.isFinite(envRaw) && envRaw > 0 ? envRaw : seo.generateCount;
  if (!raw || !Number.isFinite(raw) || raw <= 0) return live.length; // 기본 = 라이브만
  // 라이브 미만 방지(검수 페이지 보호). 풀 크기 상한은 staging 로드 후 buildKeywords 에서 클램프.
  return Math.max(raw, live.length);
}

const GENERATE_COUNT = resolveGenerateCount();

// 생성 키워드 집합. 라이브만으로 충분하면(기본) staging(5.5MB) 로드를 건너뛰어
// 서버리스 콜드스타트를 줄인다 — 5.5MB JSON 파싱 + 2.4만개 필터를 매 부팅마다 하지 않는다.
// generateCount 를 라이브 수보다 크게 올린 경우에만 staging 풀을 지연 로드한다.
function buildKeywords(): KeywordEntry[] {
  if (GENERATE_COUNT <= live.length) return live;
  // 단계 추가용 대기 풀(우선순위 정렬). {meta, items} 또는 배열 형태 모두 허용.
  // (정적 import 대신 지연 require — 라이브만 생성하는 기본 경로에선 5.5MB 파싱을 건너뛴다.)
  const stagingRaw = require("./keywords-staging.json") as unknown;
  const staging: KeywordEntry[] = Array.isArray(stagingRaw)
    ? (stagingRaw as KeywordEntry[])
    : ((stagingRaw as { items?: KeywordEntry[] }).items || []);
  // staging 에서 라이브와 중복되는 슬러그는 제거(라이브 우선).
  const stagingUnique = staging.filter((k) => !liveSlugSet.has(k.slug));
  // 생성 우선순위 풀: 큐레이션 라이브 → staging(우선순위 정렬).
  const orderedPool: KeywordEntry[] = [...live, ...stagingUnique];
  return orderedPool.slice(0, Math.min(GENERATE_COUNT, orderedPool.length));
}

const keywords: KeywordEntry[] = buildKeywords();

export function getKeywords(): KeywordEntry[] {
  return keywords;
}

// slug 단건 조회용 인덱스 (대용량 배열 선형탐색 방지)
const bySlug = new Map<string, KeywordEntry>(keywords.map((k) => [k.slug, k]));

export function getKeywordBySlug(slug: string): KeywordEntry | undefined {
  return bySlug.get(slug);
}

// ─── 동의어 꼬리말 canonical 통합 ───────────────────────────────────────────────
// 의미가 사실상 같은 꼬리말은 대표 1개로 canonical 을 모아 중복 색인을 줄인다.
// (페이지/URL 은 그대로 두되, 검색엔진에는 대표 URL 만 정식으로 알린다.)
const REPRESENTATIVE_MODIFIER: Record<string, string> = {
  가격: "비용",
  평당가격: "평당비용",
  평당단가: "평당비용",
  추천: "업체추천",
  잘하는곳: "업체추천",
  전문업체: "업체추천",
  순서: "방법",
  폐기물수거: "폐기물처리",
  긴급: "당일",
  빠른: "당일",
};

// region|item|modifier → slug 인덱스 (대표 변형 슬러그를 O(1)로 찾기 위함)
const byRIM = new Map<string, string>(
  keywords.map((k) => [`${k.region || ""}|${k.item || ""}|${k.modifier || ""}`, k.slug])
);

// 해당 키워드의 canonical 슬러그(디코딩 형태)를 돌려준다.
// 동의어 꼬리말이면 대표 변형의 슬러그, 아니면 자기 자신.
export function canonicalSlugFor(k: KeywordEntry): string {
  const rep = k.modifier ? REPRESENTATIVE_MODIFIER[k.modifier] : undefined;
  if (!rep) return k.slug;
  const repSlug = byRIM.get(`${k.region || ""}|${k.item || ""}|${rep}`);
  return repSlug || k.slug;
}

// ─── 실제 시공사례 매칭(자동 index 승급 엔진) ──────────────────────────────────
// "1 시공 = 1 페이지 승급": 지역+품목이 정확히 일치하는 실제 시공사례(사진·후기)가
// 있으면 그 페이지는 고유성이 확보된 것으로 보고 index 로 승급한다.
// (현재 기본 사례는 region="수도권"/일반 품목이라 특정 지역+품목 슬러그와 매칭되지
//  않으므로 오승급이 없다. CMS 로 region+item 을 정확히 태그한 사례를 올리면 그
//  지역+품목 페이지가 자동 index 된다.)
const caseKeys = new Set(
  galleryItems
    // verified:false(미검증) 사례는 자동 색인 승급 근거로 쓰지 않는다 — 지역이 정확히
    // 태그된 '검증된 실제 사례'만 해당 지역+품목 페이지를 승급시킨다.
    .filter((c) => c.region && c.item && c.verified !== false)
    .map((c) => `${c.region}|${c.item}`)
);
function hasRealCase(k: KeywordEntry): boolean {
  return !!(k.region && k.item && caseKeys.has(`${k.region}|${k.item}`));
}

// ─── 색인 게이트 ────────────────────────────────────────────────────────────────
// 큐레이션 라이브(keywords.json)에 있거나, 지역+품목이 일치하는 실제 사례를 가진
// 페이지만 index. GENERATE_COUNT 로 자동 추가된 나머지 staging 페이지는 noindex,follow
// + 상위 지역+품목(base)로 canonical → 중복/도어웨이 패널티를 피한다.
export function isIndexable(k: KeywordEntry | string): boolean {
  const entry = typeof k === "string" ? bySlug.get(k) : k;
  const slug = typeof k === "string" ? k : k.slug;
  // ① 오버라이드(유형과 무관히 항상 색인): 수동 승인 슬러그 · 실제 시공사례 보유
  if (EXTRA_INDEX_SLUGS.has(slug)) return true; // CMS 에서 수동 승인한 슬러그
  if (AUTO_INDEX_BY_CASE && entry && hasRealCase(entry)) return true; // 실제 사례 보유 → 자동 승급
  // ② 약한 롱테일 유형(b2b·synonym·tail 등)은 라이브라도 색인 제외 → noindex,follow
  if (entry && NOINDEX_TYPES.has(String(entry.type))) return false;
  // ③ 증거 게이트가 켜져 있으면 여기서 닫는다 — ①을 통과하지 못한 페이지는 색인하지 않는다.
  if (REQUIRE_EVIDENCE) return false;
  // ④ 그 외 큐레이션 라이브(region-item 등 핵심 페이지)는 색인
  if (liveSlugSet.has(slug)) return true; // 큐레이션 라이브(검수·고가치)
  return false;
}

// ─── 지역 허브 색인 티어 ────────────────────────────────────────────────────────
// 65개 허브를 전부 색인하던 구조를 버리고 실측 지표로 나눈다.
//
// 왜: 빌드 산출물 실측에서 허브끼리 본문 유사도가 54~72%(중앙값 61%)였다. 그런데
//     허브를 가르는 지표를 전부 뽑아 보니 사실상 하나뿐이었다 —
//       본문 단어수 576~632 · outbound 품목링크 전부 8 · inbound 19~32 · 하위 총개수 18~22
//       → 전부 평평하다(구조가 같으니 당연하다).
//       색인 가능한 하위 페이지 수(childIndexable)만 0~6 으로 갈린다.
//     분포: 0개 20곳 · 1개 26곳 · 2개 12곳 · 3개 2곳 · 4개 1곳 · 5개 3곳 · 6개 1곳
//
// 임계값을 2로 둔 이유:
//   · 하위 색인 페이지가 0~1개면 "허브"가 아니다. 모을 게 없고, 그 1개는 혼자서도
//     같은 질의로 순위를 잡는다 — 허브는 동일 질의의 근접중복 경쟁자만 하나 더 만든다.
//   · 2개 이상부터 실제로 여러 목적지를 모으는 집약 페이지가 된다.
//   · 유사도(54~72%)는 연속 분포라 자연스러운 절단점이 없어 기준으로 못 쓴다.
//     childIndexable 만 이산적인 군집을 가진다.
//
// 예외 두 가지는 숫자보다 우선한다(둘 다 구조 파손 방지):
//   ① 광역 루트(서울·경기·인천·수도권) — 홈에서 직접 링크되는 진입점이자 하위 지역의
//      상위 개념. 하위 색인 페이지 수와 무관하게 유지한다.
//   ② canonical 수렴 대상 — 어떤 색인 페이지가 이 허브를 canonical 로 지목하고 있으면
//      허브를 noindex 로 내릴 수 없다(indexDecisionFor 불변식 ①: canonical 대상은
//      반드시 색인 가능해야 한다). 실제로 /services/영등포 가 여기 해당한다.
export type HubTier = "INDEX" | "SUPPORT";

/** 홈에서 직접 링크되는 광역 루트 — 하위 개념을 담는 구조적 진입점. */
const BROAD_HUB_REGIONS = new Set(["서울", "경기", "인천", "수도권"]);

/** 허브 판정 임계값 — 위 분포 근거. 바꾸면 seo-tests 의 허브 게이트가 같이 움직인다. */
export const HUB_INDEX_MIN_CHILDREN = 2;

/**
 * 그 지역에서 '독립적으로' 색인되는 지역×품목 페이지 수.
 * 사이트맵 포함 기준과 같게 센다 — index + self-canonical.
 * 총칭 품목(바닥재철거·바닥철거)은 canonical 이 이 허브로 수렴하므로 하위가 아니라
 * 허브 자신의 일부다. 세면 자기 자신을 근거로 자기를 승격시키는 셈이라 제외한다.
 */
function indexableChildCount(region: string): number {
  let n = 0;
  for (const k of getKeywords()) {
    if (k.type !== "region-item" || k.region !== region || !k.item) continue;
    if (GENERIC_HUB_ITEMS.has(k.item)) continue;
    const d = indexDecisionFor(k);
    if (d.index && d.canonicalSlug === k.slug) n++;
  }
  return n;
}

export interface HubDecision {
  tier: HubTier;
  index: boolean;
  inSitemap: boolean;
  reasons: string[];
  indexableChildren: number;
}

const hubDecisionCache = new Map<string, HubDecision>();

export function hubDecisionFor(region: string): HubDecision {
  const hit = hubDecisionCache.get(region);
  if (hit) return hit;
  const indexableChildren = indexableChildCount(region);
  const reasons: string[] = [];
  let tier: HubTier = "SUPPORT";

  if (BROAD_HUB_REGIONS.has(region)) {
    tier = "INDEX";
    reasons.push("광역 루트 — 홈에서 직접 링크되는 구조적 진입점");
  } else if (rendersLocalCases(region)) {
    tier = "INDEX";
    reasons.push("검증 시공사례가 그 지역(또는 권역) 사례로 실제 렌더 — 다른 허브에 없는 고유 콘텐츠");
  } else if (isHubCanonicalTarget(region)) {
    tier = "INDEX";
    reasons.push("canonical 수렴 대상 — 색인 페이지가 이 허브를 canonical 로 지목(불변식 ①)");
  } else if (indexableChildren >= HUB_INDEX_MIN_CHILDREN) {
    tier = "INDEX";
    reasons.push(`색인 가능한 하위 지역×품목 ${indexableChildren}개(임계 ${HUB_INDEX_MIN_CHILDREN})`);
  } else {
    reasons.push(
      `색인 가능한 하위 페이지 ${indexableChildren}개 — 모을 대상이 없어 독립 색인 가치 부족. noindex,follow 로 탐색·크롤 허브 역할만 유지`
    );
  }
  const out: HubDecision = { tier, index: tier === "INDEX", inSitemap: tier === "INDEX", reasons, indexableChildren };
  hubDecisionCache.set(region, out);
  return out;
}

/**
 * 그 허브가 화면에 '지역(권역) 시공사례'로 실제 렌더하는가.
 *
 * 허브 페이지의 판정과 정확히 같은 기준을 쓴다 — 지역 사례 2건 이상이면 지역 사례로,
 * 아니면 권역 그룹 사례가 있을 때 권역 사례로 표기하고, 둘 다 없으면 "수도권 유사 사례"다.
 * 사례 1건짜리 지역을 승격시키지 않는 이유가 여기 있다: 화면에는 지역 사례로 안 나오므로
 * 그 허브만의 고유 콘텐츠가 아니다. 실제로 렌더되는 것만 색인 근거로 인정한다.
 */
function rendersLocalCases(region: string): boolean {
  const verified = galleryItems.filter((c) => c.region && c.verified !== false);
  if (verified.filter((c) => c.region === region).length >= 2) return true;
  const group = caseGroupLabelFor(region);
  return !!group && verified.some((c) => c.region === group);
}

/** 이 허브를 canonical 로 지목하는 색인 페이지가 있는가(순환 없이 직접 판정). */
function isHubCanonicalTarget(region: string): boolean {
  for (const k of getKeywords()) {
    if (k.type !== "region-item" || k.region !== region || !k.item) continue;
    if (!GENERIC_HUB_ITEMS.has(k.item)) continue;
    if (isIndexable(k)) return true;
  }
  return false;
}

// ─── 지역 허브 canonical(카니발라이제이션 해소) ─────────────────────────────────
// "{지역}-바닥재철거"·"{지역}-바닥철거"는 지역 허브(/services/{지역})와 검색 의도가
// 완전히 겹친다(둘 다 "지역 바닥(재) 철거 업체·안내"). 같은 의도를 두 URL이 경쟁하면
// 색인·랭킹이 분산되므로, 이 조합은 허브를 canonical 로 지정하고 사이트맵에서 제외한다.
//  · 선택지 검토: 301(URL 삭제·링크 파손 위험) vs 의도 분리(불가 — 실제로 같은 의도)
//    vs 허브 canonical(URL·본문 유지, 신호만 허브로 집약) → 세 번째가 가장 보수적.
//  · 페이지 자체는 그대로 서빙(200)되고 robots 도 index 유지 — canonical 이 집약을 담당.
const GENERIC_HUB_ITEMS = new Set(["바닥재철거", "바닥철거"]);
export function hubCanonicalRegionFor(k: KeywordEntry): string | null {
  if (k.type !== "region-item" || !k.region || !k.item) return null;
  if (!GENERIC_HUB_ITEMS.has(k.item)) return null;
  // 색인 대상일 때만 허브 canonical 을 쓴다. 강등(noindex) 페이지는 self-canonical 이어야
  // 하므로(indexDecisionFor 불변식 ②) 여기서 제외한다.
  return isIndexable(k) ? k.region : null;
}

export interface IndexDecision {
  index: boolean;
  canonicalSlug: string;
}

// 페이지의 robots(index 여부)와 canonical 슬러그를 한 번에 결정한다.
//
// canonical 불변식(둘 다 GSC 에서 "대체 페이지" 오류를 만든다):
//   ① canonical 대상은 반드시 색인 가능한 URL 이어야 한다 — 강등된 URL 을 canonical 로
//      지목하면 canonical→noindex 모순이 된다.
//   ② noindex 페이지는 self-canonical 을 유지한다 — noindex 와 "다른 URL 로의 canonical"을
//      함께 내보내면 구글이 noindex 를 canonical 대상까지 옮겨 적용할 수 있다(허브 오염 위험).
//      신호 통합은 canonical 이 아니라 follow + 내부링크로 처리한다.
export function indexDecisionFor(k: KeywordEntry): IndexDecision {
  if (isIndexable(k)) {
    // 동의어 꼬리말은 대표 변형으로 canonical 통합하되, 대표 변형이 강등됐으면
    // self-canonical 로 되돌린다(불변식 ①).
    const rep = canonicalSlugFor(k);
    const repEntry = rep !== k.slug ? bySlug.get(rep) : undefined;
    return { index: true, canonicalSlug: repEntry && isIndexable(repEntry) ? rep : k.slug };
  }
  // 강등 페이지: noindex,follow + self-canonical (불변식 ②).
  return { index: false, canonicalSlug: k.slug };
}
