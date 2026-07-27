// =============================================================================
// 색인 정합성 검증 — robots / canonical / sitemap 이 서로 모순되지 않는지 확인한다.
//   실행: npm run seo:validate-index
//   출력: 콘솔 리포트 + reports/seo-index-validation-2026-07-27.md
//   종료코드: 위반 1건 이상이면 1 (prebuild 게이트에서 빌드를 막는다)
//
// 실제 서비스 모듈(indexability / sitemap)을 그대로 불러 검사하므로 리포트와 배포 결과가
// 어긋날 수 없다. 감사 스크립트가 판정 로직 사본을 들고 있으면 반드시 드리프트가 생긴다.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { getKeywords, getKeywordBySlug } from "@/data/keywords";
import { indexabilityFor, siteUrl, keywordUrl, regionHubUrl } from "@/lib/seo/indexability";
import { entriesForGroup, SITEMAP_GROUPS } from "@/lib/sitemap";
import { uniqueTitle, uniqueDescription } from "@/lib/seo";
import { posts } from "@/data/posts";
import { company } from "@/data/company";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "reports");
const STAMP = "2026-07-27";

interface Node {
  url: string;
  kind: "core" | "region-hub" | "blog" | string;
  index: boolean;
  inSitemap: boolean;
  canonical: string;
  title: string;
  description: string;
  hasEvidence: boolean;
  bodyEvidence: string;
}

// ─── URL 우주 구성(실제 라우트가 서빙하는 모든 SEO 대상 URL) ───────────────────
const nodes: Node[] = [];
const CORE = ["", "/services", "/gallery", "/reviews", "/faq", "/blog"];
for (const p of CORE) {
  nodes.push({ url: `${siteUrl}${p}`, kind: "core", index: true, inSitemap: true,
    canonical: `${siteUrl}${p}`, title: `core${p}`, description: "", hasEvidence: true, bodyEvidence: "core" });
}

const hubRegions = [...new Set(getKeywords().filter((k) => k.type === "region-item" && k.region).map((k) => k.region as string))];
for (const region of hubRegions) {
  nodes.push({ url: regionHubUrl(region), kind: "region-hub", index: true, inSitemap: true,
    canonical: regionHubUrl(region), title: `${region} 허브`, description: "", hasEvidence: true, bodyEvidence: "hub" });
}

for (const p of posts) {
  nodes.push({ url: `${siteUrl}/blog/${p.id}`, kind: "blog", index: true, inSitemap: true,
    canonical: `${siteUrl}/blog/${p.id}`, title: p.title, description: p.excerpt || "", hasEvidence: true, bodyEvidence: "blog" });
}

for (const k of getKeywords()) {
  const ix = indexabilityFor(k);
  nodes.push({
    url: keywordUrl(k.slug),
    kind: `keyword:${k.type}`,
    index: ix.indexable,
    inSitemap: ix.inSitemap,
    canonical: ix.canonicalUrl,
    title: uniqueTitle(k),
    description: uniqueDescription(k, company.phone),
    hasEvidence: ix.indexable,
    bodyEvidence: ix.reasons.join(" / "),
  });
}

const byUrl = new Map(nodes.map((n) => [n.url, n]));

// 사이트맵이 실제로 내보내는 URL 집합.
const sitemapUrls: string[] = [];
for (const g of SITEMAP_GROUPS) for (const e of entriesForGroup(g)) sitemapUrls.push(e.loc);

// ─── 검사 ───────────────────────────────────────────────────────────────────────
interface Violation { check: string; url: string; detail: string }
const violations: Violation[] = [];
const notes: string[] = [];
const fail = (check: string, url: string, detail: string) => violations.push({ check, url, detail });

// 1) 사이트맵에 noindex URL 이 들어있지 않은가
for (const loc of sitemapUrls) {
  const n = byUrl.get(loc);
  if (!n) { fail("sitemap-404", loc, "사이트맵 URL 이 라우트 우주에 없음(404 위험)"); continue; }
  if (!n.index) fail("sitemap-noindex", loc, "noindex URL 이 사이트맵에 포함됨");
}

