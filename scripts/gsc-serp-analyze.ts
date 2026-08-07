// GSC 검색결과 CSV × 사이트 구조 교차 분석 — SERP 개선 대상 선별.
//
//   node scripts/ts-run.mjs scripts/gsc-serp-analyze.ts <queries.csv> [pages.csv]
//
// 입력: Search Console → 실적 → 내보내기(CSV/구글 시트) 의 표 파일.
//   · 쿼리 시트  : 상위 검색어, 클릭수, 노출수, CTR, 게재순위
//   · 페이지 시트: 인기 페이지, 클릭수, 노출수, CTR, 게재순위
//   영문 헤더(Query/Page/Clicks/Impressions/CTR/Position)도 그대로 인식한다.
//   쿼리+페이지가 한 파일에 같이 있는 형태도 허용한다(열이 둘 다 있으면 조인).
//
// 설계 원칙:
//   · "CTR 낮음"의 절대 기준을 만들지 않는다. 순위가 낮으면 CTR 이 낮은 게 정상이라
//     절대값 비교는 의미가 없다. 게재순위 구간(1~3 / 4~5 / 6~10 / 11~20)별로
//     이 사이트 자체의 CTR 분포를 구하고, 그 안에서의 하위 이상치만 뽑는다.
//   · 검색량·순위를 추정하지 않는다. CSV 에 있는 값만 쓴다.
import fs from "node:fs";
import path from "node:path";
import { getKeywords } from "@/data/keywords";
import { indexabilityFor } from "@/lib/seo/indexability";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!args.length) {
  console.error("사용법: node scripts/ts-run.mjs scripts/gsc-serp-analyze.ts <queries.csv> [pages.csv]");
  process.exit(1);
}

// ─── CSV ────────────────────────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter((r) => r.some((v) => v !== "")).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}

const pick = (r: Record<string, string>, ...names: string[]): string => {
  for (const n of names) for (const k of Object.keys(r)) if (k.replace(/\s/g, "") === n.replace(/\s/g, "")) return r[k];
  return "";
};
const num = (s: string): number => parseFloat(String(s).replace(/[%,\s]/g, "")) || 0;

interface Row { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }

function load(file: string): Row[] {
  return parseCsv(fs.readFileSync(file, "utf8")).map((r) => {
    const imp = num(pick(r, "노출수", "노출", "Impressions"));
    const clicks = num(pick(r, "클릭수", "클릭", "Clicks"));
    // CTR 은 CSV 표기가 "12.5%" / "0.125" 로 갈린다. 클릭/노출로 직접 계산해 통일한다.
    return {
      query: pick(r, "상위 검색어", "검색어", "쿼리", "Query", "Top queries"),
      page: pick(r, "인기 페이지", "페이지", "Page", "Top pages"),
      clicks, impressions: imp,
      ctr: imp > 0 ? clicks / imp : 0,
      position: num(pick(r, "게재순위", "평균 게재순위", "Position", "Average position")),
    };
  }).filter((r) => r.impressions > 0);
}

const rows = args.flatMap(load);
if (!rows.length) { console.error("파싱된 행이 없습니다. CSV 헤더를 확인하세요."); process.exit(1); }

// ─── 게재순위 구간별 자체 CTR 분포 ──────────────────────────────────────────────
const BUCKETS: Array<[string, (p: number) => boolean]> = [
  ["1~3위", (p) => p > 0 && p <= 3],
  ["4~5위", (p) => p > 3 && p <= 5],
  ["6~10위", (p) => p > 5 && p <= 10],
  ["11~20위", (p) => p > 10 && p <= 20],
  ["21위+", (p) => p > 20],
];
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const quantile = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) * q)] : 0; };

console.log(`행 ${rows.length}개 · 노출 합계 ${rows.reduce((a, r) => a + r.impressions, 0)} · 클릭 합계 ${rows.reduce((a, r) => a + r.clicks, 0)}\n`);
console.log("게재순위 구간별 자체 CTR 분포(이 사이트 기준 — 외부 벤치마크 쓰지 않음)");
const bucketStats = new Map<string, { rows: Row[]; med: number; p25: number }>();
for (const [label, test] of BUCKETS) {
  const rs = rows.filter((r) => test(r.position));
  if (!rs.length) continue;
  const ctrs = rs.map((r) => r.ctr);
  const st = { rows: rs, med: median(ctrs), p25: quantile(ctrs, 0.25) };
  bucketStats.set(label, st);
  console.log(`  ${label.padEnd(8)} n=${String(rs.length).padStart(4)} · 노출 ${String(rs.reduce((a, r) => a + r.impressions, 0)).padStart(6)} · CTR 중앙 ${(st.med * 100).toFixed(1)}% · 하위25% ${(st.p25 * 100).toFixed(1)}%`);
}

