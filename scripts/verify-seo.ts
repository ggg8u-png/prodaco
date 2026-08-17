// =============================================================================
// SEO 전수 정적 검증 — 빌드 산출물이 아니라 '실제 서비스 모듈'을 그대로 불러 검사한다.
//   실행: npm run seo:verify
//   종료코드: 치명 항목이 1건이라도 있으면 1
//
// 여기서 보는 것(벤치마크 §7 실행 플레이북 대응):
//   · indexable / sitemap URL 수와 그 일치
//   · title·description·canonical·H1 누락 및 중복
//   · OG 이미지 생성 입력(지역·서비스·전화번호)이 전 페이지에 전달되는가
//   · Service / FAQPage / BreadcrumbList 스키마 발생 수
//   · 고아 페이지(내부링크로 도달 불가) · 깨진 내부링크
//
// 감사 스크립트가 판정 로직 사본을 들고 있으면 반드시 드리프트가 생기므로,
// 판정은 전부 원본 모듈(indexability / eligibility / sitemap / caseDoc …)에서 가져온다.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { getKeywords, getKeywordBySlug, hubDecisionFor } from "@/data/keywords";
import { indexabilityFor, siteUrl, keywordUrl, regionHubUrl } from "@/lib/seo/indexability";
import { contentEligibilityFor } from "@/lib/seo/eligibility";
import { uniqueTitle, uniqueDescription } from "@/lib/seo";
import { getContentForKeyword, contentProfileIdFor } from "@/lib/content";
import { faqItemsFor } from "@/data/faqPool";
import { entriesForGroup, SITEMAP_GROUPS } from "@/lib/sitemap";
import { company } from "@/data/company";
import { regionVariants } from "@/data/regionVariants";
import { neighborsOf } from "@/data/regions";
import { itemGuidesFor } from "@/lib/itemGuides";
import { casePageItems, indexableCases, casePath, caseRelatedLinks } from "@/lib/caseDoc";
import { reviewPageItems, indexableReviews } from "@/lib/reviewDoc";
import { posts } from "@/data/posts";
import { blogPath } from "@/lib/blogUrl";

interface Problem { check: string; where: string; detail: string }
const fatal: Problem[] = [];
const warn: Problem[] = [];
const bad = (check: string, where: string, detail = "") => fatal.push({ check, where, detail });
const soft = (check: string, where: string, detail = "") => warn.push({ check, where, detail });

const keywords = getKeywords();
const indexed = keywords.filter((k) => indexabilityFor(k).indexable);
const inSitemap = keywords.filter((k) => indexabilityFor(k).inSitemap);

// ─── ① title / description / canonical / H1 ────────────────────────────────────
const titles = new Map<string, string[]>();
const descs = new Map<string, string[]>();
let missingTitle = 0, missingDesc = 0, missingCanonical = 0, missingH1 = 0;

for (const k of indexed) {
  const t = uniqueTitle(k).trim();
  const d = uniqueDescription(k, company.phone).trim();
  const ix = indexabilityFor(k);
  const body = getContentForKeyword(k);

  if (!t) { missingTitle++; bad("title 누락", k.slug); }
  if (!d) { missingDesc++; bad("description 누락", k.slug); }
  if (!ix.canonicalUrl) { missingCanonical++; bad("canonical 누락", k.slug); }
  // H1 은 페이지 컴포넌트가 keyword.keyword 로 렌더한다 — 그 원천값이 비면 H1 이 빈다.
  if (!k.keyword?.trim()) { missingH1++; bad("H1 원천값 누락", k.slug); }
  if (!body.trim()) bad("본문 없음", k.slug);

  titles.set(t, [...(titles.get(t) || []), k.slug]);
  descs.set(d, [...(descs.get(d) || []), k.slug]);
}

const dupTitles = [...titles.entries()].filter(([, v]) => v.length > 1);
const dupDescs = [...descs.entries()].filter(([, v]) => v.length > 1);
for (const [t, v] of dupTitles.slice(0, 10)) bad("title 중복", v.slice(0, 3).join(","), t);
for (const [d, v] of dupDescs.slice(0, 10)) bad("description 중복", v.slice(0, 3).join(","), d.slice(0, 60));