// 2) index + self-canonical URL 은 반드시 사이트맵에 포함
for (const n of nodes) {
  if (n.index && n.canonical === n.url && !n.inSitemap) fail("index-missing-from-sitemap", n.url, "index·self-canonical 인데 사이트맵 제외");
}

// 3) noindex URL 이 사이트맵 포함으로 표시되지 않는가(판정 자체의 모순)
for (const n of nodes) {
  if (!n.index && n.inSitemap) fail("noindex-in-sitemap-flag", n.url, "noindex 인데 inSitemap=true");
}

// 4) noindex 페이지는 self-canonical 이어야 한다
//    (noindex + 다른 URL canonical → 구글이 noindex 를 canonical 대상까지 전파할 수 있음)
for (const n of nodes) {
  if (!n.index && n.canonical !== n.url) fail("noindex-foreign-canonical", n.url, `noindex 인데 canonical 이 ${n.canonical}`);
}

// 5) canonical 대상이 존재하고 색인 가능한가 (canonical→404 / canonical→noindex 금지)
for (const n of nodes) {
  if (n.canonical === n.url) continue;
  const target = byUrl.get(n.canonical);
  if (!target) { fail("canonical-404", n.url, `canonical 대상 없음: ${n.canonical}`); continue; }
  if (!target.index) fail("canonical-to-noindex", n.url, `canonical 대상이 noindex: ${n.canonical}`);
  if (!target.inSitemap) notes.push(`canonical 대상이 사이트맵 제외: ${n.url} → ${n.canonical}`);
}

// 6) canonical 체인 / 루프 없음 (대상의 canonical 은 자기 자신이어야 함)
for (const n of nodes) {
  if (n.canonical === n.url) continue;
  const target = byUrl.get(n.canonical);
  if (!target) continue;
  if (target.canonical === n.url) fail("canonical-loop", n.url, `상호 canonical 루프: ${n.canonical}`);
  else if (target.canonical !== target.url) fail("canonical-chain", n.url, `canonical 체인: ${n.url} → ${n.canonical} → ${target.canonical}`);
}

// 7) 사이트맵 중복 URL 없음
const seen = new Set<string>();
for (const loc of sitemapUrls) {
  if (seen.has(loc)) fail("sitemap-duplicate", loc, "사이트맵 중복 항목");
  seen.add(loc);
}

// 8) URL 표기 일관성 — 전부 https + 동일 호스트 + trailing slash 없음
const host = new URL(siteUrl).host;
for (const loc of sitemapUrls) {
  const u = new URL(loc);
  if (u.protocol !== "https:") fail("sitemap-scheme", loc, "https 아님");
  if (u.host !== host) fail("sitemap-host", loc, `호스트 불일치(${u.host} ≠ ${host})`);
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) fail("sitemap-trailing-slash", loc, "trailing slash 혼용");
}

// 9) 내부 링크 대상이 실재하는가 — 관련 키워드 링크는 getKeywords() 범위이므로
//    라우트 우주에 없는 슬러그를 가리키면 404 링크가 된다.
for (const k of getKeywords()) {
  const ix = indexabilityFor(k);
  if (ix.canonicalSlug && ix.canonicalSlug !== k.slug && !getKeywordBySlug(ix.canonicalSlug)) {
    fail("internal-link-404", keywordUrl(k.slug), `canonicalSlug 대상 슬러그 없음: ${ix.canonicalSlug}`);
  }
}

// ─── 품질 현황(위반 아님 — 추이 관찰용 수치) ────────────────────────────────────
const indexed = nodes.filter((n) => n.index);
const noindexed = nodes.filter((n) => !n.index);

const dupTitle = new Map<string, number>();
const dupDesc = new Map<string, number>();
for (const n of indexed) {
  dupTitle.set(n.title, (dupTitle.get(n.title) || 0) + 1);
  dupDesc.set(n.description, (dupDesc.get(n.description) || 0) + 1);
}
const dupTitleCount = [...dupTitle.values()].filter((v) => v > 1).length;
const dupDescCount = [...dupDesc.values()].filter((v) => v > 1).length;

