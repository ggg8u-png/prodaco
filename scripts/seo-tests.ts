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
import { getKeywords, getKeywordBySlug } from "@/data/keywords";
import { indexabilityFor, keywordUrl, siteUrl } from "@/lib/seo/indexability";
import { uniqueTitle } from "@/lib/seo";
import { getContentForKeyword, familyOf } from "@/lib/content";
import { keyAnswerFor, keyAnswerForRegion, familyLabel } from "@/data/keyAnswer";
import { galleryItems } from "@/data/gallery";
import { entriesForGroup, SITEMAP_GROUPS, renderUrlset, renderIndex } from "@/lib/sitemap";
import robots from "@/app/robots";

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

// ── 결과 ─────────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(`[test:seo] 실패 ${errors.length} · 통과 ${passed}`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`[test:seo] 전체 통과 — ${passed}개 검증`);
