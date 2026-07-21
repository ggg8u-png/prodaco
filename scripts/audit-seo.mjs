// SEO 감사 — 빌드 산출물(.next/server/app/*.html)을 검사해 색인 저해 요소를 리포트한다.
//   실행: npm run build && npm run seo:audit
//   출력: reports/seo-audit.json / reports/seo-audit.csv / reports/seo-summary.md
// 검사: title·H1·canonical·robots·본문길이·내부링크·중복 title·고아 페이지·사이트맵 정합.
// (색인은 검색엔진의 결정이므로 이 감사는 '막는 요인 제거' 확인용이다.)
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP = path.join(ROOT, ".next", "server", "app");
const OUT = path.join(ROOT, "reports");

function textOf(html) {
  let b = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ");
  const m = b.indexOf("<main");
  if (m >= 0) b = b.slice(m);
  return b.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function auditFile(file) {
  const html = fs.readFileSync(file, "utf8");
  const name = path.basename(file, ".html");
  const url = name === "index" ? "/" : `/${name}`;
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const canonical = (html.match(/rel="canonical" href="([^"]+)"/) || [])[1] || "";
  const robots = (html.match(/name="robots" content="([^"]+)"/) || [])[1] || "";
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  const links = [...html.matchAll(/<a [^>]*href="(\/[^"]*)"/g)].map((m) => m[1]);
  const text = textOf(html);
  const breadcrumbs = (html.match(/"@type":"BreadcrumbList"/g) || []).length;
  const issues = [];
  if (!title) issues.push("no-title");
  if (h1s !== 1 && name !== "_not-found") issues.push(`h1x${h1s}`);
  if (!canonical && !robots.includes("noindex")) issues.push("no-canonical");
  if (canonical && !canonical.startsWith("https://")) issues.push("canonical-not-abs");
  if (text.length < 800 && !robots.includes("noindex") && name !== "_not-found") issues.push("thin");
  if (breadcrumbs > 1) issues.push("breadcrumb-dup");
  return { url, title, canonical, robots, h1s, breadcrumbs, textLength: text.length, internalLinkCount: links.length, links, issues };
}

function main() {
  if (!fs.existsSync(APP)) {
    console.error("[seo:audit] .next 빌드가 없습니다. 먼저 `npm run build` 를 실행하세요.");
    process.exit(1);
  }
  const files = fs.readdirSync(APP).filter((f) => f.endsWith(".html"));
  const rows = files.map((f) => auditFile(path.join(APP, f)));

  // 중복 title
  const titleCount = new Map();
  for (const r of rows) titleCount.set(r.title, (titleCount.get(r.title) || 0) + 1);
  for (const r of rows) if (titleCount.get(r.title) > 1 && r.title) r.issues.push("dup-title");

  // 고아(내부링크 수신 0) — 정적 허브 링크 그래프 기준(런타임 관련링크 제외라 보수적).
  const inbound = new Map(rows.map((r) => [r.url, 0]));
  for (const r of rows)
    for (const l of r.links) {
      const u = decodeURIComponent(l.split("?")[0].replace(/\/$/, "") || "/");
      if (inbound.has(u)) inbound.set(u, inbound.get(u) + 1);
    }
  for (const r of rows) if (inbound.get(r.url) === 0 && r.url !== "/" && r.url !== "/_not-found") r.issues.push("orphan-static");

  const noindex = rows.filter((r) => r.robots.includes("noindex"));
  const indexable = rows.filter((r) => !r.robots.includes("noindex") && r.url !== "/_not-found");
  const withIssues = rows.filter((r) => r.issues.length);
  const services = rows.find((r) => r.url === "/services");

  fs.mkdirSync(OUT, { recursive: true });
  const slim = rows.map(({ links: _links, ...r }) => r);
  fs.writeFileSync(path.join(OUT, "seo-audit.json"), JSON.stringify(slim, null, 1));
  const cols = ["url", "title", "canonical", "robots", "h1s", "breadcrumbs", "textLength", "internalLinkCount", "issues"];
  const csv = [cols.join(",")]
    .concat(slim.map((r) => cols.map((c) => JSON.stringify(Array.isArray(r[c]) ? r[c].join("|") : (r[c] ?? ""))).join(",")))
    .join("\n");
  fs.writeFileSync(path.join(OUT, "seo-audit.csv"), "﻿" + csv);

  const summary = [
    `# SEO 감사 요약 (${new Date().toISOString().slice(0, 10)})`,
    ``,
    `- 전체 프리렌더 페이지: ${rows.length}`,
    `- 색인 대상(index): ${indexable.length} / noindex: ${noindex.length}`,
    `- 이슈 있는 페이지: ${withIssues.length}`,
    `- /services 내부링크 수: ${services ? services.internalLinkCount : "-"}`,
    ``,
    `## 이슈 상위`,
    ...withIssues.slice(0, 30).map((r) => `- ${r.url} → ${r.issues.join(", ")}`),
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "seo-summary.md"), summary);

  console.log(`[seo:audit] 페이지 ${rows.length} | index ${indexable.length} | noindex ${noindex.length} | 이슈 ${withIssues.length}`);
  if (services) console.log(`[seo:audit] /services 내부링크: ${services.internalLinkCount}`);
  for (const r of withIssues.slice(0, 15)) console.log(`  ! ${r.url}: ${r.issues.join(", ")}`);
  console.log(`[seo:audit] 리포트: reports/seo-audit.json · seo-audit.csv · seo-summary.md`);
}

main();
