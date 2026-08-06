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
import { uniqueTitle, pickFaqs, faqMatchesItem } from "@/lib/seo";
import { getContentForKeyword, familyOf } from "@/lib/content";
import { keyAnswerFor, keyAnswerForRegion, familyLabel } from "@/data/keyAnswer";
import { galleryItems } from "@/data/gallery";
import { entriesForGroup, SITEMAP_GROUPS, renderUrlset, renderIndex, nonEmptyGroups, SITE_LASTMOD } from "@/lib/sitemap";
import robots from "@/app/robots";
import { itemGuidesFor } from "@/lib/itemGuides";

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

// ── ⑧-2 lastmod 회귀 방지 ────────────────────────────────────────────────────
// 2026-06-23 고정 상수를 그대로 내보내면서 7월 콘텐츠 개편을 전부 진행한 적이 있다.
// 사이트맵이 "안 바뀜"을 알리는 동안 GSC 색인 수는 139에서 5주간 멈춰 있었다.
// content/lastmod.json(빌드 전 생성)이 있는데도 폴백 상수가 나오면 배선이 끊긴 것이다.
{
  const hasMap = fs.existsSync(path.join(process.cwd(), "content", "lastmod.json"));
  const all = SITEMAP_GROUPS.flatMap((g) => entriesForGroup(g));
  ok(all.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.lastmod)), "사이트맵 lastmod 전부 YYYY-MM-DD");
  if (hasMap) {
    const stale = all.filter((e) => e.lastmod === SITE_LASTMOD && !e.loc.includes("/blog/"));
    ok(
      stale.length === 0,
      "lastmod.json 이 있으면 폴백 상수(SITE_LASTMOD)가 남지 않음",
      `잔존 ${stale.length}건 ${stale.slice(0, 3).map((e) => decodeURIComponent(e.loc)).join(", ")}`
    );
  }
  // 하위 sitemap 의 인덱스 lastmod 는 그 안의 최신 항목과 같아야 한다.
  for (const g of nonEmptyGroups()) {
    const entries = entriesForGroup(g.group);
    const newestInGroup = entries.map((e) => e.lastmod).sort().slice(-1)[0];
    ok(g.lastmod === newestInGroup, `sitemap index lastmod = ${g.group} 최신 항목`, `${g.lastmod} vs ${newestInGroup}`);
  }
}

// ── ⑧-3 품목 정보형 페이지 내부링크 ──────────────────────────────────────────
// 마루철거-비용·바닥철거-비용 같은 상업 의도 최상위 페이지가 색인 대상인데도
// /services 한 곳에서만 링크를 받고 있었다(지역 페이지는 70~90개). 링크가 안 모이면
// 색인 대상이어도 크롤·평가 우선순위에서 밀린다. 같은 품목 지역 페이지가 반드시
// 역링크를 걸도록 고정한다.
{
  const tierATails = keywords.filter((k) => k.type === "item-tail" && indexabilityFor(k).inSitemap);
  ok(tierATails.length > 0, "Tier A 품목 정보형 페이지 존재", `${tierATails.length}개`);
  const starved: string[] = [];
  for (const tail of tierATails) {
    // 같은 품목의 지역 페이지(색인 여부 무관 — noindex,follow 도 링크는 전달한다)가
    // 이 정보형 페이지를 링크 대상으로 잡는지 확인.
    const linkers = keywords.filter(
      (k) => k.type === "region-item" && k.item === tail.item && itemGuidesFor(k.item, k.slug).some((g) => g.slug === tail.slug)
    );
    if (linkers.length === 0) starved.push(tail.slug);
  }
  ok(starved.length === 0, "Tier A 품목 정보형 페이지가 지역 페이지에서 역링크 수신", `고립 ${starved.length}건 ${starved.slice(0, 5).join(", ")}`);
  // 사장님 지정 핵심 품목 — 마루철거·바닥철거는 정보형 페이지가 반드시 살아 있어야 한다.
  for (const item of ["마루철거", "바닥철거"]) {
    const guides = keywords.filter((k) => k.type === "item-tail" && k.item === item && indexabilityFor(k).inSitemap);
    ok(guides.length >= 2, `${item} 정보형 색인 페이지 2개 이상`, `${guides.length}개`);
  }
}