// ─── ① 구간 내 CTR 하위 이상치 + 노출 상위 ─────────────────────────────────────
console.log("\n★ SERP 개선 후보 — 같은 순위대인데 이 사이트 하위 25% CTR (노출 많은 순)");
const candidates: Array<Row & { bucket: string; med: number }> = [];
for (const [label, st] of bucketStats) {
  for (const r of st.rows) if (r.ctr <= st.p25 && r.impressions >= 5) candidates.push({ ...r, bucket: label, med: st.med });
}
candidates.sort((a, b) => b.impressions - a.impressions);
for (const c of candidates.slice(0, 25)) {
  const who = c.page ? decodeURIComponent(c.page).replace("https://prodaco.kr", "") : `"${c.query}"`;
  console.log(`  [${c.bucket}] 노출 ${String(c.impressions).padStart(4)} · CTR ${(c.ctr * 100).toFixed(1)}% (구간중앙 ${(c.med * 100).toFixed(1)}%) · 순위 ${c.position.toFixed(1)}  ${who}`);
}
if (!candidates.length) console.log("  없음");

// ─── ② 상위 노출인데 클릭 0 ────────────────────────────────────────────────────
const zero = rows.filter((r) => r.clicks === 0 && r.impressions >= 10).sort((a, b) => b.impressions - a.impressions);
console.log(`\n★ 노출 10+ 인데 클릭 0: ${zero.length}건`);
for (const r of zero.slice(0, 15)) console.log(`  노출 ${String(r.impressions).padStart(4)} · 순위 ${r.position.toFixed(1)}  ${r.page ? decodeURIComponent(r.page).replace("https://prodaco.kr", "") : `"${r.query}"`}`);

// ─── ③ 같은 쿼리에 여러 URL(카니발라이제이션 실측) ─────────────────────────────
const byQuery = new Map<string, Set<string>>();
for (const r of rows) if (r.query && r.page) (byQuery.get(r.query) || byQuery.set(r.query, new Set()).get(r.query))!.add(r.page);
const multi = [...byQuery.entries()].filter(([, v]) => v.size > 1);
console.log(`\n★ 같은 검색어에 여러 URL 노출: ${multi.length}건 (4차 카니발라이제이션 판정과 대조할 실측 근거)`);
for (const [q, urls] of multi.slice(0, 10)) console.log(`  "${q}" → ${[...urls].map((u) => decodeURIComponent(u).replace("https://prodaco.kr", "")).join(" / ")}`);

// ─── ④ 쿼리 유형 분류 ──────────────────────────────────────────────────────────
const regions = new Set(getKeywords().filter((k) => k.region).map((k) => k.region as string));
const items = new Set(getKeywords().filter((k) => k.item).map((k) => k.item as string));
const classify = (q: string): string => {
  if (!q) return "-";
  if (/프로다|prodaco/i.test(q)) return "브랜드";
  const hasR = [...regions].some((r) => q.includes(r));
  const hasI = [...items].some((i) => q.includes(i.replace("철거", ""))) || /철거|샌딩|면갈이/.test(q);
  if (hasR && hasI) return "지역×품목";
  if (hasR) return "지역";
  if (hasI) return "품목";
  return "기타";
};
const qRows = rows.filter((r) => r.query);
if (qRows.length) {
  const stats = new Map<string, { n: number; imp: number; clicks: number }>();
  for (const r of qRows) {
    const k = classify(r.query);
    const s = stats.get(k) || { n: 0, imp: 0, clicks: 0 };
    s.n++; s.imp += r.impressions; s.clicks += r.clicks;
    stats.set(k, s);
  }
  console.log("\n쿼리 유형별");
  for (const [k, s] of [...stats.entries()].sort((a, b) => b[1].imp - a[1].imp))
    console.log(`  ${k.padEnd(10)} 쿼리 ${String(s.n).padStart(4)} · 노출 ${String(s.imp).padStart(6)} · 클릭 ${String(s.clicks).padStart(4)} · CTR ${s.imp ? (s.clicks / s.imp * 100).toFixed(1) : "0.0"}%`);
}

// ─── ⑤ 노출되는데 색인 대상이 아닌 URL(정책 불일치 실측) ───────────────────────
const indexed = new Set(getKeywords().filter((k) => indexabilityFor(k).inSitemap).map((k) => k.slug));
const pageRows = rows.filter((r) => r.page);
const notIndexed = pageRows.filter((r) => {
  const slug = decodeURIComponent(r.page).replace(/^https:\/\/prodaco\.kr\/?/, "").replace(/\/$/, "");
  if (!slug || slug.includes("/")) return false;
  return getKeywords().some((k) => k.slug === slug) && !indexed.has(slug);
});
if (notIndexed.length) {
  console.log(`\n⚠ 검색 노출 중인데 현재 noindex 인 URL: ${notIndexed.length}건 — 티어 재판정 근거`);
  for (const r of notIndexed.sort((a, b) => b.impressions - a.impressions).slice(0, 15))
    console.log(`  노출 ${String(r.impressions).padStart(4)} · 클릭 ${r.clicks} · ${decodeURIComponent(r.page).replace("https://prodaco.kr/", "")}`);
}

// ─── 산출 ──────────────────────────────────────────────────────────────────────
fs.mkdirSync(path.join(process.cwd(), "reports"), { recursive: true });
const out = path.join(process.cwd(), "reports", "gsc-serp-candidates.csv");
const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.writeFileSync(
  out,
  "bucket,query,page,impressions,clicks,ctr,position,bucket_median_ctr\n" +
    candidates.map((c) => [c.bucket, c.query, c.page, c.impressions, c.clicks, c.ctr.toFixed(4), c.position.toFixed(1), c.med.toFixed(4)].map(esc).join(",")).join("\n") + "\n"
);
console.log(`\n→ ${out}`);
