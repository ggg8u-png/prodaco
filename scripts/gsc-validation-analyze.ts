// GSC 유효성 검사 상세(테이블.csv: URL·최종 크롤링·상태) × 현재 색인 판정 교차 분석.
//   목적: "크롤링됨-미색인" 각 URL 이 ① noindex 배포(7/1) 전/후 언제 크롤됐는지
//        ② 현재 Tier(A=색인 원함 / B=noindex) 무엇인지 → 잔상 vs 실제 거절 분리.
// 실행: node scripts/ts-run.mjs scripts/gsc-validation-analyze.ts <테이블.csv 경로>
import fs from "node:fs";
import path from "node:path";
import { indexabilityFor } from "@/lib/seo/indexability";
import { getKeywordBySlug } from "@/data/keywords";

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error("사용법: node scripts/ts-run.mjs scripts/gsc-validation-analyze.ts <테이블.csv>");
  process.exit(1);
}
const DEPLOY_CUT = "2026-07-01"; // noindex 티어링 색인 반영 관측일(GSC 색인 724→139)

const OUT = path.join(process.cwd(), "reports", "google-crawled-not-indexed.csv");

interface Row { url: string; lastCrawl: string; state: string; tier: string; routeType: string; indexableNow: boolean | null }

const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/).filter(Boolean).slice(1);
const rows: Row[] = [];
for (const line of lines) {
  const [url, lastCrawl, state] = line.split(",");
  if (!url?.startsWith("http")) continue;
  let slug = "";
  try { slug = decodeURIComponent(new URL(url).pathname.replace(/^\//, "")); } catch { continue; }
  let tier = "static", routeType = "static";
  let indexableNow: boolean | null = null;
  if (slug.startsWith("services/")) { routeType = "region-hub"; tier = "hub(A)"; indexableNow = true; }
  else if (slug.startsWith("blog/")) { routeType = "blog"; tier = "blog(A)"; indexableNow = true; }
  else if (slug && !slug.includes("/")) {
    const k = getKeywordBySlug(slug);
    if (k) {
      const ix = indexabilityFor(k);
      tier = ix.tier; routeType = k.type; indexableNow = ix.indexable && ix.inSitemap;
    } else { tier = "C(미존재)"; routeType = "unknown"; indexableNow = false; }
  } else if (slug === "") { routeType = "home"; tier = "A"; indexableNow = true; }
  rows.push({ url, lastCrawl: lastCrawl || "", state: state || "", tier, routeType, indexableNow });
}

// 교차표: 크롤 시점(배포 전/후) × 현재 의도(색인 원함 A / noindex B)
const buckets: Record<string, Row[]> = {};
for (const r of rows) {
  const when = !r.lastCrawl ? "날짜없음" : r.lastCrawl < DEPLOY_CUT ? "배포 전 크롤" : "배포 후 크롤";
  const intent = r.indexableNow === true ? "현재 색인 대상(A)" : r.indexableNow === false && r.tier.startsWith("B") ? "현재 noindex(B)" : r.tier === "C(미존재)" ? "미존재(C)" : r.indexableNow === false ? "기타 제외" : "판정 불가";
  const key = `${when} × ${intent}`;
  (buckets[key] ||= []).push(r);
}
console.log(`총 ${rows.length}건 · 검증 상태 분포:`, Object.entries(rows.reduce((a: Record<string, number>, r) => { a[r.state] = (a[r.state] || 0) + 1; return a; }, {})).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log(`\n크롤 시점(${DEPLOY_CUT} 기준) × 현재 색인 의도:`);
for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${k}: ${v.length}건`);
}

// 실행 가능한 핵심 목록: 배포 후에도 크롤됐는데 색인 거절된 '현재 색인 대상' URL
const actionable = rows.filter((r) => r.indexableNow === true && r.lastCrawl >= DEPLOY_CUT);
console.log(`\n★ 배포 후 크롤 + 현재 색인 대상인데 미색인(실질 거절): ${actionable.length}건`);
const byType: Record<string, number> = {};
for (const r of actionable) byType[r.routeType] = (byType[r.routeType] || 0) + 1;
console.log("   유형:", Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log("   표본 12건:");
for (const r of actionable.slice(0, 12)) console.log(`   - ${decodeURIComponent(r.url).replace("https://prodaco.kr", "")} (크롤 ${r.lastCrawl})`);

// 크롤 날짜 분포(월-일 단위 집계)
const byDate: Record<string, number> = {};
for (const r of rows) byDate[r.lastCrawl || "없음"] = (byDate[r.lastCrawl || "없음"] || 0) + 1;
const dates = Object.entries(byDate).sort();
console.log(`\n최종 크롤 날짜 범위: ${dates[0][0]} ~ ${dates[dates.length - 1][0]}`);
const after = rows.filter((r) => r.lastCrawl >= DEPLOY_CUT).length;
console.log(`배포 전 크롤 ${rows.length - after}건 · 배포 후 크롤 ${after}건`);

// 리포트 갱신(전체 컬럼)
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, "﻿" + [
  "url,last_crawled,validation_state,crawled_vs_deploy,route_type,current_tier,indexable_now",
  ...rows.map((r) => [r.url, r.lastCrawl, r.state, r.lastCrawl < DEPLOY_CUT ? "before" : "after", r.routeType, r.tier, String(r.indexableNow)].join(",")),
].join("\n"), "utf8");
console.log(`\n→ reports/google-crawled-not-indexed.csv 갱신(${rows.length}건, 검증상태·크롤시점 포함)`);