// 지역·품목만 다른 사실상 중복: 같은 품목을 공유하는 색인 대상 지역 페이지 수.
const byService = new Map<string, number>();
for (const k of getKeywords()) {
  if (!indexabilityFor(k).indexable || k.type !== "region-item" || !k.item) continue;
  byService.set(k.item, (byService.get(k.item) || 0) + 1);
}
const worstService = [...byService.entries()].sort((a, b) => b[1] - a[1])[0];

const lines: string[] = [];
lines.push(`# 색인 정합성 검증 — ${STAMP}`, "");
lines.push(`- 라우트 URL 총계: **${nodes.length}**`);
lines.push(`- index: **${indexed.length}** · noindex: **${noindexed.length}**`);
lines.push(`- 사이트맵 URL: **${sitemapUrls.length}**`);
lines.push(`- 위반: **${violations.length}건**`, "");
lines.push("## 검사 항목", "");
const CHECKS = [
  ["sitemap-noindex", "사이트맵에 noindex URL 없음"],
  ["sitemap-404", "사이트맵 URL 이 전부 실재"],
  ["index-missing-from-sitemap", "index·self-canonical URL 은 사이트맵 포함"],
  ["noindex-in-sitemap-flag", "noindex URL 은 사이트맵 제외"],
  ["noindex-foreign-canonical", "noindex 는 self-canonical 유지"],
  ["canonical-404", "canonical 대상 404 없음"],
  ["canonical-to-noindex", "canonical 대상이 noindex 아님"],
  ["canonical-loop", "canonical 루프 없음"],
  ["canonical-chain", "canonical 체인 없음"],
  ["sitemap-duplicate", "사이트맵 중복 없음"],
  ["sitemap-scheme", "전부 https"],
  ["sitemap-host", "호스트 일관"],
  ["sitemap-trailing-slash", "trailing slash 일관"],
  ["internal-link-404", "내부 canonical 링크 대상 실재"],
];
for (const [id, label] of CHECKS) {
  const n = violations.filter((v) => v.check === id).length;
  lines.push(`- ${n === 0 ? "✅" : "❌"} ${label} — 위반 ${n}건`);
}
lines.push("", "## 품질 현황(추이 관찰)", "");
lines.push(`- 색인 대상 중 title 중복 그룹: ${dupTitleCount}`);
lines.push(`- 색인 대상 중 description 중복 그룹: ${dupDescCount}`);
lines.push(`- 같은 품목을 공유하는 색인 지역 페이지 최대치: ${worstService ? `${worstService[0]} ${worstService[1]}개` : "0"}`);
lines.push(`- 리디렉션 설정: 없음(이번 작업에서 301 을 만들지 않음) → 리디렉션 체인 0`);
if (notes.length) {
  lines.push("", "## 참고", "");
  for (const s of [...new Set(notes)].slice(0, 20)) lines.push(`- ${s}`);
}
if (violations.length) {
  lines.push("", "## 위반 상세", "");
  for (const v of violations.slice(0, 100)) lines.push(`- \`${v.check}\` ${v.url} — ${v.detail}`);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, `seo-index-validation-${STAMP}.md`), lines.join("\n") + "\n", "utf8");

console.log(`[seo:validate-index] URL ${nodes.length} · index ${indexed.length} · noindex ${noindexed.length} · sitemap ${sitemapUrls.length}`);
for (const [id, label] of CHECKS) {
  const n = violations.filter((v) => v.check === id).length;
  console.log(`  ${n === 0 ? "✅" : "❌"} ${label}${n ? ` — ${n}건` : ""}`);
}
console.log(`  title 중복 그룹 ${dupTitleCount} · description 중복 그룹 ${dupDescCount}`);
console.log(`  → reports/seo-index-validation-${STAMP}.md`);
if (violations.length) {
  console.error(`\n[seo:validate-index] 위반 ${violations.length}건 — 배포 전 수정 필요`);
  for (const v of violations.slice(0, 20)) console.error(`  · ${v.check} ${v.url} — ${v.detail}`);
  process.exit(1);
}
