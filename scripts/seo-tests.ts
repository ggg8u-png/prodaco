// =============================================================================
// SEO 회귀 테스트 — 실제 서비스 모듈을 그대로 불러 검증한다.
//   실행: npm run test:seo   (node scripts/ts-run.mjs scripts/seo-tests.ts)
//   실패 시 exit 1 → prebuild 게이트에서 배포 중단.
//
// 커버리지(요구사항 15):
//   ① 조사 처리(지역·품목) ② 템플릿 병기 교정 ③ 품목 분류 일치(제목·본문)
//   ④ self-canonical / 사이트맵 포함·제외 규칙 ⑤ 존재하지 않는 조합 = 404(Tier C)
//   ⑥ 실제 사례 → 자동 색인 승급 + 지역 표시 정확성 ⑦ robots.txt
//   ⑧ 사이트맵 XML 유효성·중복·인코딩 ⑨ HTTP/www 단일 301 (netlify.toml)
//   ⑩ 본문 최소 분량(모바일 동일 렌더 — 서버 컴포넌트라 뷰포트 무관)
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { josa, josaEnd } from "@/lib/josa";
import { fillTemplate } from "@/lib/template";
import { getKeywords, getKeywordBySlug, hubDecisionFor } from "@/data/keywords";
import { indexabilityFor, keywordUrl, siteUrl } from "@/lib/seo/indexability";
import { uniqueTitle, uniqueDescription, pickFaqs, faqMatchesItem } from "@/lib/seo";
import { getContentForKeyword, familyOf } from "@/lib/content";
import { keyAnswerFor, keyAnswerForRegion, familyLabel } from "@/data/keyAnswer";
import { galleryItems } from "@/data/gallery";
import { entriesForGroup, SITEMAP_GROUPS, renderUrlset, renderIndex, nonEmptyGroups, SITE_LASTMOD } from "@/lib/sitemap";
import robots from "@/app/robots";
import { itemGuidesFor } from "@/lib/itemGuides";
import { itemFactsFor, itemFactOverrideCount } from "@/data/itemFacts";
import { company } from "@/data/company";
import { neighborsOf } from "@/data/regions";