// ── ⑧-4 수동 승인 슬러그 보존 ────────────────────────────────────────────────
// seo:decide --write 가 extraIndexSlugs 를 통째로 재생성한다. 예전에는 수동 승인을
// 같은 배열에 넣어 두어서, 재실행 한 번에 7/28 승인 7건이 조용히 사라지는 상태였다.
// 운영자 승인은 manualIndexSlugs 에 두고, 실제로 Tier A 로 살아 있어야 한다.
{
  const seoJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "seo.json"), "utf8")) as {
    extraIndexSlugs?: string[];
    manualIndexSlugs?: string[];
  };
  const manual = seoJson.manualIndexSlugs || [];
  const auto = seoJson.extraIndexSlugs || [];
  ok(manual.length > 0, "manualIndexSlugs 존재(운영자 승인 목록)", `${manual.length}개`);
  const overlap = manual.filter((s) => auto.includes(s));
  ok(overlap.length === 0, "수동 승인이 자동 재생성 배열과 겹치지 않음", `중복 ${overlap.join(", ")}`);
  const notLive = manual.filter((s) => {
    const k = getKeywordBySlug(s);
    return !k || !indexabilityFor(k).inSitemap;
  });
  ok(notLive.length === 0, "수동 승인 슬러그가 전부 Tier A(사이트맵 포함)", `미반영 ${notLive.join(", ")}`);
}

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

// ── ⑫ 오독 어순·조사 고아(전 페이지 생성 본문) ───────────────────────────────
// "샌딩을 하지 손상 없이" = '샌딩을 하지 (않고)' 로 오독되는 어순, "철거, 는" 류
// 치환 삭제 잔존 조사를 생성 엔진 출력 전체에서 차단한다(발견 = 빌드 실패).
{
  const BAD = [
    [/[을를이가은는] 하지 손상/, "조사+하지 손상(오독 어순)"],
    [/, [는은이가] /, "조사 고아(', 는' 류)"],
  ] as const;
  let bad = 0;
  const samples: string[] = [];
  for (const k of keywords) {
    const texts = [getContentForKeyword(k), keyAnswerFor(k).question, keyAnswerFor(k).answer];
    for (const text of texts)
      for (const [re, label] of BAD)
        if (re.test(text)) {
          bad++;
          if (samples.length < 5) samples.push(`${k.slug}: ${label} "${(text.match(re) || [])[0]}"`);
        }
  }
  ok(bad === 0, "오독 어순·조사 고아 없음(전 페이지)", `${bad}건 ${samples.join(" · ")}`);
}

// ── ⑪ 품목-FAQ 일치(전 페이지) ───────────────────────────────────────────────
// 페이지에 노출되는 FAQ 는 반드시 그 페이지 품목군(services)과 맞아야 한다.
// 예: 마루철거 페이지에 데코타일 본드 FAQ·타일 방수층 FAQ 금지. 불일치 = 빌드 실패.
{
  let mismatched = 0;
  const samples: string[] = [];
  for (const k of keywords) {
    for (const f of pickFaqs(k, 4)) {
      if (!faqMatchesItem(f, k.item)) {
        mismatched++;
        if (samples.length < 5) samples.push(`${k.slug} ← ${f.id}(${f.services?.join("/")})`);
      }
    }
  }
  ok(mismatched === 0, "품목-FAQ 일치(전 페이지)", `불일치 ${mismatched}건 ${samples.join(", ")}`);
  // 대표 케이스 고정 검증 — 회귀 방지.
  const maru = getKeywordBySlug("강남-마루철거");
  if (maru) {
    const ids = pickFaqs(maru, 4).map((f) => f.id);
    ok(!ids.includes("f12"), "마루철거 페이지에 데코타일 본드 FAQ(f12) 없음", ids.join(","));
    ok(!ids.includes("f14"), "마루철거 페이지에 타일 방수층 FAQ(f14) 없음", ids.join(","));
  }
  const epoxy = getKeywordBySlug("강남-에폭시철거") || keywords.find((k) => k.item === "에폭시철거");
  if (epoxy) {
    const efs = pickFaqs(epoxy, 4);
    ok(efs.every((f) => faqMatchesItem(f, "에폭시철거")), "에폭시 페이지 FAQ 전부 품목 일치");
  }
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(`[test:seo] 실패 ${errors.length} · 통과 ${passed}`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`[test:seo] 전체 통과 — ${passed}개 검증`);
