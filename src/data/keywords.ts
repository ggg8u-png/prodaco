import liveData from "./keywords.json";
import stagingData from "./keywords-staging.json";
import { galleryItems } from "./gallery";
import type { KeywordEntry } from "./taxonomy";
import seoSettings from "../../content/seo.json";

// CMS(/admin → ⑪ 색인·SEO 설정, content/seo.json)에서 색인 정책을 편집한다.
//  · generateCount        : 생성할 키워드 페이지 수(아래 GENERATE_COUNT 기본값).
//  · autoIndexByGalleryCase: 지역+품목 일치 시공사례가 있으면 자동 색인 승급(기본 on).
//  · extraIndexSlugs       : 사례 없이도 색인을 강제할 슬러그 목록(실제 콘텐츠를 채운 뒤에만 사용).
const seo = seoSettings as {
  generateCount?: number;
  autoIndexByGalleryCase?: boolean;
  allowAiCrawlers?: boolean;
  extraIndexSlugs?: string[];
  noindexTypes?: string[];
};
const AUTO_INDEX_BY_CASE = seo.autoIndexByGalleryCase !== false; // 기본 true
const EXTRA_INDEX_SLUGS = new Set(seo.extraIndexSlugs || []);
// 약한 롱테일 유형은 noindex,follow 로 강등한다(색인 경쟁에서 제외).
//   · 지역+품목(region-item)·지역 허브는 색인 유지(핵심 로컬 페이지).
//   · b2b·synonym·consumer·target·item-tail 등 얇은 템플릿 유형은 색인 제외 →
//     크롤 예산과 품질 신호를 대표(region-item) 페이지에 집중, 도어웨이 신호 완화.
//   · 단, 실제 시공사례(hasRealCase)나 수동 승인(extraIndexSlugs)은 유형과 무관히 색인(오버라이드).
// CMS(content/seo.json)의 noindexTypes 로 조정한다. 빈 배열이면 현행(전체 색인)로 복귀.
const NOINDEX_TYPES = new Set(seo.noindexTypes || []);
// robots.ts 등 다른 모듈이 참조할 수 있도록 AI 크롤러 허용 여부를 노출.
export const allowAiCrawlers: boolean = seo.allowAiCrawlers !== false; // 기본 true

// 큐레이션 라이브 키워드(검수·고가치) — 항상 생성 + 색인 대상.
const live = liveData as KeywordEntry[];

// 단계 추가용 대기 풀(우선순위 정렬). {meta, items} 또는 배열 형태 모두 허용.
const stagingRaw = stagingData as unknown;
const staging: KeywordEntry[] = Array.isArray(stagingRaw)
  ? (stagingRaw as KeywordEntry[])
  : ((stagingRaw as { items?: KeywordEntry[] }).items || []);

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
const liveSlugSet = new Set(live.map((k) => k.slug));
// staging 에서 라이브와 중복되는 슬러그는 제거(라이브 우선).
const stagingUnique = staging.filter((k) => !liveSlugSet.has(k.slug));
// 생성 우선순위 풀: 큐레이션 라이브 → staging(우선순위 정렬).
const orderedPool: KeywordEntry[] = [...live, ...stagingUnique];

function resolveGenerateCount(): number {
  // 우선순위: Netlify 환경변수 GENERATE_COUNT(운영 긴급 오버라이드) >
  //           CMS content/seo.json 의 generateCount > 라이브 수(기본).
  const envRaw = parseInt(process.env.GENERATE_COUNT || "", 10);
  const raw = Number.isFinite(envRaw) && envRaw > 0 ? envRaw : seo.generateCount;
  if (!raw || !Number.isFinite(raw) || raw <= 0) return live.length; // 기본 = 라이브만
  // 라이브 미만 방지(검수 페이지 보호), 풀 초과 방지로 클램프.
  return Math.min(Math.max(raw, live.length), orderedPool.length);
}

const GENERATE_COUNT = resolveGenerateCount();
const keywords: KeywordEntry[] = orderedPool.slice(0, GENERATE_COUNT);

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
    .filter((c) => c.region && c.item)
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
  // ③ 그 외 큐레이션 라이브(region-item 등 핵심 페이지)는 색인
  if (liveSlugSet.has(slug)) return true; // 큐레이션 라이브(검수·고가치)
  return false;
}

export interface IndexDecision {
  index: boolean;
  canonicalSlug: string;
}

// 페이지의 robots(index 여부)와 canonical 슬러그를 한 번에 결정한다.
export function indexDecisionFor(k: KeywordEntry): IndexDecision {
  if (isIndexable(k)) {
    // 라이브: 현행 동작 유지(동의어 꼬리말은 대표 변형으로 canonical).
    return { index: true, canonicalSlug: canonicalSlugFor(k) };
  }
  // 자동 추가(staging): noindex + 상위 지역+품목 base 로 canonical(존재 시).
  const baseSlug = k.region && k.item ? `${k.region}-${k.item}` : null;
  const canonicalSlug = baseSlug && bySlug.has(baseSlug) ? baseSlug : canonicalSlugFor(k);
  return { index: false, canonicalSlug };
}