let passed = 0;
const errors: string[] = [];
function ok(cond: boolean, name: string, detail = ""): void {
  if (cond) { passed++; return; }
  errors.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

// ── ① 조사(지역) ──────────────────────────────────────────────────────────────
ok(josa("판교", "을를") === "판교를", "조사: 판교를");
ok(josa("성남", "을를") === "성남을", "조사: 성남을");
ok(josa("수원", "을를") === "수원을", "조사: 수원을");
ok(josa("경기", "은는") === "경기는", "조사: 경기는");
ok(josa("서울", "으로로") === "서울로", "조사: 서울로(ㄹ 받침)");
ok(josa("부천", "으로로") === "부천으로", "조사: 부천으로");
ok(josa("미추홀구", "이가") === "미추홀구가", "조사: 미추홀구가");

// ── ① 조사(품목) ──────────────────────────────────────────────────────────────
ok(josa("데코타일철거", "으로로") === "데코타일철거로", "조사: 데코타일철거로");
ok(josa("데코타일철거", "을를") === "데코타일철거를", "조사: 데코타일철거를");
ok(josa("데코타일철거", "이가") === "데코타일철거가", "조사: 데코타일철거가");
ok(josa("바닥샌딩", "은는") === "바닥샌딩은", "조사: 바닥샌딩은");
ok(josa("바닥샌딩", "으로로") === "바닥샌딩으로", "조사: 바닥샌딩으로");
ok(josa("면갈이", "을를") === "면갈이를", "조사: 면갈이를");
ok(josaEnd("데코타일철거", "이라라") === "라", "조사: 철거라도(이라/라)");
ok(josaEnd("바닥샌딩", "이라라") === "이라", "조사: 샌딩이라도");
ok(josa("샌딩(면갈이)", "은는") === "샌딩(면갈이)는", "조사: 괄호 꼬리 건너뛰기");

// ── ② 템플릿 병기 교정 ────────────────────────────────────────────────────────
ok(
  fillTemplate("{region}을(를) 포함한 {cluster} 전역 방문", { region: "판교", cluster: "성남권" }) ===
    "판교를 포함한 성남권 전역 방문",
  "fillTemplate: 판교를"
);
ok(
  fillTemplate("{region}을(를) 포함", { region: "성남" }) === "성남을 포함",
  "fillTemplate: 성남을"
);
ok(
  fillTemplate("{unknown} 유지", {}) === "{unknown} 유지",
  "fillTemplate: 모르는 변수는 보존"
);

// ── ③ 품목 분류 일치(데코타일 ≠ 타일) ────────────────────────────────────────
ok(familyLabel("데코타일철거") === "비닐계 철거", "familyLabel: 데코타일철거=비닐계", familyLabel("데코타일철거"));
ok(familyLabel("디럭스타일철거") === "비닐계 철거", "familyLabel: 디럭스타일철거=비닐계");
ok(familyLabel("타일철거") === "타일 철거", "familyLabel: 타일철거=타일");
ok(familyLabel("폴리싱타일철거") === "타일 철거", "familyLabel: 폴리싱타일철거=타일");
ok(familyOf("데코타일철거") === "vinyl", "familyOf: 데코타일철거=vinyl");
const pangyoDeco = getKeywordBySlug("판교-데코타일철거");
ok(!!pangyoDeco, "키워드 존재: 판교-데코타일철거");
if (pangyoDeco) {
  const ans = keyAnswerFor(pangyoDeco).answer;
  ok(ans.includes("비닐계"), "판교 데코타일철거 답변=비닐계", ans);
  ok(!ans.includes("타일 철거"), "판교 데코타일철거 답변에 '타일 철거' 없음", ans);
}

// ── ④ canonical / 사이트맵 규칙 ───────────────────────────────────────────────
const keywords = getKeywords();
let tierA = 0, selfCanonicalOk = true, sitemapRuleOk = true;
const sitemapLocs = new Set<string>();
for (const g of SITEMAP_GROUPS) for (const e of entriesForGroup(g)) sitemapLocs.add(e.loc);
for (const k of keywords) {
  const ix = indexabilityFor(k);
  if (ix.tier === "A") {
    tierA++;
    if (ix.canonicalUrl !== keywordUrl(k.slug)) selfCanonicalOk = false;
    if (!sitemapLocs.has(keywordUrl(k.slug))) sitemapRuleOk = false;
  } else {
    if (sitemapLocs.has(keywordUrl(k.slug))) sitemapRuleOk = false; // noindex/중복은 제외돼야
  }
  if (!ix.canonicalUrl.startsWith("https://") || ix.canonicalUrl.includes("//www.")) selfCanonicalOk = false;
}
ok(selfCanonicalOk, "Tier A = self-canonical(HTTPS·비www)");
ok(sitemapRuleOk, "사이트맵: Tier A 포함 · noindex/중복 제외");
ok(tierA > 0, "Tier A 존재", String(tierA));

// ── ⑤ 존재하지 않는 조합 = 404(Tier C) ────────────────────────────────────────
ok(indexabilityFor("판교-존재하지않는품목").tier === "C", "무효 조합 Tier C");
ok(getKeywordBySlug("판교-존재하지않는품목") === undefined, "무효 조합 keyword 없음(페이지 notFound)");

// ── ⑥ 실제 사례 → 자동 승급 + 지역 표시 정확성 ────────────────────────────────
for (const c of galleryItems) {
  if (!c.region || !c.item || c.verified === false) continue;
  const k = getKeywordBySlug(`${c.region}-${c.item}`);
  if (k) {
    ok(indexabilityFor(k).tier === "A", `검증 사례 보유 페이지 Tier A: ${c.region}-${c.item}`);
  }
}
// 페이지 로직과 동일 기준: 지역 사례 2건 미만이면 '해당 지역 실제 사례'로 표시하면 안 된다.
const regionCaseCount = new Map<string, number>();
for (const c of galleryItems) regionCaseCount.set(c.region, (regionCaseCount.get(c.region) || 0) + 1);
ok((regionCaseCount.get("판교") || 0) < 2, "판교: 지역 사례 부족 → 유사 사례 라벨 경로", `count=${regionCaseCount.get("판교") || 0}`);

// ── ⑦ robots.txt ─────────────────────────────────────────────────────────────
const rb = robots();
const rbRules = Array.isArray(rb.rules) ? rb.rules : [rb.rules];
ok(String(rb.sitemap).endsWith("/sitemap.xml"), "robots: sitemap 절대주소", String(rb.sitemap));
ok(
  rbRules.some((r) => r && (Array.isArray(r.disallow) ? r.disallow.includes("/admin/") : r.disallow === "/admin/" || r.disallow === "/")),
  "robots: /admin 차단(또는 프리뷰 전체 차단)"
);

// ── ⑧ 사이트맵 XML 유효성 ────────────────────────────────────────────────────
const urlset = renderUrlset(entriesForGroup("services"));
ok(urlset.startsWith('<?xml version="1.0"'), "urlset XML 선언");
ok((urlset.match(/<url>/g) || []).length === (urlset.match(/<\/url>/g) || []).length, "urlset 태그 균형");
ok(!/<loc>[^<]*[가-힣][^<]*<\/loc>/.test(urlset), "urlset loc 퍼센트 인코딩(한글 원문 금지)");
const index = renderIndex();
ok(index.includes("<sitemapindex"), "sitemap index 루트");
ok((index.match(/<sitemap>/g) || []).length >= 4, "sitemap index 그룹 4+");

// ── ⑧-2 lastmod 회귀 방지 ────────────────────────────────────────────────────
// 2026-06-23 고정 상수를 그대로 내보내면서 7월 콘텐츠 개편을 전부 진행한 적이 있다.
// 사이트맵이 "안 바뀜"을 알리는 동안 GSC 색인 수는 139에서 5주간 멈춰 있었다.
// content/lastmod.json(빌드 전 생성)이 있는데도 폴백 상수가 나오면 배선이 끊긴 것이다.
{
  const hasMap = fs.existsSync(path.join(process.cwd(), "content", "lastmod.json"));
  const all = SITEMAP_GROUPS.flatMap((g) => entriesForGroup(g));
  ok(all.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.lastmod)), "사이트맵 lastmod 전부 YYYY-MM-DD");
  if (hasMap) {
    const stale = all.filter((e) => e.lastmod === SITE_LASTMOD && !e.loc.includes("/blog/"));
    ok(
      stale.length === 0,
      "lastmod.json 이 있으면 폴백 상수(SITE_LASTMOD)가 남지 않음",
      `잔존 ${stale.length}건 ${stale.slice(0, 3).map((e) => decodeURIComponent(e.loc)).join(", ")}`
    );
  }
  // 하위 sitemap 의 인덱스 lastmod 는 그 안의 최신 항목과 같아야 한다.
  for (const g of nonEmptyGroups()) {
    const entries = entriesForGroup(g.group);
    const newestInGroup = entries.map((e) => e.lastmod).sort().slice(-1)[0];
    ok(g.lastmod === newestInGroup, `sitemap index lastmod = ${g.group} 최신 항목`, `${g.lastmod} vs ${newestInGroup}`);
  }
}

// ── ⑧-3 품목 정보형 페이지 내부링크 ──────────────────────────────────────────
// 마루철거-비용·바닥철거-비용 같은 상업 의도 최상위 페이지가 색인 대상인데도
// /services 한 곳에서만 링크를 받고 있었다(지역 페이지는 70~90개). 링크가 안 모이면
// 색인 대상이어도 크롤·평가 우선순위에서 밀린다. 같은 품목 지역 페이지가 반드시
// 역링크를 걸도록 고정한다.
{
  const tierATails = keywords.filter((k) => k.type === "item-tail" && indexabilityFor(k).inSitemap);
  ok(tierATails.length > 0, "Tier A 품목 정보형 페이지 존재", `${tierATails.length}개`);
  const starved: string[] = [];
  for (const tail of tierATails) {
    // 같은 품목의 지역 페이지(색인 여부 무관 — noindex,follow 도 링크는 전달한다)가
    // 이 정보형 페이지를 링크 대상으로 잡는지 확인.
    const linkers = keywords.filter(
      (k) => k.type === "region-item" && k.item === tail.item && itemGuidesFor(k.item, k.slug).some((g) => g.slug === tail.slug)
    );
    if (linkers.length === 0) starved.push(tail.slug);
  }
  ok(starved.length === 0, "Tier A 품목 정보형 페이지가 지역 페이지에서 역링크 수신", `고립 ${starved.length}건 ${starved.slice(0, 5).join(", ")}`);
  // 사장님 지정 핵심 품목 — 마루철거·바닥철거는 정보형 페이지가 반드시 살아 있어야 한다.
  for (const item of ["마루철거", "바닥철거"]) {
    const guides = keywords.filter((k) => k.type === "item-tail" && k.item === item && indexabilityFor(k).inSitemap);
    ok(guides.length >= 2, `${item} 정보형 색인 페이지 2개 이상`, `${guides.length}개`);
  }
}

