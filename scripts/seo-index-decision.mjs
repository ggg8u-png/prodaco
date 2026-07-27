#!/usr/bin/env node
/**
 * 색인 판정 산출 — 증거 기반으로 Tier A 유지/Tier B 강등을 결정하고,
 * content/seo.json 의 extraIndexSlugs(색인 허용목록)와 리포트를 생성한다.
 *
 *   node scripts/seo-index-decision.mjs            # 리포트만 (dry-run)
 *   node scripts/seo-index-decision.mjs --write    # content/seo.json 까지 갱신
 *
 * 입력(전부 실측 데이터 — 추정치를 만들어내지 않는다):
 *   reports/seo-url-audit.csv                       현재 URL별 감사 결과(사진·사례·본문)
 *   content/gsc/performance-pages-2026-07-13.csv    GSC 검색 성과(최근 3개월 클릭·노출)
 *   content/gsc/crawled-not-indexed-2026-07-27.csv  GSC 「크롤링됨-색인 안 됨」 829개
 *
 * 판정 원칙:
 *   · 본문 길이·FAQ 개수만으로는 색인을 유지하지 않는다(치환형 템플릿이라 변별력 없음).
 *   · 검증된 시공사례 / 실제 클릭 / 반복 노출 중 하나 이상이 있어야 독립 색인 대상.
 *   · 근거가 없으면 지역 허브로 신호를 모으고 noindex,follow 로 강등한다.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WRITE = process.argv.includes("--write");
const STAMP = "2026-07-27";

// ─── CSV ────────────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows.shift();
  return rows
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const decode = (u) => { try { return decodeURI(u); } catch { return u; } };

// ─── 입력 ───────────────────────────────────────────────────────────────────────
const audit = parseCsv(read("reports/seo-url-audit.csv"));

// GSC 성과 — 인기 페이지/클릭수/노출. URL 은 디코딩 형태로 정규화해 감사와 맞춘다.
const perf = new Map();
for (const r of parseCsv(read("content/gsc/performance-pages-2026-07-13.csv"))) {
  const url = decode((r["인기 페이지"] || "").trim());
  if (!url) continue;
  perf.set(url, { clicks: parseInt(r["클릭수"] || "0", 10) || 0, impressions: parseInt(r["노출"] || "0", 10) || 0 });
}

// GSC 「크롤링됨 - 현재 색인이 생성되지 않음」 — 색인 거부 이력.
const rejected = new Set(
  parseCsv(read("content/gsc/crawled-not-indexed-2026-07-27.csv"))
    .map((r) => decode((r.URL || "").trim()))
    .filter(Boolean)
);

// 지역 허브가 실제로 존재하는 지역 집합 — canonical 대상이 200 인지 보장하는 근거.
const hubRegions = new Set(
  audit.filter((r) => r.routeType === "region-hub" && r.region).map((r) => r.region)
);

// 지역 허브와 검색 의도가 사실상 동일한 총칭 품목(src/data/keywords.ts GENERIC_HUB_ITEMS 와 일치).
const GENERIC_HUB_ITEMS = new Set(["바닥재철거", "바닥철거"]);

// ─── 판정 ───────────────────────────────────────────────────────────────────────
const KEEP_THRESHOLD = 2;

function evidence(r) {
  const url = decode(r.url);
  const g = perf.get(url) || { clicks: 0, impressions: 0 };
  const photos = parseInt(r.regionPhotoCount || "0", 10) || 0;
  const hasCase = r.hasRealCase === "true";
  const signals = [];
  let score = 0;
  if (hasCase) { score += 4; signals.push("검증 시공사례 보유"); }
  if (g.clicks >= 1) { score += 3; signals.push(`실검색 클릭 ${g.clicks}회`); }
  if (g.impressions >= 3) { score += 2; signals.push(`반복 노출 ${g.impressions}회`); }
  else if (g.impressions >= 1) { score += 1; signals.push(`노출 ${g.impressions}회`); }
  if (photos >= 3) { score += 1; signals.push(`지역 사진 ${photos}장`); }
  return { score, signals, clicks: g.clicks, impressions: g.impressions, photos, hasCase };
}

const decisions = [];
for (const r of audit) {
  const url = decode(r.url);
  const ev = evidence(r);
  const type = r.routeType || "";
  const base = {
    url: r.url,
    slug: url.replace(/^https:\/\/prodaco\.kr\/?/, ""),
    page_type: type,
    region: r.region || "",
    service: r.service || "",
    previous_tier: r.tier || "",
    body_length: r.bodyChars || "",
    photo_count: ev.photos,
    has_case_study: ev.hasCase ? "true" : "false",
    unique_faq_count: r.uniqueFaqCount || "",
    impression_signal: ev.impressions || "",
    click_signal: ev.clicks || "",
    evidence_score: ev.score,
  };

  // ① 코어 정적 페이지 — 사이트 구조상 필수. 항상 색인.
  if (type === "core") {
    decisions.push({ ...base, decision: "KEEP_INDEX", new_tier: "A", index: "true", follow: "true",
      include_in_sitemap: "true", canonical_url: r.url, reason: "핵심 정적 페이지" });
    continue;
  }
  // ② 블로그 — 조합 생성물이 아닌 개별 집필 문서. 별도 평가 후 유지.
  if (type === "blog") {
    decisions.push({ ...base, decision: "KEEP_INDEX", new_tier: "A", index: "true", follow: "true",
      include_in_sitemap: "true", canonical_url: r.url, reason: "개별 집필 문서(조합 생성 아님)" });
    continue;
  }
  // ③ 지역 허브 — 강등 페이지의 canonical 수렴 대상. 색인 유지가 전제.
  if (type === "region-hub") {
    decisions.push({ ...base, decision: "KEEP_HUB", new_tier: "HUB", index: "true", follow: "true",
      include_in_sitemap: "true", canonical_url: r.url,
      reason: ev.score > 0 ? `지역 허브 · ${ev.signals.join(", ")}` : "지역 허브(강등 페이지 canonical 수렴 대상)" });
    continue;
  }

  // ④ 지역×품목 등 조합 페이지 — 증거 점수로 판정.
  if (ev.score >= KEEP_THRESHOLD) {
    // 총칭 품목(바닥재철거·바닥철거)은 지역 허브와 검색 의도가 완전히 겹친다 →
    // 색인은 유지하되 canonical 을 허브로 모으고 사이트맵에서는 뺀다(카니발라이제이션 해소).
    if (type === "keyword:region-item" && GENERIC_HUB_ITEMS.has(base.service) && hubRegions.has(base.region)) {
      decisions.push({ ...base, decision: "CANONICAL_TO_REGION_HUB", new_tier: "B", index: "true", follow: "true",
        include_in_sitemap: "false", canonical_url: `https://prodaco.kr/services/${encodeURIComponent(base.region)}`,
        reason: `${ev.signals.join(", ")} · 단 지역 허브와 의도 중복 → canonical 허브 통합` });
      continue;
    }
    decisions.push({ ...base, decision: "KEEP_INDEX", new_tier: "A", index: "true", follow: "true",
      include_in_sitemap: "true", canonical_url: r.url, reason: ev.signals.join(", ") });
    continue;
  }

  const why = [];
  if (!ev.hasCase) why.push("검증 사례 없음");
  if (ev.clicks === 0) why.push("클릭 0");
  if (ev.impressions === 0) why.push("3개월 노출 0"); else why.push(`노출 ${ev.impressions}회(임계 미만)`);
  if (rejected.has(url)) why.push("GSC 색인 거부 이력");

  // 강등은 noindex,follow + self-canonical 로 고정한다.
  // noindex 와 "다른 URL 로의 canonical"을 함께 내보내면 구글이 noindex 를 canonical
  // 대상(지역 허브)까지 옮겨 적용할 수 있어, 허브 65개가 통째로 색인에서 빠질 위험이 있다.
  // 허브로의 신호 통합은 canonical 이 아니라 follow + 내부링크(허브 링크는 이미 존재)로 처리한다.
  const toHub = base.region && hubRegions.has(base.region);
  decisions.push({ ...base, decision: "NOINDEX_SELF_CANONICAL", new_tier: "B", index: "false", follow: "true",
    include_in_sitemap: "false", canonical_url: r.url,
    reason: toHub
      ? `${why.join(", ")} · follow 로 /services/${base.region} 허브에 신호 집약`
      : `${why.join(", ")} · 지역 없음 → self-canonical 유지` });
}

// ─── GSC 에는 있으나 코드에 없는 URL(404 예정) ──────────────────────────────────
const auditUrls = new Set(audit.map((r) => decode(r.url)));
const missing = [...rejected].filter((u) => !auditUrls.has(u));

// ─── 산출 ───────────────────────────────────────────────────────────────────────
const COLUMNS = ["url", "slug", "page_type", "region", "service", "previous_tier", "new_tier", "decision",
  "index", "follow", "include_in_sitemap", "canonical_url", "body_length", "photo_count", "has_case_study",
  "unique_faq_count", "impression_signal", "click_signal", "reason", "evidence_score"];

const kept = decisions.filter((d) => d.index === "true");
const demoted = decisions.filter((d) => d.index === "false");
const manual = decisions.filter((d) => d.decision === "MANUAL_REVIEW");

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, `reports/seo-index-decision-${STAMP}.csv`), toCsv(decisions, COLUMNS), "utf8");
fs.writeFileSync(path.join(ROOT, `reports/seo-index-kept-${STAMP}.csv`), toCsv(kept, COLUMNS), "utf8");
fs.writeFileSync(path.join(ROOT, `reports/seo-index-demoted-${STAMP}.csv`), toCsv(demoted, COLUMNS), "utf8");
fs.writeFileSync(path.join(ROOT, `reports/seo-index-manual-review-${STAMP}.csv`), toCsv(manual, COLUMNS), "utf8");

// 색인 허용목록 — 조합 페이지 중 증거가 확인된 슬러그만. 허브/블로그/코어는 라우트가 처리.
const allowSlugs = decisions
  .filter((d) => d.index === "true" && d.page_type.startsWith("keyword:"))
  .map((d) => d.slug)
  .sort();

if (WRITE) {
  const seoPath = path.join(ROOT, "content/seo.json");
  const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
  seo.requireEvidenceForIndex = true;
  seo.extraIndexSlugs = allowSlugs;
  fs.writeFileSync(seoPath, JSON.stringify(seo, null, 2) + "\n", "utf8");
  console.log(`[seo:decide] content/seo.json 갱신 — extraIndexSlugs ${allowSlugs.length}개, requireEvidenceForIndex=true`);
}

const byDecision = {};
for (const d of decisions) byDecision[d.decision] = (byDecision[d.decision] || 0) + 1;

console.log(`[seo:decide] URL ${decisions.length}개 판정${WRITE ? " (적용)" : " (dry-run)"}`);
console.log(`  유지(index) ${kept.length} · 강등(noindex) ${demoted.length} · 수동검토 ${manual.length}`);
for (const [k, v] of Object.entries(byDecision).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(30)} ${v}`);
console.log(`  조합 페이지 허용목록(extraIndexSlugs): ${allowSlugs.length}개`);
if (missing.length) {
  console.log(`  코드에 없는 GSC URL(404 예정) ${missing.length}개:`);
  missing.forEach((u) => console.log(`    · ${u}`));
}
console.log(`  → reports/seo-index-{decision,kept,demoted,manual-review}-${STAMP}.csv`);
