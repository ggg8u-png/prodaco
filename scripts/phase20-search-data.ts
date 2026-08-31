// PHASE 20 — 저장소에 실제 존재하는 GSC export만 사용한다. 추정치·Naver 가상 데이터는 만들지 않는다.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getKeywordBySlug } from "@/data/keywords";
import { indexabilityFor } from "@/lib/seo/indexability";

const root = process.cwd();
const gscDir = path.join(root, "content", "gsc");
const outputDir = path.join(root, "reports");
const performanceFile = path.join(gscDir, "performance-pages-2026-07-13.csv");
const crawledFile = path.join(gscDir, "crawled-not-indexed-2026-07-27.csv");
const reasonsFile = path.join(gscDir, "coverage-reasons-2026-08-05.csv");
const dailyFile = path.join(gscDir, "coverage-daily-2026-08-05.csv");
const siteUrl = "https://prodaco.kr";

function parseCsv(file: string): Record<string, string>[] {
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quoted) { if (c === '"') { if (raw[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r" || c === "\n") { if (c === "\r" && raw[i + 1] === "\n") i++; row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(header.map((h, i) => [h.trim(), (values[i] || "").trim()])));
}

const pick = (row: Record<string, string>, ...keys: string[]) => keys.map((key) => row[key]).find((value) => value !== undefined) || "";
const numberOf = (value: string) => Number.parseFloat(value.replace(/[%,\s]/g, "")) || 0;
const csv = (value: unknown) => { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
const normalizedText = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();

const lastmod = JSON.parse(fs.readFileSync(path.join(root, "content", "lastmod.json"), "utf8")) as Record<string, any>;
function routeInfo(url: string) {
  const pathname = decodeURIComponent(new URL(url).pathname).replace(/^\//, "").replace(/\/$/, "");
  const segments = pathname ? pathname.split("/") : [];
  let routeType = "static", tier = "", intendedIndex = "";
  if (!pathname) routeType = "home";
  else if (pathname.startsWith("blog/")) routeType = "blog";
  else if (pathname === "blog") routeType = "blog-hub";
  else if (pathname.startsWith("gallery/")) routeType = "gallery";
  else if (pathname === "gallery") routeType = "gallery-hub";
  else if (pathname.startsWith("services/")) routeType = "region-hub";
  else if (pathname && !pathname.includes("/")) {
    const keyword = getKeywordBySlug(pathname);
    if (keyword) { const decision = indexabilityFor(keyword); routeType = `keyword:${keyword.type}`; tier = decision.tier; intendedIndex = String(decision.indexable && decision.inSitemap); }
    else routeType = "unknown-slug";
  }
  const modified = pathname.startsWith("blog/") ? lastmod.posts?.[pathname.slice(5)]?.modified
    : pathname.startsWith("gallery/") ? lastmod.cases?.[pathname.slice(8)]?.modified
    : pathname.startsWith("services/") ? lastmod.regions?.[pathname.slice(9)] || lastmod.hubs
    : !pathname.includes("/") ? lastmod.slugs?.[pathname] || lastmod.keywords
    : lastmod.core;
  return { pathname, routeType, tier, intendedIndex, clickDepth: segments.length, lastmod: modified || "" };
}

function htmlMetrics(pathname: string) {
  const relative = pathname ? `${pathname}.html` : "index.html";
  const file = path.join(root, ".next", "server", "app", relative);
  if (!fs.existsSync(file)) return { bodyLength: "", imageCount: "", internalLinks: "", contentHash: "", robots: "", rendered: "false" };
  const html = fs.readFileSync(file, "utf8");
  const text = normalizedText(html);
  return {
    bodyLength: text.length,
    imageCount: (html.match(/<img\b/gi) || []).length,
    internalLinks: (html.match(/<a\s[^>]*href="\/(?!\/)/gi) || []).length,
    contentHash: crypto.createHash("sha256").update(text).digest("hex").slice(0, 16),
    robots: (html.match(/<meta name="robots" content="([^"]+)"/i) || [])[1] || "index,follow",
    rendered: "true",
  };
}

interface Row { url: string; source: string; lastCrawled: string; validationStatus: string; clicks: number; impressions: number; ctr: number; position: number; [key: string]: unknown }
const byUrl = new Map<string, Row>();
for (const row of parseCsv(performanceFile)) {
  const url = pick(row, "인기 페이지", "페이지");
  if (!url.startsWith(siteUrl)) continue;
  byUrl.set(url, { url, source: "gsc_performance_2026-07-13", lastCrawled: "", validationStatus: "observed_in_search", clicks: numberOf(pick(row, "클릭수")), impressions: numberOf(pick(row, "노출")), ctr: numberOf(pick(row, "CTR")) / 100, position: numberOf(pick(row, "게재 순위")) });
}
for (const row of parseCsv(crawledFile)) {
  const url = pick(row, "URL");
  if (!url.startsWith(siteUrl)) continue;
  const previous = byUrl.get(url);
  byUrl.set(url, { url, source: previous ? `${previous.source}+gsc_validation_2026-07-27` : "gsc_validation_2026-07-27", lastCrawled: pick(row, "최종 크롤링"), validationStatus: pick(row, "상태") || "historical_export", clicks: previous?.clicks || 0, impressions: previous?.impressions || 0, ctr: previous?.ctr || 0, position: previous?.position || 0 });
}

const rows = [...byUrl.values()].map((row) => ({ ...row, ...routeInfo(row.url), ...htmlMetrics(routeInfo(row.url).pathname) }));
const hashCount = new Map<string, number>();
for (const row of rows) if (row.contentHash) hashCount.set(String(row.contentHash), (hashCount.get(String(row.contentHash)) || 0) + 1);
for (const row of rows) Object.assign(row, { exactContentDuplicateCount: row.contentHash ? hashCount.get(String(row.contentHash)) || 0 : "" });

const fields = ["url", "source", "validationStatus", "lastCrawled", "routeType", "tier", "intendedIndex", "robots", "bodyLength", "exactContentDuplicateCount", "imageCount", "internalLinks", "clickDepth", "lastmod", "clicks", "impressions", "ctr", "position", "rendered"];
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "phase20-search-data.csv"), `\uFEFF${fields.join(",")}\n${rows.map((row) => fields.map((field) => csv((row as Record<string, unknown>)[field])).join(",")).join("\n")}\n`);

function average(key: "bodyLength" | "imageCount" | "internalLinks" | "clickDepth") { const values = rows.map((row) => Number(row[key])).filter(Number.isFinite); return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "n/a"; }
const performanceRows = rows.filter((row) => String(row.source).includes("performance"));
const validationRows = rows.filter((row) => String(row.source).includes("validation"));
const reasons = parseCsv(reasonsFile);
const daily = parseCsv(dailyFile);
const latestDaily = daily.at(-1) || {};
const lines = [
  "# PHASE 20 검색 데이터 분석",
  "",
  "## 데이터 범위",
  `- Google 성과 export: ${path.basename(performanceFile)} (${performanceRows.length} URL, 2026-07-13 기준 파일명).`,
  `- Google 유효성 검사 export: ${path.basename(crawledFile)} (${validationRows.length} URL, 2026-07-27 기준 파일명).`,
  `- Google coverage 요약: ${path.basename(reasonsFile)}, ${path.basename(dailyFile)}.`,
  "- Naver URL 성과·색인 export: **없음**. 네이버별 URL 지표는 판단불가.",
  "",
  "## 사실",
  `- URL 단위 조인: ${rows.length}개. 성과 관측 URL ${performanceRows.length}개, 유효성 검사 export URL ${validationRows.length}개.`,
  `- 조인 URL 평균: 본문 ${average("bodyLength")}자 · 이미지 ${average("imageCount")}장 · 내부링크 ${average("internalLinks")}개 · 클릭 깊이 ${average("clickDepth")}.`,
  `- coverage 최신 행(${pick(latestDaily, "날짜")}): 색인 생성됨 ${pick(latestDaily, "색인 생성됨") || "미기록"}, 색인 제외 ${pick(latestDaily, "색인이 생성되지 않은 페이지") || "미기록"}, 노출 ${pick(latestDaily, "노출") || "미기록"}.`,
  ...reasons.map((row) => `- coverage 사유 집계: ${pick(row, "사유")} = ${pick(row, "페이지")} 페이지.`),
  "",
  "## 강한 가능성",
  "- 유효성 검사 export의 URL은 현재 route type·robots·sitemap 의도와 교차 확인할 수 있어, 현재 색인 정책과 과거 크롤 데이터의 차이를 우선 점검하는 근거가 됩니다.",
  "- 성과 export에 노출이 기록된 URL은 해당 기간 Google 검색결과에 나타난 관측 근거가 있으나, 현재 색인 상태를 단정하지는 않습니다.",
  "",
  "## 가설",
  "- 현재 색인 대상인데 과거 유효성 검사 export에 남은 URL은 재크롤·콘텐츠 차별화·내부링크 변화 여부를 추가 데이터로 검토할 후보입니다.",
  "- 본문 길이·이미지·내부링크 지표 차이가 보이더라도 단일 원인으로 색인 결과를 설명할 수는 없습니다.",
  "",
  "## 판단불가 / 금지된 결론",
  "- `크롤링됨 - 현재 색인이 생성되지 않음`은 저품질 확정이 아닙니다. 이 export만으로 원인을 확정할 수 없습니다.",
  "- discovered/duplicate/soft 404/noindex의 URL 단위 export와 Naver index·crawl·query 데이터가 없어 해당 비교는 할 수 없습니다.",
  "- 이 분석은 noindex·삭제·canonical 변경을 제안하거나 실행하지 않습니다.",
  "",
  "## 산출물",
  "- `reports/phase20-search-data.csv`: URL별 현재 route/렌더링 지표와 Google export 조인.",
  "- 다음 분석을 위해서는 Naver Search Advisor의 URL/쿼리 export와 최신 GSC Pages·Performance export가 필요합니다.",
];
fs.writeFileSync(path.join(outputDir, "phase20-search-analysis.md"), `${lines.join("\n")}\n`);
console.log(`[phase20] Google URL ${rows.length}개 조인 · Naver export 없음 · reports/phase20-search-data.csv 생성`);