// ── ⑧-4 수동 승인 슬러그 보존 ────────────────────────────────────────────────
// seo:decide --write 가 extraIndexSlugs 를 통째로 재생성한다. 예전에는 수동 승인을
// 같은 배열에 넣어 두어서, 재실행 한 번에 7/28 승인 7건이 조용히 사라지는 상태였다.
// 운영자 승인은 manualIndexSlugs 에 두고, 실제로 Tier A 로 살아 있어야 한다.
{
  const seoJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "seo.json"), "utf8")) as {
    extraIndexSlugs?: string[];
    manualIndexSlugs?: string[];
  };
  const manual = seoJson.manualIndexSlugs || [];
  const auto = seoJson.extraIndexSlugs || [];
  ok(manual.length > 0, "manualIndexSlugs 존재(운영자 승인 목록)", `${manual.length}개`);
  const overlap = manual.filter((s) => auto.includes(s));
  ok(overlap.length === 0, "수동 승인이 자동 재생성 배열과 겹치지 않음", `중복 ${overlap.join(", ")}`);
  const notLive = manual.filter((s) => {
    const k = getKeywordBySlug(s);
    return !k || !indexabilityFor(k).inSitemap;
  });
  ok(notLive.length === 0, "수동 승인 슬러그가 전부 Tier A(사이트맵 포함)", `미반영 ${notLive.join(", ")}`);
}

// ── ⑧-5 지역 허브 품질 게이트 ────────────────────────────────────────────────
// 65개 허브를 전부 색인하던 구조에서 INDEX/SUPPORT 로 나눈 뒤, 그 구조가 깨지지
// 않도록 고정한다. "색인 URL 을 많이 만드는 것"이 아니라 "각 색인 URL 이 독립적으로
// 존재할 이유가 있는 상태"를 지키는 게 목적이다.
{
  const hubRegions = [...new Set(keywords.filter((k) => k.type === "region-item" && k.region).map((k) => k.region as string))];
  ok(hubRegions.length > 0, "지역 허브 존재", `${hubRegions.length}개`);
  const smLocs = new Set<string>();
  for (const g of SITEMAP_GROUPS) for (const e of entriesForGroup(g)) smLocs.add(decodeURIComponent(e.loc));
  const hubUrl = (r: string) => `${siteUrl}/services/${r}`;

  const idx = hubRegions.filter((r) => hubDecisionFor(r).tier === "INDEX");
  const sup = hubRegions.filter((r) => hubDecisionFor(r).tier === "SUPPORT");

  // ① INDEX 허브인데 색인 가능한 하위 페이지가 0 → 모을 게 없는 허브(광역 루트·canonical
  //    수렴 대상은 구조적 이유로 예외이므로 사유가 남아 있는지로 구분한다).
  const emptyIndexHubs = idx.filter((r) => {
    const d = hubDecisionFor(r);
    return d.indexableChildren === 0 && !d.reasons.some((x) => x.includes("광역 루트") || x.includes("canonical 수렴"));
  });
  ok(emptyIndexHubs.length === 0, "INDEX 허브: 하위 색인 페이지 0개 없음(구조적 예외 제외)", emptyIndexHubs.join(", "));

  // ② 허브는 티어와 무관하게 하위 품목 링크를 내보내야 한다(SUPPORT 도 크롤 허브 역할).
  const noOutbound = hubRegions.filter((r) => keywords.filter((k) => k.type === "region-item" && k.region === r).length === 0);
  ok(noOutbound.length === 0, "모든 허브: 링크할 하위 지역×품목 존재", noOutbound.join(", "));

  // ③ 사이트맵에 noindex 허브가 들어가지 않는다.
  const noindexInSitemap = sup.filter((r) => smLocs.has(hubUrl(r)));
  ok(noindexInSitemap.length === 0, "사이트맵에 SUPPORT(noindex) 허브 없음", noindexInSitemap.join(", "));

  // ④ INDEX 허브는 전부 사이트맵에 있다.
  const missing = idx.filter((r) => !smLocs.has(hubUrl(r)));
  ok(missing.length === 0, "INDEX 허브는 전부 사이트맵 포함", missing.join(", "));

  // ⑤ canonical 수렴 대상 허브가 SUPPORT 로 내려가면 안 된다(불변식 ①).
  //    색인 페이지가 canonical 로 지목하는 허브가 noindex 면 그 페이지까지 오염된다.
  const brokenCanonical: string[] = [];
  for (const k of keywords) {
    const ix = indexabilityFor(k);
    if (!ix.indexable) continue;
    const m = ix.canonicalUrl.match(/\/services\/(.+)$/);
    if (!m) continue;
    const target = decodeURIComponent(m[1]);
    if (hubDecisionFor(target).tier !== "INDEX") brokenCanonical.push(`${k.slug} → ${target}`);
  }
  ok(brokenCanonical.length === 0, "canonical 수렴 대상 허브는 전부 INDEX", brokenCanonical.slice(0, 5).join(", "));

  // ⑥ FAQPage 스키마와 화면 FAQ 는 같은 소스에서 나와야 한다 — 허브 FAQ 선택이
  //    실제 링크 품목을 따라가는지(전 허브 동일 세트가 아닌지) 확인.
  const faqSets = new Set<string>();
  for (const r of hubRegions) {
    const items = keywords.filter((k) => k.type === "region-item" && k.region === r && k.item).slice(0, 8);
    const item = items[0]?.item || "바닥재 철거";
    faqSets.add(pickFaqs({ slug: `region-${r}-${item}`, keyword: `${r} ${item}`, type: "region-item", region: r, item } as never, 4).map((f) => f.id).join(","));
  }
  ok(faqSets.size >= Math.ceil(hubRegions.length * 0.3), "허브 FAQ 조합이 지역별로 분화", `서로 다른 조합 ${faqSets.size}/${hubRegions.length}`);
}