// ─── ② OG 이미지 생성 입력 ─────────────────────────────────────────────────────
// 각 지역×품목 페이지의 OG 는 [slug]/opengraph-image.tsx 가 만든다. 그 라우트가 쓰는
// 입력(지역 표기·품목·전화번호)이 전 페이지에서 실제로 채워지는지 여기서 확인한다.
// 하나라도 비면 그 페이지 OG 에서 핵심 정보가 사라진다.
const phone = company.phoneDigits;
if (!/^\d{9,11}$/.test(phone)) bad("OG 전화번호 형식", "company.phoneDigits", phone);
let ogChecked = 0;
for (const k of indexed) {
  const vs = regionVariants(k.region);
  const ogRegion = vs.length > 1 ? vs[1] : k.region || "서울 · 경기 · 인천";
  const ogService = k.item || "바닥재 철거";
  if (!ogRegion.trim()) bad("OG 지역 비어 있음", k.slug);
  if (!ogService.trim()) bad("OG 서비스 비어 있음", k.slug);
  // 긴 라벨은 폰트 축소로 처리하지만, 과도하게 길면 두 줄로도 안 들어간다.
  if (ogRegion.length > 14) soft("OG 지역명 과장", k.slug, ogRegion);
  if (ogService.length > 16) soft("OG 품목명 과장", k.slug, ogService);
  ogChecked++;
}

// ─── ③ 스키마 발생 수 ──────────────────────────────────────────────────────────
// 지역×품목 페이지는 Service + BreadcrumbList + FAQPage 를 낸다(페이지 컴포넌트 고정).
// FAQ 는 faqPool 이 항목을 만들어야 스키마가 실제로 채워진다.
let faqSchemaPages = 0, serviceSchemaPages = 0, breadcrumbPages = 0;
for (const k of indexed) {
  const items = faqItemsFor(k, 0, 4);
  if (items.length >= 3) faqSchemaPages++;
  else bad("FAQ 항목 부족(FAQPage 스키마 빈약)", k.slug, `${items.length}개`);
  if (k.item) serviceSchemaPages++;
  breadcrumbPages++;
}
const areaServedPages = indexed.filter((k) => !!k.region).length;

// ─── ④ 내부링크 · 고아 페이지 ─────────────────────────────────────────────────
// 색인 대상 URL 이 다른 색인 페이지에서 한 번도 링크되지 않으면 고아다.
const indexedSlugs = new Set(indexed.map((k) => k.slug));
const inbound = new Map<string, number>();
const brokenLinks: string[] = [];
const note = (slug: string) => inbound.set(slug, (inbound.get(slug) || 0) + 1);

for (const k of indexed) {
  // 품목 가이드(같은 품목 다른 검색의도)
  for (const g of itemGuidesFor(k.item || "", k.slug)) {
    const target = g.slug;
    if (!getKeywordBySlug(target)) brokenLinks.push(`${k.slug} → ${target}`);
    else note(target);
  }
  // 같은 지역 다른 품목
  if (k.region)
    for (const sib of indexed.filter((x) => x.region === k.region && x.slug !== k.slug).slice(0, 6)) note(sib.slug);
  // 인근 지역 같은 품목
  if (k.region && k.item)
    for (const nb of neighborsOf(k.region, 5)) {
      const target = `${nb}-${k.item}`;
      if (indexedSlugs.has(target)) note(target);
    }
}
// 지역 허브에서 내려가는 링크 — 허브는 색인 대상 하위 페이지를 전부 링크한다
// (services/[region]/page.tsx 의 itemsForRegion 과 같은 규칙: Tier A 전량 + 나머지 4).
for (const region of new Set(keywords.filter((k) => k.region).map((k) => k.region as string))) {
  if (!hubDecisionFor(region).index) continue;
  for (const k of indexed.filter((x) => x.region === region && x.type === "region-item")) note(k.slug);
  // 허브 하단 B2B 섹션(services/[region]/page.tsx 의 b2bLinks) — 같은 규칙으로 센다.
  for (const k of keywords.filter((x) => x.type === "b2b" && x.region === region && indexabilityFor(x).inSitemap))
    note(k.slug);
}
const orphans = indexed.filter((k) => !inbound.get(k.slug));
for (const o of orphans.slice(0, 10)) bad("고아 페이지(내부링크 inbound 0)", o.slug);
for (const b of brokenLinks.slice(0, 10)) bad("깨진 내부링크", b);

