#!/usr/bin/env node
/**
 * 라이브(prodaco.kr) vs 로컬 빌드 SEO diff — 배포 직후 반영 여부를 실제로 확인한다.
 *
 *   npm run verify:live                 # 기본 표본(≈30 URL)
 *   npm run verify:live -- --all        # 사이트맵 전체
 *   npm run verify:live -- --base https://deploy-preview-x--site.netlify.app
 *
 * 왜 필요한가:
 *   1~8차 SEO 작업은 전부 코드 레벨에서 검증했지만, "실제 배포본이 그 코드를 서빙하는가"는
 *   별개 문제다. 빌드가 성공해도 배포 캐시·CDN·환경변수 때문에 라이브가 다를 수 있다.
 *   특히 이번 작업의 핵심 변경은 라이브에서만 최종 확인된다:
 *     · 사이트맵 lastmod 가 2026-06-23 고정에서 실제 변경일로 바뀌었는가
 *     · 지역 허브 41개가 noindex 로 내려갔는가(SUPPORT)
 *     · 지역 페이지가 가짜 지점 주소(addressRegion: 강남) 를 더 이상 내보내지 않는가
 *     · meta keywords 가 사라졌는가 / RSS link 가 생겼는가
 *     · title 접미가 페이지 의도와 맞는가
 *
 * 비교 기준은 .next/server/app 의 로컬 빌드 산출물이다. 먼저 next build 를 돌려 둘 것.
 */
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const BASE = (argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "https://prodaco.kr").replace(/\/$/, "");
const ALL = argv.includes("--all");
const ROOT = ".next/server/app";

if (!fs.existsSync(ROOT)) {
  console.error("로컬 빌드 산출물이 없습니다. 먼저 `npx next build` 를 실행하세요.");
  process.exit(1);
}

// ─── 로컬 산출물에서 필드 추출 ──────────────────────────────────────────────────
const field = (html, re) => { const m = html.match(re); return m ? m[1].trim() : ""; };
function extract(html) {
  const types = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try {
      const o = JSON.parse(m[1].replace(/&quot;/g, '"'));
      const walk = (v) => { if (!v) return; if (Array.isArray(v)) return v.forEach(walk); if (v["@type"]) types.push(v["@type"]); if (v["@graph"]) walk(v["@graph"]); };
      walk(o);
    } catch { types.push("PARSE_ERROR"); }
  }
  return {
    title: field(html, /<title>(.*?)<\/title>/s),
    description: field(html, /<meta name="description" content="([^"]*)"/),
    h1: field(html, /<h1[^>]*>(.*?)<\/h1>/s).replace(/<[^>]+>/g, "").trim(),
    canonical: decodeURIComponent(field(html, /<link rel="canonical" href="([^"]*)"/)),
    robots: field(html, /<meta name="robots" content="([^"]*)"/) || "(기본)",
    schema: [...new Set(types)].sort().join(","),
    metaKeywords: field(html, /<meta name="keywords" content="([^"]*)"/),
    rssLink: /rel="alternate"[^>]*application\/rss\+xml/.test(html) ? "있음" : "없음",
    // 가짜 지점 신호 — 지역명이 주소 필드에 들어갔는지.
    fakeBranch: /"addressRegion":"(?!경기도")[^"]+"/.test(html) ? "의심" : "없음",
  };
}

function localHtml(slug) {
  const f = path.join(ROOT, (slug === "" ? "index" : slug) + ".html");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
}