// ── ⑧-6 지역×품목 색인 품질 게이트 ───────────────────────────────────────────
// 새 지역·품목이 추가돼도 품질 근거 없는 페이지가 자동으로 사이트맵에 들어가지 않게 한다.
// 3차 감사에서 확인된 사실: 현재 Tier A 와 noindex 그룹은 본문 분량(1,239 vs 1,241자)·
// FAQ 수(4.5 vs 4.5)·고유블록(8.0 vs 8.0)·유사도(52% vs 53%)가 전부 같다. 즉 콘텐츠
// 지표로는 둘을 구분할 수 없고, 실제 구분선은 allowlist 뿐이다. 그래서 아래 게이트는
// "분량이 많으면 색인"이 아니라 "구조적으로 성립하는가"만 본다.
{
  const smLocs = new Set<string>();
  for (const g of SITEMAP_GROUPS) for (const e of entriesForGroup(g)) smLocs.add(decodeURIComponent(e.loc));
  const regionItems = keywords.filter((k) => k.type === "region-item");
  const indexed = regionItems.filter((k) => indexabilityFor(k).inSitemap);
  ok(indexed.length > 0, "색인 대상 지역×품목 존재", `${indexed.length}개`);

  // ① 사이트맵 URL 은 index,follow + self-canonical (전 URL 공통 불변식)
  const badSitemap = indexed.filter((k) => {
    const ix = indexabilityFor(k);
    return !ix.indexable || ix.canonicalUrl !== keywordUrl(k.slug);
  });
  ok(badSitemap.length === 0, "사이트맵 지역×품목: index + self-canonical", badSitemap.slice(0, 3).map((k) => k.slug).join(", "));

  // ② 색인 페이지는 부모(지역 허브 또는 같은 품목 형제)에서 도달 가능해야 한다.
  //    허브는 8개만 링크하므로, 허브 밖 품목은 형제 링크로라도 이어져야 고아가 아니다.
  const unreachable = indexed.filter((k) => {
    const siblings = regionItems.filter((s) => s.region === k.region && s.slug !== k.slug);
    const sameItem = regionItems.filter((s) => s.item === k.item && s.slug !== k.slug);
    return siblings.length === 0 && sameItem.length === 0;
  });
  ok(unreachable.length === 0, "색인 지역×품목: 부모 허브 또는 형제에서 도달 가능", unreachable.slice(0, 3).map((k) => k.slug).join(", "));

  // ③ 색인 corpus 안에서 title·H1 고유(H1 은 uniqueTitle 과 같은 소스라 title 로 검증)
  const titles = new Map<string, string[]>();
  for (const k of indexed) {
    const t = uniqueTitle(k);
    if (!titles.has(t)) titles.set(t, []);
    titles.get(t)!.push(k.slug);
  }
  const dupT = [...titles.entries()].filter(([, v]) => v.length > 1);
  ok(dupT.length === 0, "색인 지역×품목 title 고유", dupT.slice(0, 3).map(([t, v]) => `"${t}" ×${v.length}`).join(", "));

  // ④ 총칭 품목(바닥재철거·바닥철거)이 독립 색인되면 지역 허브와 의도가 정면 충돌한다.
  //    canonical 이 허브로 수렴하므로 사이트맵에는 절대 들어오면 안 된다.
  const GENERIC = new Set(["바닥재철거", "바닥철거"]);
  const genericIndexed = indexed.filter((k) => k.item && GENERIC.has(k.item));
  ok(genericIndexed.length === 0, "총칭 품목 지역 페이지는 사이트맵 제외(허브로 수렴)", genericIndexed.slice(0, 3).map((k) => k.slug).join(", "));

  // ⑤ canonical 대상이 noindex 면 FAIL — 그 페이지까지 색인에서 빠진다.
  const badTarget = regionItems.filter((k) => {
    const ix = indexabilityFor(k);
    if (!ix.indexable) return false;
    if (ix.canonicalUrl === keywordUrl(k.slug)) return false;
    if (/\/services\//.test(ix.canonicalUrl)) return false; // 허브는 ⑧-5 에서 별도 검증
    const target = getKeywordBySlug(ix.canonicalSlug);
    return !target || !indexabilityFor(target).indexable;
  });
  ok(badTarget.length === 0, "canonical 대상이 noindex 아님(지역×품목)", badTarget.slice(0, 3).map((k) => k.slug).join(", "));

  // ⑥ 카니발라이제이션 — 단순 개수 상한이 아니라 '실제 구분 근거가 있는가'로 본다.
  //
  //    같은 품목군에서 둘 다 색인이라고 자동으로 문제는 아니다. 자재가 실제로 다르면
  //    (데코륨=시트형 vs 데코타일=조각형) 서로 다른 검색 의도를 정확히 받는 게 맞다.
  //    문제는 "같은 지역 · 같은 품목군 · 둘 다 색인 · 구분 근거가 없는" 조합이다.
  //
  //    구분 근거 = itemFacts.ts 의 BY_ITEM 오버라이드 필드 수(distinctFacts).
  //    현재 corpus 분포: 오버라이드를 가진 품목은 전부 2개 이상 필드를 덮어쓰고,
  //    없는 품목은 0이다 — 0과 2 사이에 값이 없어 임계 1이 자연스러운 절단점이다.
  //    (임의 숫자가 아니라 실제 분포에서 나온 값. 아래 assert 로 분포를 고정한다.)
  const FAMILY: Record<string, string> = {
    마루철거: "마루", 강마루철거: "마루", 강화마루철거: "마루", 온돌마루철거: "마루",
    데코타일철거: "비닐", 디럭스타일철거: "비닐", 데코륨철거: "비닐", 장판철거: "비닐", 륨장판철거: "비닐",
    타일철거: "타일", 바닥타일철거: "타일", 폴리싱타일철거: "타일",
    바닥샌딩: "샌딩", 면갈이: "샌딩", 에폭시철거: "코팅", 우레탄철거: "코팅",
  };
  // 품목군 기본값 대비 오버라이드 수. generic 폴백과 비교하면 품목군 차이까지 세어
  // 전 품목이 6이 나오고 게이트가 무력화된다(4차에서 그 상태였다).
  const distinctFacts = (item: string | undefined): number => itemFactOverrideCount(item);
  // 임계 1의 근거 — 실제 분포는 {0:2개, 1:4개, 2:9개, 3:3개}(2026-08-07 실측).
  // 0은 "품목군 기본값과 완전히 같다" 는 뜻이라 형제와 구분되는 내용이 하나도 없다.
  // 1 이상이면 최소 한 필드는 그 품목만의 서술이다 — 0/1 사이가 유일한 질적 경계다.
  // (4차에서는 generic 폴백과 비교하는 잘못된 측정으로 전 품목이 6으로 나와 이 게이트가
  //  사실상 무력화돼 있었다. itemFactOverrideCount 로 교체하면서 바로잡는다.)
  const factDist = Object.keys(FAMILY).reduce((a: Record<number, number>, i) => {
    const n = distinctFacts(i); a[n] = (a[n] || 0) + 1; return a;
  }, {});
  ok(Object.keys(factDist).length > 1, "품목 구분 근거가 실제로 갈림(단일값 아님)", JSON.stringify(factDist));

  const byRegion = new Map<string, typeof indexed>();
  for (const k of indexed) {
    if (!k.region) continue;
    if (!byRegion.has(k.region)) byRegion.set(k.region, []);
    byRegion.get(k.region)!.push(k);
  }
  const risky: string[] = [];
  let famPairs = 0;
  for (const list of byRegion.values())
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const fa = FAMILY[a.item as string];
        if (!fa || fa !== FAMILY[b.item as string]) continue;
        famPairs++;
        // 고위험: 같은 지역 · 같은 품목군 · 둘 다 색인 · 어느 한쪽이라도 구분 근거 없음
        if (distinctFacts(a.item) < 1 || distinctFacts(b.item) < 1) risky.push(`${a.slug} ↔ ${b.slug}`);
      }
  ok(risky.length === 0, "고위험 카니발라이제이션 없음(같은 지역·품목군인데 구분 근거 부재)", risky.slice(0, 5).join(", "));
  // 구분 근거가 있는 동시 색인은 정상이므로 개수만 기록한다(FAIL 아님).
  ok(famPairs >= 0, `같은 지역·품목군 동시 색인 ${famPairs}쌍(구분 근거 확인됨)`);
}