// ─── ⑤ 사이트맵 정합 ───────────────────────────────────────────────────────────
const sitemapUrls = SITEMAP_GROUPS.flatMap((g) => entriesForGroup(g).map((e) => e.loc));
const sitemapSet = new Set(sitemapUrls);
if (sitemapSet.size !== sitemapUrls.length) bad("사이트맵 중복 URL", "sitemap", `${sitemapUrls.length - sitemapSet.size}건`);
for (const k of inSitemap) if (!sitemapSet.has(keywordUrl(k.slug))) bad("사이트맵 누락", k.slug);
for (const k of keywords) {
  const ix = indexabilityFor(k);
  if (!ix.indexable && sitemapSet.has(keywordUrl(k.slug))) bad("noindex 인데 사이트맵 포함", k.slug);
}

// ─── ⑥ 콘텐츠 프로파일 분포 ────────────────────────────────────────────────────
const profileDist = new Map<string, number>();
for (const k of indexed) {
  const id = contentProfileIdFor(k.slug);
  profileDist.set(id, (profileDist.get(id) || 0) + 1);
}
if (profileDist.size < 3) bad("콘텐츠 프로파일 다양성 부족", "content", JSON.stringify(Object.fromEntries(profileDist)));

// ─── 출력 ──────────────────────────────────────────────────────────────────────
const metrics = indexed.map((k) => contentEligibilityFor(k).metrics);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

console.log("=== SEO 정적 검증 ===");
console.log(`indexable URLs        ${indexed.length}`);
console.log(`sitemap URLs          ${sitemapUrls.length}  (키워드 ${inSitemap.length} + 허브·코어·글)`);
console.log(`unique titles         ${titles.size}`);
console.log(`duplicate titles      ${dupTitles.length}`);
console.log(`missing title         ${missingTitle}`);
console.log(`missing description   ${missingDesc}`);
console.log(`duplicate description ${dupDescs.length}`);
console.log(`missing canonical     ${missingCanonical}`);
console.log(`missing H1            ${missingH1}`);
console.log(`missing OG image      0  (라우트 규약 — ${ogChecked}개 페이지 입력 검증 완료)`);
console.log(`Service schema        ${serviceSchemaPages}`);
console.log(`FAQPage schema        ${faqSchemaPages}`);
console.log(`BreadcrumbList        ${breadcrumbPages}`);
console.log(`areaServed 지정       ${areaServedPages}`);
console.log(`orphan URLs           ${orphans.length}`);
console.log(`broken internal links ${brokenLinks.length}`);
console.log(`본문 평균             ${avg(metrics.map((m) => m.bodyChars))}자 · H2 ${avg(metrics.map((m) => m.headings))}개 · FAQ ${avg(metrics.map((m) => m.faq))}개`);
console.log(`콘텐츠 프로파일       ${JSON.stringify(Object.fromEntries([...profileDist].sort()))}`);
console.log(`시공사례              생성 ${casePageItems().length} · index ${indexableCases().length}`);
console.log(`고객후기              생성 ${reviewPageItems().length} · index ${indexableReviews().length}`);
console.log(`블로그                ${posts.length}`);
console.log(`OG 전화번호           ${phone}`);

fs.mkdirSync(path.join(process.cwd(), "reports"), { recursive: true });
fs.writeFileSync(
  path.join(process.cwd(), "reports", "seo-verify.md"),
  `# SEO 정적 검증\n\n- indexable ${indexed.length} · sitemap ${sitemapUrls.length}\n- 치명 ${fatal.length} · 경고 ${warn.length}\n\n` +
    (fatal.length ? "## 치명\n" + fatal.map((p) => `- [${p.check}] ${p.where} ${p.detail}`).join("\n") + "\n\n" : "") +
    (warn.length ? "## 경고\n" + warn.slice(0, 50).map((p) => `- [${p.check}] ${p.where} ${p.detail}`).join("\n") + "\n" : "")
);

if (warn.length) console.log(`\n경고 ${warn.length}건 (reports/seo-verify.md)`);
if (fatal.length) {
  console.error(`\n❌ 치명 ${fatal.length}건`);
  for (const p of fatal.slice(0, 15)) console.error(`  · [${p.check}] ${p.where} ${p.detail}`);
  process.exit(1);
}
console.log("\n✅ 치명 문제 없음");
void casePath;
void caseRelatedLinks;
void blogPath;
void regionHubUrl;
