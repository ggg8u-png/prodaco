import fs from "node:fs";
import path from "node:path";
import { entriesForGroup, nonEmptyGroups, renderIndex, renderUrlset, SITEMAP_GROUPS } from "@/lib/sitemap";

const URL_LIMIT = 50_000;
const BYTE_LIMIT = 50 * 1024 * 1024;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const failures: string[] = [];
const rows: string[] = [];
const allLocs: string[] = [];

for (const group of SITEMAP_GROUPS) {
  const entries = entriesForGroup(group);
  const xml = renderUrlset(entries);
  const bytes = Buffer.byteLength(xml, "utf8");
  const unique = new Set(entries.map((e) => e.loc));
  const stable = xml === renderUrlset(entriesForGroup(group));
  const datesValid = entries.every((e) => DATE_RE.test(e.lastmod));
  const urlsValid = entries.every((e) => {
    try { const u = new URL(e.loc); return u.protocol === "https:" && !u.hash; } catch { return false; }
  });
  if (entries.length > URL_LIMIT) failures.push(`${group}: URL ${entries.length} > ${URL_LIMIT}`);
  if (bytes > BYTE_LIMIT) failures.push(`${group}: XML ${bytes} bytes > ${BYTE_LIMIT}`);
  if (unique.size !== entries.length) failures.push(`${group}: 그룹 내부 중복 ${entries.length - unique.size}`);
  if (!stable) failures.push(`${group}: 동일 입력 반복 생성 결과 불일치`);
  if (!datesValid) failures.push(`${group}: 잘못된 lastmod`);
  if (!urlsValid) failures.push(`${group}: 잘못된 URL`);
  allLocs.push(...entries.map((e) => e.loc));
  rows.push(`| ${group} | ${entries.length} | ${(bytes / 1024).toFixed(1)} KB | ${stable ? "PASS" : "FAIL"} | ${datesValid ? "PASS" : "FAIL"} |`);
}

const duplicateAcrossGroups = allLocs.length - new Set(allLocs).size;
if (duplicateAcrossGroups) failures.push(`그룹 간 중복 URL ${duplicateAcrossGroups}`);

const indexA = renderIndex();
const indexB = renderIndex();
if (indexA !== indexB) failures.push("sitemap index 반복 생성 결과 불일치");
const groups = nonEmptyGroups();
for (const group of groups) {
  const entries = entriesForGroup(group.group);
  const newest = entries.map((e) => e.lastmod).sort().slice(-1)[0];
  if (group.lastmod !== newest) failures.push(`${group.group}: index lastmod가 하위 최신일과 불일치`);
}

const report = [
  "# PHASE 10 Sitemap 감사", "",
  `- sitemap index 하위 그룹: ${groups.length}개`,
  `- 전체 URL: ${allLocs.length}개`,
  `- 그룹 간 중복: ${duplicateAcrossGroups}개`,
  `- 제한: sitemap당 ${URL_LIMIT.toLocaleString()} URL / 50 MB(비압축)`,
  `- 반복 생성 안정성: ${indexA === indexB ? "PASS" : "FAIL"}`,
  `- 위반: ${failures.length}건`, "",
  "## 그룹별 현황", "",
  "| 그룹 | URL | XML 크기 | 반복 생성 | lastmod |",
  "|---|---:|---:|---|---|", ...rows, "",
  "## 포함·품질 게이트", "",
  "- `indexabilityFor`가 index/self-canonical/inSitemap 판정의 단일 출처다.",
  "- `seo:quality`가 title, description, canonical, 유효 토큰, 본문 품질, 중복을 검사한다.",
  "- `seo:validate-index`가 404, noindex, canonical 대상·루프·체인, sitemap 누락·혼입을 검사한다.",
  "- 품질 미달 URL은 삭제하지 않고 noindex 또는 sitemap 제외 상태로 유지하며 보고한다.",
  "- lastmod는 콘텐츠·Git 변경일을 사용하고 빌드 시각을 일괄 주입하지 않는다.", "",
  "## 위반 상세", "",
  ...(failures.length ? failures.map((f) => `- FAIL: ${f}`) : ["- 없음"]), "",
].join("\n");

fs.mkdirSync(path.join(process.cwd(), "reports"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "reports", "phase10-sitemap-audit.md"), report, "utf8");
console.log(`[phase10-sitemap-audit] group ${groups.length} · URL ${allLocs.length} · violation ${failures.length}`);
if (failures.length) process.exit(1);