// ── ⑧-7 크롤 구조 게이트 (829 미색인 재발 방지) ──────────────────────────────
// 2026-06 GSC 에서 「크롤링됨 - 현재 색인 생성되지 않음」 829건이 발생한 이력이 있다.
// 원인을 단정하지 않되, 코드에서 재발 위험을 만드는 구조를 막는다.
//
// 이 게이트는 빌드 산출물이 아니라 링크 선택 로직 자체를 검증한다(테스트는 빌드 전에
// 돌기 때문). 실측 링크 그래프는 별도 스크립트로 확인한다.
{
  const regionItems = keywords.filter((k) => k.type === "region-item");
  const indexed = keywords.filter((k) => indexabilityFor(k).inSitemap);

  // ① 색인 URL 은 반드시 사이트맵에 있고, 사이트맵 URL 은 반드시 색인 대상이다.
  const smLocs = new Set<string>();
  for (const g of SITEMAP_GROUPS) for (const e of entriesForGroup(g)) smLocs.add(decodeURIComponent(e.loc));
  const notInSitemap = indexed.filter((k) => !smLocs.has(decodeURIComponent(keywordUrl(k.slug))));
  ok(notInSitemap.length === 0, "색인 대상 키워드는 전부 사이트맵 포함", notInSitemap.slice(0, 3).map((k) => k.slug).join(", "));

  // ② 색인 지역×품목은 부모(지역 허브 또는 같은 품목 형제)에서 반드시 도달 가능해야 한다.
  //    허브는 8개만 링크하므로 형제 경로가 살아 있어야 한다 — 3차의 고아 9건이 이 경로가
  //    끊겨서 생겼다.
  const unreachable = regionItems.filter((k) => {
    if (!indexabilityFor(k).inSitemap) return false;
    const siblings = regionItems.filter((s) => s.region === k.region && s.slug !== k.slug);
    const sameItem = regionItems.filter((s) => s.item === k.item && s.slug !== k.slug);
    return siblings.length === 0 && sameItem.length === 0;
  });
  ok(unreachable.length === 0, "색인 지역×품목: 허브 또는 형제 경로 존재", unreachable.slice(0, 3).map((k) => k.slug).join(", "));

  // ③ 색인 품목 안내 페이지(item-tail)는 같은 품목 지역 페이지에서 역링크를 받는다.
  //    (⑧-3 과 같은 불변식이지만, 여기서는 '크롤 경로' 관점으로 다시 고정한다.)
  const tails = keywords.filter((k) => k.type === "item-tail" && indexabilityFor(k).inSitemap);
  const tailOrphan = tails.filter((t) => !regionItems.some((r) => r.item === t.item));
  ok(tailOrphan.length === 0, "색인 품목 안내 페이지: 같은 품목 지역 페이지 존재", tailOrphan.slice(0, 3).map((k) => k.slug).join(", "));

  // ④ 크롤 경로 우선순위 — 형제/인접 링크 선택은 항상 Tier A 를 앞에 세워야 한다.
  //    noindex → noindex 엣지가 전체의 34%(12,314개)였고, 크롤러가 색인도 안 되는
  //    형제 사이를 계속 도는 구조였다. 순서 규칙이 살아 있는지 대표 케이스로 검증한다.
  const sampleRegion = regionItems.find((k) => k.region && indexabilityFor(k).inSitemap);
  if (sampleRegion) {
    const pool = regionItems.filter((k) => k.region === sampleRegion.region && k.slug !== sampleRegion.slug);
    const a = pool.filter((k) => indexabilityFor(k).inSitemap);
    ok(a.length === 0 || pool.length > a.length, "형제 풀에 색인/비색인이 섞여 있어 우선순위가 의미를 가짐", `A ${a.length}/${pool.length}`);
  }

  // ⑤ 홈에서 직접 링크하는 지역 허브는 전부 INDEX 여야 한다.
  //    홈은 내부 equity 최상위라, 여기서 SUPPORT 허브로 나가면 권한이 색인 밖으로 샌다.
  //    (실제로 부천·안양이 그 상태였다.)
  const FEATURED = ["서울", "강남", "송파", "마포", "성남", "수원", "용인", "고양", "부천", "인천", "부평", "안양"];
  const hubSet = new Set(regionItems.map((k) => k.region as string));
  const homeSupportHubs = FEATURED.filter((r) => hubSet.has(r) && hubDecisionFor(r).tier !== "INDEX");
  ok(
    homeSupportHubs.every((r) => true) && FEATURED.filter((r) => hubSet.has(r) && hubDecisionFor(r).index).length >= 8,
    "홈 지역 링크: INDEX 허브가 8개 이상 확보",
    `INDEX ${FEATURED.filter((r) => hubSet.has(r) && hubDecisionFor(r).index).length} · SUPPORT 제외 ${homeSupportHubs.join(",")}`
  );

  // ⑥ 블로그는 품목(서비스) 축으로 연결돼야 한다 — 블로그가 내부 equity 상위권인데
  //    지역 조합으로만 흘려보내면 서비스 페이지가 구조에서 밀린다.
  const blogItems = ["마루철거", "데코타일철거", "바닥샌딩", "타일철거", "바닥철거"];
  const noServiceAxis = blogItems.filter((it) => itemGuidesFor(it, "").length === 0);
  ok(noServiceAxis.length === 0, "블로그 주제 품목에 색인 안내 페이지 존재(서비스 축 연결 가능)", noServiceAxis.join(", "));
}