// ─── 대상 URL 선정 ──────────────────────────────────────────────────────────────
const smDir = path.join(ROOT, "sitemaps");
const sitemapSlugs = [];
if (fs.existsSync(smDir)) {
  for (const f of fs.readdirSync(smDir).filter((x) => x.endsWith(".xml.body")))
    for (const m of fs.readFileSync(path.join(smDir, f), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g))
      sitemapSlugs.push(decodeURIComponent(m[1]).replace("https://prodaco.kr", "").replace(/^\//, ""));
}
const pickN = (arr, n) => arr.filter((_, i) => i % Math.max(1, Math.ceil(arr.length / n)) === 0).slice(0, n);
const targets = ALL
  ? sitemapSlugs
  : [
      "",
      ...pickN(sitemapSlugs.filter((s) => s.startsWith("services/")), 5),
      ...pickN(sitemapSlugs.filter((s) => !s.includes("/") && s && !["gallery", "reviews", "faq", "blog", "services"].includes(s)), 13),
      ...pickN(sitemapSlugs.filter((s) => s.startsWith("blog/")), 3),
      "gallery", "reviews", "faq", "services",
    ].filter((s, i, a) => a.indexOf(s) === i);

// ─── 라이브 요청 ────────────────────────────────────────────────────────────────
async function fetchText(url) {
  try {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": "prodaco-verify-live/1.0" } });
    const body = res.status >= 200 && res.status < 300 ? await res.text() : "";
    return { status: res.status, location: res.headers.get("location") || "", body };
  } catch (e) {
    return { status: 0, error: String(e.message || e), body: "" };
  }
}

const FIELDS = ["title", "description", "h1", "canonical", "robots", "schema", "metaKeywords", "rssLink", "fakeBranch"];

(async () => {
  console.log(`대상 ${targets.length}개 · base ${BASE}\n`);

  // 먼저 robots.txt / sitemap.xml 부터 — 여기서 막히면 나머지는 볼 필요가 없다.
  const robots = await fetchText(`${BASE}/robots.txt`);
  // 네트워크 차단(사내 프록시·egress 정책)은 '페이지가 바뀌었다'가 아니라 '볼 수 없다'이다.
  // 403/407 을 URL 별 불일치로 세면 리포트가 통째로 거짓이 되므로 여기서 끊는다.
  if (robots.status === 0 || robots.status === 403 || robots.status === 407) {
    console.error(`❌ 라이브에 접근할 수 없습니다 (robots.txt HTTP ${robots.status}${robots.error ? ` · ${robots.error}` : ""}).`);
    console.error("   프록시/방화벽이 막고 있을 가능성이 큽니다. 외부 네트워크가 되는 환경에서 실행하세요.");
    console.error("   사이트가 실제로 403 을 준다면 그것 자체가 심각한 문제이므로 브라우저로 먼저 확인하세요.");
    process.exit(2);
  }
  console.log(`robots.txt  HTTP ${robots.status} · Yeti 허용 ${/Yeti/.test(robots.body) ? "✅" : "❌"} · sitemap 선언 ${/Sitemap:/.test(robots.body) ? "✅" : "❌"}`);

  const smIndex = await fetchText(`${BASE}/sitemap.xml`);
  const liveLocs = [...smIndex.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log(`sitemap.xml HTTP ${smIndex.status} · 하위 sitemap ${liveLocs.length}개`);

  // 하위 sitemap 을 모두 받아 lastmod 를 확인한다(1차 핵심 변경).
  let liveUrlCount = 0;
  const lastmods = new Set();
  for (const loc of liveLocs) {
    const sub = await fetchText(loc);
    liveUrlCount += (sub.body.match(/<url>/g) || []).length;
    for (const m of sub.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) lastmods.add(m[1]);
  }
  const localUrlCount = sitemapSlugs.length;
  console.log(`사이트맵 URL  라이브 ${liveUrlCount} vs 로컬 ${localUrlCount}  ${liveUrlCount === localUrlCount ? "✅ MATCH" : "❌ MISMATCH"}`);
  console.log(`lastmod 값   ${[...lastmods].sort().join(", ") || "(없음)"}`);
  if (lastmods.has("2026-06-23") && lastmods.size <= 2)
    console.log("  ⚠ 고정 상수 2026-06-23 이 그대로입니다 — 1차 lastmod 수정이 라이브에 반영되지 않았습니다.");

  // ─── 페이지 단위 diff ─────────────────────────────────────────────────────────
  console.log("\nURL 별 비교");
  const mismatches = [];
  const blocked = {};
  let checked = 0, missingLocal = 0;
  for (const slug of targets) {
    const lh = localHtml(slug);
    if (!lh) { missingLocal++; continue; }
    const live = await fetchText(`${BASE}/${slug.split("/").map(encodeURIComponent).join("/")}`);
    checked++;
    if (live.status !== 200) {
      blocked[live.status] = (blocked[live.status] || 0) + 1;
      mismatches.push({ slug, field: "status", local: "200", live: `${live.status}${live.location ? ` → ${live.location}` : ""}` });
      continue;
    }
    const L = extract(lh), R = extract(live.body);
    for (const f of FIELDS) if (L[f] !== R[f]) mismatches.push({ slug, field: f, local: L[f], live: R[f] });
  }

  // 같은 비정상 상태코드가 절반 이상이면 개별 불일치가 아니라 접근 차단이다.
  const worstStatus = Object.entries(blocked).sort((a, b) => b[1] - a[1])[0];
  if (worstStatus && worstStatus[1] >= checked * 0.5) {
    console.error(`\n❌ 검사한 ${checked}개 중 ${worstStatus[1]}개가 HTTP ${worstStatus[0]} 입니다 — 개별 페이지 문제가 아니라 접근이 막힌 상태로 판단합니다.`);
    console.error("   이 결과를 '라이브 불일치'로 해석하지 마세요. 네트워크가 되는 환경에서 다시 실행해야 합니다.");
    process.exit(2);
  }

  const byField = {};
  for (const m of mismatches) byField[m.field] = (byField[m.field] || 0) + 1;
  console.log(`  검사 ${checked}개 · 로컬에 없음 ${missingLocal}개 · 불일치 ${mismatches.length}건`);
  if (mismatches.length) {
    console.log("  필드별:", JSON.stringify(byField));
    console.log("\n  불일치 상세(최대 20):");
    for (const m of mismatches.slice(0, 20)) {
      console.log(`    /${m.slug}  [${m.field}]`);
      console.log(`      LOCAL: ${String(m.local).slice(0, 100)}`);
      console.log(`      LIVE : ${String(m.live).slice(0, 100)}`);
    }
  } else {
    console.log("  ✅ 전 항목 MATCH — 로컬 빌드가 라이브에 그대로 반영돼 있습니다.");
  }

  fs.mkdirSync("reports", { recursive: true });
  const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  fs.writeFileSync(
    "reports/verify-live.csv",
    "slug,field,local,live\n" + mismatches.map((m) => [m.slug, m.field, m.local, m.live].map(esc).join(",")).join("\n") + "\n"
  );
  console.log("\n→ reports/verify-live.csv");
  process.exit(mismatches.length ? 1 : 0);
})();
