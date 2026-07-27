#!/usr/bin/env node
/**
 * 대표 URL 렌더 HTML 감사 — 빌드 산출물(.next/server/app)의 프리렌더 HTML 을 직접 검사한다.
 *
 *   npm run build && npm run seo:pages
 *
 * 유형별 대표 URL(홈·지역 허브·지역×품목·비용 랜딩·블로그)에서:
 *   문법 오류 패턴 / self-canonical / robots / H1 / title / 품목-FAQ 일치 /
 *   색인·사이트맵 일치 / 지역×품목 링크 수 / main 중복률 / 사례 지역 표기
 * 위반이 있으면 exit 1 (배포 전 확인용 — prebuild 게이트가 아닌 빌드 후 검사).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP = path.join(ROOT, ".next", "server", "app");
if (!fs.existsSync(APP)) {
  console.error("[seo:pages] .next/server/app 없음 — 먼저 npm run build 를 실행하세요.");
  process.exit(2);
}

// ─── 검사 대상 대표 URL(유형별) ─────────────────────────────────────────────────
// 조합(keyword) 페이지의 기대 색인 상태는 하드코딩하지 않고 content/seo.json 의
// 허용목록(extraIndexSlugs)에서 읽는다 — 판정이 바뀌면 기대값도 따라온다.
const seoConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "seo.json"), "utf8"));
const allowSet = new Set(seoConfig.extraIndexSlugs || []);
const kw = (slug, item) => ({
  file: `${slug}.html`,
  kind: allowSet.has(slug) ? "지역×품목(색인)" : "지역×품목(강등)",
  indexable: allowSet.has(slug),
  item,
});
const TARGETS = [
  { file: "index.html", kind: "홈", indexable: true },
  { file: "services/강남.html", kind: "지역 허브", indexable: true },
  { file: "services/하남.html", kind: "지역 허브", indexable: true },
  { file: "services/광명.html", kind: "지역 허브", indexable: true },
  kw("시흥-마루철거", "마루철거"),
  kw("인천-바닥철거", "바닥철거"),
  kw("강남-마루철거", "마루철거"),
  kw("군포-에폭시철거", "에폭시철거"),
  kw("하남-장판철거", "장판철거"),
  { ...kw("바닥샌딩-비용", "바닥샌딩"), kind: "비용 랜딩" },
  { ...kw("온돌마루철거-평당비용", "온돌마루철거"), kind: "비용 랜딩" },
  { file: "blog/tile-removal.html", kind: "블로그", indexable: true },
  { file: "blog/deco-tile-cost.html", kind: "블로그", indexable: true },
];

// 문법 오류 패턴 — 조사 잔존·병기 미치환·부자연 어순.
const GRAMMAR = [
  [/, [는은이가]\s/, "조사 고아(', 는' 류 — 치환 삭제 잔존)"],
  [/[가-힣]을\(를\)|[가-힣]이\(가\)|[가-힣]은\(는\)|[가-힣]으로\(로\)/, "조사 병기 미치환"],
  [/철거을|철거이 |철거으로|샌딩는|샌딩가 /, "받침 불일치 조사"],
  [/[을를] 하지 손상/, "'~을 하지 손상' 오독 어순"],
  [/undefined|NaN|\[object Object\]/, "템플릿 값 누락"],
];

// 사이트맵 로드(강등 페이지 제외 확인용).
const smDir = path.join(APP, "sitemaps");
const sitemap = new Set();
for (const f of fs.readdirSync(smDir).filter((f) => f.endsWith(".xml.body"))) {
  for (const m of fs.readFileSync(path.join(smDir, f), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) sitemap.add(m[1]);
}

// FAQ 품목 스코프(content/faq.json) — 렌더된 FAQ 질문이 품목과 맞는지 역검증.
const faqData = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "faq.json"), "utf8")).faqs;
const FAMILY_RE = {
  ganmaru: /(강마루|온돌마루|마루)/, ganghwa: /(강화마루|합판마루)/, wonmok: /원목마루/,
  deco: /(데코|디럭스|륨)/, jangpan: /장판/, tile: /(폴리싱|도기|바닥타일)|타일/, coating: /(에폭시|우레탄)/, sanding: /(샌딩|면갈이)/,
};
function familyOf(item) {
  if (!item) return null;
  if (/(샌딩|면갈이|마루재생|마루코팅)/.test(item)) return "sanding";
  if (/(에폭시|우레탄)/.test(item)) return "coating";
  if (/(폴리싱|도기|바닥타일)/.test(item)) return "tile";
  if (/타일/.test(item) && !/(데코|디럭스)/.test(item)) return "tile";
  if (/(데코|디럭스|륨)/.test(item)) return "deco";
  if (/장판/.test(item)) return "jangpan";
  if (/원목마루/.test(item)) return "wonmok";
  if (/(강화마루|합판마루)/.test(item)) return "ganghwa";
  if (/(강마루|온돌마루|마루)/.test(item)) return "ganmaru";
  return null;
}

function mainText(html) {
  let b = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ");
  const m = b.indexOf("<main");
  if (m >= 0) b = b.slice(m);
  // </main> 이후(푸터·사이트 공통 내비)는 본문이 아니다 — 포함하면 사이트 공통
  // 문구가 전 페이지 유사도를 부풀려 측정이 왜곡된다.
  const end = b.indexOf("</main>");
  if (end >= 0) b = b.slice(0, end);
  return b.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

// main 중복률 — 3어절 슁글 집합의 자카드 유사도.
function shingles(text) {
  const words = text.split(" ").filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 2 < words.length; i++) set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return set;
}
function jaccard(a, b) {
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

const rows = [];
const violations = [];
const fail = (t, check, detail) => violations.push(`${t.kind} /${decodeURIComponent(t.file).replace(/\.html$/, "")} — ${check}: ${detail}`);

for (const t of TARGETS) {
  // 프리렌더 파일명은 퍼센트 인코딩 — 한글 파일명 그대로도 시도.
  const candidates = [t.file, encodeURI(t.file)];
  const file = candidates.map((c) => path.join(APP, c)).find((p) => fs.existsSync(p));
  if (!file) { fail(t, "존재", "프리렌더 HTML 없음"); continue; }
  const html = fs.readFileSync(file, "utf8");
  const text = mainText(html);
  const name = t.file.replace(/\.html$/, "");
  const url = name === "index" ? "https://prodaco.kr" : `https://prodaco.kr/${name.split("/").map(encodeURIComponent).join("/")}`;

  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const canonical = (html.match(/rel="canonical" href="([^"]+)"/) || [])[1] || "";
  const robots = (html.match(/name="robots" content="([^"]+)"/) || [])[1] || "index(기본)";
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  const noindex = robots.includes("noindex");
  const inSm = sitemap.has(url);

  // 1) 문법
  for (const [re, label] of GRAMMAR) if (re.test(text)) fail(t, "문법", `${label} — "${(text.match(re) || [])[0]}"`);
  // 2~5) 메타 기본
  if (!title) fail(t, "title", "없음");
  if (h1s !== 1) fail(t, "H1", `${h1s}개`);
  if (!canonical) fail(t, "canonical", "없음");
  if (noindex && canonical && canonical !== url) fail(t, "canonical", `noindex 인데 self 아님(${canonical})`);
  // 6) 기대 색인 상태
  if (t.indexable && noindex) fail(t, "robots", "색인 기대인데 noindex");
  if (!t.indexable && !noindex) fail(t, "robots", "강등 기대인데 index");
  // 7) 사이트맵 일치
  if (noindex && inSm) fail(t, "sitemap", "noindex 인데 사이트맵 포함");
  if (!noindex && canonical === url && !inSm) fail(t, "sitemap", "index self-canonical 인데 사이트맵 제외");
  // 8) 품목-FAQ 일치 — 렌더된 <summary> 질문이 다른 품목 전용 FAQ 인지.
  if (t.item) {
    const fam = familyOf(t.item);
    const questions = [...html.matchAll(/<summary[^>]*>\s*([^<]+?)</g)].map((m) => m[1].trim());
    for (const q of questions) {
      const f = faqData.find((x) => q.startsWith(x.question.slice(0, 12)));
      if (!f || !f.services || f.services.includes("all")) continue;
      if (!f.services.includes(fam)) fail(t, "FAQ", `타 품목 FAQ 노출: "${q.slice(0, 30)}" (${f.services.join("/")})`);
    }
  }
  // 9) 지역×품목 링크 수 — main 내 한글 슬러그 조합 링크(지역-품목 패턴) 과다 나열.
  const comboLinks = [...html.matchAll(/href="\/([^"/]+)"/g)]
    .map((m) => decodeURIComponent(m[1]))
    .filter((h) => /^[가-힣]+-[가-힣]+/.test(h));
  const comboCount = new Set(comboLinks).size;
  if (comboCount > 20) fail(t, "링크", `지역×품목 링크 ${comboCount}개(>20)`);

  // 10) 실제 사례 지역 표기 — 타지역 사례를 그 지역 실적처럼 보이게 하지 않는지.
  const caseHonest = !/시공 사례/.test(text) || /수도권 유사|실제 작업 지역|카드에 실제/.test(text) || t.kind === "홈" || t.kind === "블로그";

  rows.push({ ...t, url, title: title.slice(0, 40), robots, selfCanonical: canonical === url, inSitemap: inSm, h1s, comboCount, textLen: text.length, caseHonest, text });
}

// 11) main 중복률 — 같은 유형 형제 페이지 간(지역×품목 강등 3개끼리 + 색인 2개끼리).
const comboRows = rows.filter((r) => r.kind.startsWith("지역×품목"));
let maxDup = 0, dupPair = "";
for (let i = 0; i < comboRows.length; i++)
  for (let j = i + 1; j < comboRows.length; j++) {
    const sim = jaccard(shingles(comboRows[i].text), shingles(comboRows[j].text));
    if (sim > maxDup) { maxDup = sim; dupPair = `${comboRows[i].file} ↔ ${comboRows[j].file}`; }
  }

// ─── 리포트 ─────────────────────────────────────────────────────────────────────
console.log(`[seo:pages] 대표 URL ${rows.length}/${TARGETS.length}개 검사`);
for (const r of rows) {
  console.log(`  ${r.kind.padEnd(12)} ${decodeURIComponent(r.file).replace(/\.html$/, "").padEnd(28)} robots=${r.robots.replace("(기본)", "").padEnd(15)} self-c=${r.selfCanonical ? "O" : "X"} sm=${r.inSitemap ? "O" : "X"} H1=${r.h1s} 조합링크=${String(r.comboCount).padStart(2)} 본문=${r.textLen}자`);
}
console.log(`  형제 페이지 main 최대 유사도: ${(maxDup * 100).toFixed(1)}% (${dupPair})`);
console.log(`  사례 지역 표기 정직성: ${rows.every((r) => r.caseHonest) ? "전체 통과" : "위반 있음"}`);
for (const r of rows) if (!r.caseHonest) violations.push(`${r.kind} ${r.file} — 사례 표기: 타지역 사례 명시 문구 없음`);

if (violations.length) {
  console.error(`\n[seo:pages] 위반 ${violations.length}건:`);
  for (const v of violations) console.error(`  ✗ ${v}`);
  process.exit(1);
}
console.log("[seo:pages] 전체 통과");