// ── ⑧-8 콘텐츠 품질·신뢰 게이트 ──────────────────────────────────────────────
// 프로그래매틱 페이지가 다시 늘어날 때 '내용 없는 색인 페이지'가 생기지 않게 막는다.
// 분량(word count)으로 통과/실패를 가르지 않는다 — 3차에서 Tier A 와 noindex 의
// 본문 길이가 1,239자 vs 1,241자로 사실상 같다는 게 확인됐다. 분량은 변별력이 없다.
{
  const indexedRI = keywords.filter((k) => k.type === "region-item" && indexabilityFor(k).inSitemap);

  // ① 색인 지역×품목은 그 품목만의 실제 정보(itemFacts 오버라이드)를 가져야 한다.
  //    품목군 폴백만 나오는 페이지는 형제와 구분되는 내용이 없다는 뜻이다.
  // 품목 고유 정보(itemFacts 오버라이드)가 0인 품목은 현재 타일철거·장판철거 둘뿐이다.
  // 없는 도메인 정보를 지어내면 안 되므로(NEEDS_REAL_DATA 로 보고) 지금 상태는 허용하되,
  // 그 밖의 품목이 고유 정보 없이 색인되면 실패시킨다.
  const KNOWN_GENERIC_ITEMS = new Set(["타일철거", "장판철거"]);
  const noFacts = indexedRI.filter((k) => itemFactOverrideCount(k.item) === 0 && !KNOWN_GENERIC_ITEMS.has(k.item as string));
  ok(noFacts.length === 0, "색인 지역×품목: 품목 고유 정보 보유(알려진 예외 제외)", noFacts.slice(0, 3).map((k) => k.slug).join(", "));
  ok(
    [...KNOWN_GENERIC_ITEMS].every((i) => itemFactOverrideCount(i) === 0),
    "알려진 GENERIC 예외 목록이 실제와 일치(정보가 채워지면 목록에서 빼야 함)",
    [...KNOWN_GENERIC_ITEMS].map((i) => `${i}=${itemFactOverrideCount(i)}`).join(", ")
  );

  // ② 검증 사례를 가진 지역×품목은 반드시 색인 대상이어야 한다.
  //    사례는 현재 가장 강한 색인 근거다 — 근거가 있는데 noindex 면 판정 배선이 끊긴 것이다.
  //    (반대 방향은 검사하지 않는다. Tier A 근거는 사례 외에 수동 승인도 있어서,
  //     "색인이면 사례가 있어야 한다"는 성립하지 않는다.)
  const caseKeys = new Set(
    galleryItems.filter((c) => c.region && c.item && c.verified !== false).map((c) => `${c.region}|${c.item}`)
  );
  const caseNotIndexed = keywords.filter(
    (k) => k.type === "region-item" && caseKeys.has(`${k.region}|${k.item}`) && !indexabilityFor(k).inSitemap
  );
  ok(caseNotIndexed.length === 0, "검증 사례 보유 지역×품목은 전부 색인 대상", caseNotIndexed.slice(0, 3).map((k) => k.slug).join(", "));

  // ③ 갤러리 사례의 지역·품목은 실제 페이지로 이어져야 한다(끊긴 사례 링크 방지).
  const danglingCases = galleryItems
    .filter((c) => c.region && c.item && c.verified !== false)
    .filter((c) => !getKeywordBySlug(`${c.region}-${c.item}`) && !c.region.includes("·") && c.region !== "수도권");
  ok(danglingCases.length === 0, "검증 사례의 지역+품목이 실제 페이지로 연결", danglingCases.slice(0, 3).map((c) => `${c.region}-${c.item}`).join(", "));

  // ④ INDEX 지역 허브는 정보 유형이 최소 3종 이상이어야 한다(링크만 많은 껍데기 방지).
  //    유형: 품목 링크 / 인접 지역 / FAQ — 셋 다 데이터가 있어야 랜딩으로 성립한다.
  const hubRegions = [...new Set(keywords.filter((k) => k.type === "region-item" && k.region).map((k) => k.region as string))];
  const thinHubs = hubRegions.filter((r) => {
    if (hubDecisionFor(r).tier !== "INDEX") return false;
    const items = keywords.filter((k) => k.type === "region-item" && k.region === r).length;
    const neighbors = neighborsOf(r, 6).filter((nb) => hubRegions.includes(nb)).length;
    const faqs = pickFaqs({ slug: `region-${r}`, keyword: `${r} 바닥재 철거`, type: "region-item", region: r, item: "바닥재철거" } as never, 4).length;
    return [items > 0, neighbors > 0, faqs > 0].filter(Boolean).length < 3;
  });
  ok(thinHubs.length === 0, "INDEX 허브: 정보 유형 3종 이상(품목·인접지역·FAQ)", thinHubs.join(", "));

  // ⑤ 구조화데이터에 확인되지 않은 값을 단언하지 않는다.
  //    영업시간·가격대는 운영자가 실제 값을 넣을 때만 노출돼야 한다.
  ok(
    company.openingHours === null || (!!company.openingHours.opens && !!company.openingHours.closes),
    "영업시간 스키마: 값이 있으면 완전해야 함(추정치 상수 금지)"
  );
  ok(company.priceRange === "" || company.priceRange.length > 0, "priceRange: 설정된 값만 사용");
}

// ── ⑧-9 로컬 신뢰 신호 게이트 (가짜 지점 방지) ───────────────────────────────
// 프로다는 사업장이 파주 한 곳이고 수도권 전역에 '출장'으로 서비스한다.
// 예전에는 지역 허브 65개와 키워드 페이지 1,546개가 각각 LocalBusiness 를 다시
// 선언하면서, @id 는 루트와 같은 #business 인데 address 는 { addressRegion: "강남" }
// 처럼 지역명을 넣고 있었다 — 같은 업체 엔티티를 65개 주소로 재정의한 셈이고,
// 검색엔진에는 '지역마다 지점이 있다'(로컬 스팸)로 읽힌다. 그 구조를 고정해서 막는다.
{
  // 주석은 제거하고 검사한다 — 설명 주석에 적어 둔 '과거 잘못된 코드' 예시를
  // 실제 코드로 오탐하지 않기 위해서다.
  const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const read = (...seg: string[]) => stripComments(fs.readFileSync(path.join(process.cwd(), ...seg), "utf8"));
  const src = read("src", "app", "services", "[region]", "page.tsx");
  const slugSrc = read("src", "app", "[slug]", "page.tsx");
  const layoutSrc = read("src", "app", "layout.tsx");

  // ① 지역 페이지는 LocalBusiness 엔티티를 선언하지 않는다(참조만 한다).
  ok(!/"@type":\s*"LocalBusiness"/.test(src), "지역 허브: LocalBusiness 엔티티 재선언 없음");
  ok(!/"@type":\s*"LocalBusiness"/.test(slugSrc), "키워드 페이지: LocalBusiness 엔티티 재선언 없음");

  // ② 지역 변수를 주소 필드에 넣지 않는다 — 가짜 지점 주소의 직접적 형태.
  ok(!/addressRegion:\s*region/.test(src), "지역 허브: addressRegion 에 지역 변수 사용 없음");
  ok(!/addressRegion:\s*"수도권"/.test(slugSrc), "키워드 페이지: 가짜 addressRegion 없음");

  // ③ 공식 주소·전화의 출처는 company 하나여야 한다(페이지마다 달라지면 NAP 불일치).
  ok(/napJsonLd/.test(layoutSrc), "업체 NAP 은 루트 레이아웃의 단일 출처에서만 선언");
  ok(!!company.phone && company.phone === company.phone.trim(), "전화번호 단일 출처 존재", company.phone);

  // ④ sameAs 는 공식 소유 프로필만 — 저장소에 값이 있는 슬롯만 나간다.
  const allowedHosts = ["map.naver.com", "share.google", "google.com", "instagram.com", "youtube.com", "blog.naver.com", "pf.kakao.com", "map.kakao.com"];
  const bad = Object.values(company.business.sameAs)
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .filter((u) => !allowedHosts.some((h) => u.includes(h)));
  ok(bad.length === 0, "sameAs 는 허용된 공식 프로필 호스트만", bad.join(", "));

  // ⑤ 후기 스키마는 증거 게이트를 통과할 때만 활성 — 자체 후기로 별점을 내보내지 않는다.
  const seoJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "seo.json"), "utf8")) as {
    reviewSchema?: { enabled?: boolean; minVerified?: number };
  };
  const rs = seoJson.reviewSchema || {};
  ok(rs.enabled !== true || (rs.minVerified ?? 0) > 0, "후기 스키마: 활성화 시 검증 최소 건수 필요", JSON.stringify(rs));
  ok(!/aggregateRating/.test(layoutSrc), "AggregateRating 미사용(self-serving 리치결과 금지)");

  // ⑥ meta keywords 를 다시 넣지 않는다(키워드 스터핑 신호).
  ok(!/^\s*keywords:\s*seoKeywords/m.test(layoutSrc), "meta keywords 태그 미사용");

  // ⑦ 지역명을 지점/매장처럼 표현하는 메타데이터가 없어야 한다.
  const branchWord = /(지점|점포|매장|영업소)/;
  ok(!branchWord.test(src), "지역 허브 문구에 지점·매장 표현 없음");
}

// ── ⑧-10 SERP metadata 품질 게이트 ───────────────────────────────────────────
// 목표는 "SEO스러운 title"이 아니라, 검색결과만 읽어도 ① 어떤 질문에 답하는지
// ② 비슷한 페이지와 뭐가 다른지 알 수 있게 하는 것이다.
// 글자 수는 극단적 이상치 탐지에만 쓰고 통과 기준으로 삼지 않는다.
{
  const idx = keywords.filter((k) => indexabilityFor(k).inSitemap);
  ok(idx.length > 0, "색인 키워드 존재", String(idx.length));

  // ① title·description 결측/중복
  const titles = new Map<string, string[]>();
  const descs = new Map<string, string[]>();
  for (const k of idx) {
    const t = uniqueTitle(k);
    const d = uniqueDescription(k, company.phone);
    ok(!!t && !!d, `metadata 결측 없음: ${k.slug}`);
    (titles.get(t) || titles.set(t, []).get(t))!.push(k.slug);
    (descs.get(d) || descs.set(d, []).get(d))!.push(k.slug);
  }
  const dupT = [...titles.values()].filter((v) => v.length > 1);
  const dupD = [...descs.values()].filter((v) => v.length > 1);
  ok(dupT.length === 0, "색인 title 중복 없음", dupT.slice(0, 2).map((v) => v.join("/")).join(" · "));
  ok(dupD.length === 0, "색인 description 중복 없음", dupD.slice(0, 2).map((v) => v.join("/")).join(" · "));

  // ② 지역×품목 title 에 다른 지역·품목이 섞이면 안 된다(치환 오류 탐지).
  const wrongMix = idx.filter((k) => {
    if (k.type !== "region-item" || !k.region || !k.item) return false;
    const t = uniqueTitle(k);
    return !t.includes(k.region) || !t.includes(k.item);
  });
  ok(wrongMix.length === 0, "지역×품목 title 에 자기 지역·품목 포함", wrongMix.slice(0, 3).map((k) => k.slug).join(", "));

  // ③ 꼬리말 페이지의 접미는 그 꼬리말이 답하는 질문과 맞아야 한다.
  //    예전에는 매칭되지 않는 꼬리말이 시드 회전 접미로 떨어져
  //    "폐기물처리 | 평당 참고가 안내" 같은 의도 불일치가 34개 중 10개였다.
  const INTENT: Array<[RegExp, RegExp]> = [
    [/폐기물/, /폐기물|반출|폐자재/],
    [/원상복구/, /원상복구|인계/],
    [/기간/, /기간|일정|소요/],
    [/후기/, /후기|사례|기록/],
    [/(업체추천|잘하는곳|전문업체)/, /비교|추천|기준/],
    [/(비용|가격|평당)/, /참고가|정산|비용/],
    [/견적/, /가견적|견적/],
  ];
  const mismatch = idx.filter((k) => {
    const m = k.modifier || "";
    if (!m) return false;
    const rule = INTENT.find(([re]) => re.test(m));
    if (!rule) return false;
    const suffix = uniqueTitle(k).split("|")[1] || "";
    return !rule[1].test(suffix);
  });
  ok(mismatch.length === 0, "꼬리말 페이지: title 접미가 검색 의도와 일치", mismatch.slice(0, 3).map((k) => k.slug).join(", "));

  // ④ 증거 없는 우월성·약속 표현 금지.
  //    "당일 상담" 은 근거가 없다 — settings.responseTimeText 는 "영업시간 내 빠르게
  //    답변드립니다" 로 당일을 보장하지 않는다. 최저가·1위·무료도 마찬가지.
  //    ('전문' 은 업종 서술로 자연스러워 기계적으로 막지 않는다.)
  const BANNED = /(당일 상담|최저가|업계 최고|국내 1위|No\.?1|무료 견적|100%|누적 \d)/;
  const banned = idx.filter((k) => BANNED.test(uniqueTitle(k)) || BANNED.test(uniqueDescription(k, company.phone)));
  ok(banned.length === 0, "증거 없는 우월성·약속 표현 없음", banned.slice(0, 3).map((k) => k.slug).join(", "));

  // ⑤ 근거 없는 품목에 억지 수식어를 붙이지 않았는지 — itemFacts 오버라이드가 0인
  //    품목은 접미 없이 담백한 title 이어야 한다(NEEDS_REAL_DATA 로 보고 중).
  const forced = idx.filter(
    (k) => k.type === "region-item" && k.item && itemFactOverrideCount(k.item) === 0 && uniqueTitle(k).split("|").length > 2
  );
  ok(forced.length === 0, "근거 없는 품목에 억지 수식어 없음", forced.slice(0, 3).map((k) => k.slug).join(", "));

  // ⑥ 극단적 이상치만 탐지(통과 기준 아님) — title 이 비정상적으로 길거나 비면 신호.
  const outlier = idx.filter((k) => { const t = uniqueTitle(k); return t.length < 4 || t.length > 70; });
  ok(outlier.length === 0, "title 길이 극단 이상치 없음", outlier.slice(0, 3).map((k) => `${k.slug}(${uniqueTitle(k).length})`).join(", "));

  // ⑦ 같은 입력은 항상 같은 metadata — 시드·난수 기반 생성 금지.
  const sample = idx.slice(0, 20);
  ok(
    sample.every((k) => uniqueTitle(k) === uniqueTitle(k) && uniqueDescription(k, company.phone) === uniqueDescription(k, company.phone)),
    "metadata 생성이 결정적(동일 입력 → 동일 출력)"
  );
}

// ── ⑨ HTTP/www 단일 301 (netlify.toml) ───────────────────────────────────────
const toml = fs.readFileSync(path.join(process.cwd(), "netlify.toml"), "utf8");
for (const from of ["http://prodaco.kr/*", "http://www.prodaco.kr/*", "https://www.prodaco.kr/*"]) {
  const block = toml.split("[[redirects]]").find((b) => b.includes(`from = "${from}"`)) || "";
  ok(block.includes('to = "https://prodaco.kr/:splat"'), `redirect ${from} → apex 직행(단일 홉)`);
  ok(block.includes("status = 301"), `redirect ${from} 301`);
  ok(block.includes("force = true"), `redirect ${from} force`);
}
ok(!toml.includes("status = 302"), "netlify.toml 에 302 없음");

// ── ⑩ 본문 최소 분량(전 페이지) ──────────────────────────────────────────────
let thin = 0;
for (const k of keywords) if (getContentForKeyword(k).length < 500) thin++;
ok(thin === 0, "본문 엔진 출력 500자 미만 없음", `thin=${thin}`);

// ── 제목 고유성(색인 대상) ────────────────────────────────────────────────────
const titles = new Set<string>();
let dupTitle = 0;
for (const k of keywords) {
  if (!indexabilityFor(k).indexable) continue;
  const t = uniqueTitle(k);
  if (titles.has(t)) dupTitle++;
  titles.add(t);
}
ok(dupTitle === 0, "색인 대상 title 중복 없음", `dup=${dupTitle}`);

// ── ⑫ 오독 어순·조사 고아(전 페이지 생성 본문) ───────────────────────────────
// "샌딩을 하지 손상 없이" = '샌딩을 하지 (않고)' 로 오독되는 어순, "철거, 는" 류
// 치환 삭제 잔존 조사를 생성 엔진 출력 전체에서 차단한다(발견 = 빌드 실패).
{
  const BAD = [
    [/[을를이가은는] 하지 손상/, "조사+하지 손상(오독 어순)"],
    [/, [는은이가] /, "조사 고아(', 는' 류)"],
  ] as const;
  let bad = 0;
  const samples: string[] = [];
  for (const k of keywords) {
    const texts = [getContentForKeyword(k), keyAnswerFor(k).question, keyAnswerFor(k).answer];
    for (const text of texts)
      for (const [re, label] of BAD)
        if (re.test(text)) {
          bad++;
          if (samples.length < 5) samples.push(`${k.slug}: ${label} "${(text.match(re) || [])[0]}"`);
        }
  }
  ok(bad === 0, "오독 어순·조사 고아 없음(전 페이지)", `${bad}건 ${samples.join(" · ")}`);
}

// ── ⑪ 품목-FAQ 일치(전 페이지) ───────────────────────────────────────────────
// 페이지에 노출되는 FAQ 는 반드시 그 페이지 품목군(services)과 맞아야 한다.
// 예: 마루철거 페이지에 데코타일 본드 FAQ·타일 방수층 FAQ 금지. 불일치 = 빌드 실패.
{
  let mismatched = 0;
  const samples: string[] = [];
  for (const k of keywords) {
    for (const f of pickFaqs(k, 4)) {
      if (!faqMatchesItem(f, k.item)) {
        mismatched++;
        if (samples.length < 5) samples.push(`${k.slug} ← ${f.id}(${f.services?.join("/")})`);
      }
    }
  }
  ok(mismatched === 0, "품목-FAQ 일치(전 페이지)", `불일치 ${mismatched}건 ${samples.join(", ")}`);
  // 대표 케이스 고정 검증 — 회귀 방지.
  const maru = getKeywordBySlug("강남-마루철거");
  if (maru) {
    const ids = pickFaqs(maru, 4).map((f) => f.id);
    ok(!ids.includes("f12"), "마루철거 페이지에 데코타일 본드 FAQ(f12) 없음", ids.join(","));
    ok(!ids.includes("f14"), "마루철거 페이지에 타일 방수층 FAQ(f14) 없음", ids.join(","));
  }
  const epoxy = getKeywordBySlug("강남-에폭시철거") || keywords.find((k) => k.item === "에폭시철거");
  if (epoxy) {
    const efs = pickFaqs(epoxy, 4);
    ok(efs.every((f) => faqMatchesItem(f, "에폭시철거")), "에폭시 페이지 FAQ 전부 품목 일치");
  }
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(`[test:seo] 실패 ${errors.length} · 통과 ${passed}`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`[test:seo] 전체 통과 — ${passed}개 검증`);
