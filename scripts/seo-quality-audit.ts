// =============================================================================
// SEO 품질 게이트 — 빌드 전에 소스 로직으로 전 페이지 텍스트를 생성해 검사한다.
//   실행: npm run seo:quality            (빠른 게이트 — prebuild 에서 실행, 실패 시 빌드 중단)
//         npm run seo:quality -- --full  (+본문 유사도 클러스터링 → seo-duplicate-clusters.csv)
//
// 실패(exit 1) 조건 — 하나라도 발견되면 배포를 막는다:
//   · 조사 병기 placeholder: "을(를)"·"이(가)"·"은(는)"·"과(와)"·"으로(로)"
//   · 잘못된 조사: 어휘(지역·품목·키워드) 뒤에 받침 규칙에 어긋난 조사(예: 철거을·샌딩는)
//   · placeholder 잔재: undefined·NaN·[지역]·[품목]·{region}·{item}·{cluster}·{experience}
//   · 제목·본문 품목 불일치: 품목 분류기(content/keyAnswer/costs/compare) 간 계열 충돌
//   · canonical 규칙 위반: http/www/비인코딩 표기, Tier A 인데 사이트맵 누락, noindex 인데 포함
//   · 사이트맵 무효 URL: 존재하지 않는 슬러그/지역/글
//   · 중복 title / 중복 description (색인 대상 페이지끼리)
//   · 지역 허브 인트로 렌더링에 병기 표기 잔존(65개 지역 전수)
//
// 유사도 검사(--full)는 내부 품질 점검용 휴리스틱(minhash 근사 자카드)이며,
// 검색엔진의 공식 기준이 아니다. 결과는 실패가 아니라 리포트로만 남긴다.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { getKeywords } from "@/data/keywords";
import { indexabilityFor, siteUrl, keywordUrl } from "@/lib/seo/indexability";
import { uniqueTitle, uniqueDescription, pickFaqs } from "@/lib/seo";
import { getContentForKeyword, familyOf } from "@/lib/content";
import { keyAnswerFor, keyAnswerForRegion, familyLabel } from "@/data/keyAnswer";
import { comboProfileFor } from "@/data/comboProfiles";
import { costKeyOf } from "@/data/costs";
import { compareKeyOf, itemFactsFor } from "@/data/itemFacts";
import { fillTemplate } from "@/lib/template";
import { josaEnd } from "@/lib/josa";
import { clusterLabelOf } from "@/data/regions";
import { entriesForGroup, SITEMAP_GROUPS } from "@/lib/sitemap";
import { posts } from "@/data/posts";
import { company } from "@/data/company";
import { regions as REGION_VOCAB, itemsDemo, itemsSanding, synonyms } from "@/data/taxonomy";
import ui from "../content/ui.json";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "reports");
const FULL = process.argv.includes("--full");

interface Failure {
  check: string;
  where: string;
  detail: string;
}
const failures: Failure[] = [];
const warnings: Failure[] = [];

function fail(check: string, where: string, detail: string): void {
  failures.push({ check, where, detail });
}
function warn(check: string, where: string, detail: string): void {
  warnings.push({ check, where, detail });
}

// ─── ① placeholder / 병기 표기 / 잘못된 조사 ──────────────────────────────────
const LITERAL_FORBIDDEN = [
  "을(를)", "이(가)", "은(는)", "과(와)", "으로(로)",
  "undefined", "NaN", "[object", "[지역]", "[품목]",
  "{region}", "{cluster}", "{item}", "{experience}",
];

// 검증 어휘: 품목·지역·키워드 문자열 — 이 단어 '바로 뒤'에 붙은 조사만 정밀 검사한다.
const VOCAB = [...new Set([...itemsDemo, ...itemsSanding, ...synonyms, ...REGION_VOCAB])]
  .sort((a, b) => b.length - a.length); // 긴 단어 우선(부분 중복 방지)

const PARTICLES = ["은", "는", "이", "가", "을", "를", "과", "와", "으로", "로"] as const;
type PairName = Parameters<typeof josaEnd>[1];
const PAIR_OF_PARTICLE: Record<string, PairName> = {
  은: "은는", 는: "은는", 이: "이가", 가: "이가", 을: "을를", 를: "을를",
  과: "과와", 와: "과와", 으로: "으로로", 로: "으로로",
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 어휘+조사 패턴을 찾아 받침 규칙과 대조한다. 다음 글자가 한글이면(합성어) 건너뛴다.
function checkJosa(where: string, text: string): void {
  for (const word of VOCAB) {
    if (!text.includes(word)) continue;
    const re = new RegExp(`${escapeRe(word)}(으로|은|는|이|가|을|를|과|와|로)(?![가-힣])`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const particle = m[1];
      const expected = josaEnd(word, PAIR_OF_PARTICLE[particle]);
      if (particle !== expected) {
        fail("조사 오류", where, `"${word}${particle}" → "${word}${expected}" (…${text.slice(Math.max(0, m.index - 12), m.index + word.length + 6)}…)`);
      }
    }
  }
}

function checkForbidden(where: string, text: string): void {
  for (const lit of LITERAL_FORBIDDEN) {
    const i = text.indexOf(lit);
    if (i >= 0) fail("placeholder", where, `"${lit}" 발견 (…${text.slice(Math.max(0, i - 15), i + lit.length + 10)}…)`);
  }
  // 병기 일반형: 한글+([를가는와로]) — 목록에 없는 변형도 잡는다.
  const paren = text.match(/[가-힣]\((를|가|는|와|로)\)/);
  if (paren) fail("placeholder", where, `조사 병기 표기 "${paren[0]}" 발견`);
  checkJosa(where, text);
}

// ─── ② 품목 분류기 일관성(제목·본문 품목 일치의 근원 검사) ─────────────────────
// content.familyOf / keyAnswer.familyLabel / costs.costKeyOf / itemFacts.compareKeyOf 가
// 같은 품목을 서로 다른 계열(비닐 vs 타일 등)로 분류하면 "데코타일철거 제목에 타일 철거
// 본문" 류의 불일치가 생긴다. 네 분류기를 공통 계열로 환원해 충돌을 잡는다.
type Axis = "maru" | "vinyl" | "tile" | "coating" | "sanding" | "other";
function axisOfContentFamily(f: string): Axis {
  if (f === "maru" || f === "vinyl" || f === "tile" || f === "coating" || f === "sanding") return f;
  return "other";
}
function axisOfFamilyLabel(label: string): Axis {
  if (label.includes("샌딩")) return "sanding";
  if (label.includes("코팅")) return "coating";
  if (label.includes("타일")) return "tile";
  if (label.includes("비닐")) return "vinyl";
  if (label.includes("마루")) return "maru";
  return "other";
}
function axisOfCostKey(key: string | null): Axis {
  if (!key) return "other";
  if (key === "sanding") return "sanding";
  if (key === "coating") return "coating";
  if (key === "tile") return "tile";
  if (key === "deco" || key === "jangpan") return "vinyl";
  if (key === "wonmok" || key === "ganghwa" || key === "ganmaru") return "maru";
  return "other";
}
function axisOfCompareKey(key: string): Axis {
  if (!key) return "other";
  if (key === "sanding") return "sanding";
  if (key === "coating") return "coating";
  if (key === "tile") return "tile";
  if (key === "vinyl") return "vinyl";
  if (key === "ganghwa" || key === "maru") return "maru";
  return "other";
}

function checkItemConsistency(): void {
  const items = [...new Set(getKeywords().map((k) => k.item).filter(Boolean))] as string[];
  for (const item of items) {
    const axes: Array<[string, Axis]> = [
      ["content.familyOf", axisOfContentFamily(familyOf(item))],
      ["keyAnswer.familyLabel", axisOfFamilyLabel(familyLabel(item))],
      ["costs.costKeyOf", axisOfCostKey(costKeyOf(item))],
      ["itemFacts.compareKeyOf", axisOfCompareKey(compareKeyOf(item))],
    ];
    const defined = axes.filter(([, a]) => a !== "other");
    const distinct = new Set(defined.map(([, a]) => a));
    if (distinct.size > 1) {
      fail(
        "품목 분류 불일치",
        `item:${item}`,
        defined.map(([n, a]) => `${n}=${a}`).join(", ")
      );
    }
  }
}

// ─── ③ 페이지 텍스트 전수 생성 + 검사 ─────────────────────────────────────────
interface PageText {
  slug: string;
  title: string;
  desc: string;
  body: string; // 유사도 계산용(본문 엔진 출력만 — 공통 header/footer 제외)
  indexable: boolean;
  region?: string;
  item?: string;
  type: string;
}

function collectAndCheckPages(): PageText[] {
  const pages: PageText[] = [];
  const keywords = getKeywords();
  for (const k of keywords) {
    const ix = indexabilityFor(k);
    const title = uniqueTitle(k);
    const desc = uniqueDescription(k, company.phone);
    const body = getContentForKeyword(k);
    const ka = keyAnswerFor(k);
    const combo = comboProfileFor(k);
    const facts = itemFactsFor(k.item);
    const faqs = pickFaqs(k, 5);
    const where = `/${k.slug}`;

    const joined = [
      title, desc, ka.question, ka.answer, ka.supplement,
      combo.regionLine, combo.difficulty, combo.sandingBond, combo.photoInfo, combo.nextProcess,
      facts.scope, facts.attach, facts.removal, facts.debris, facts.caution, facts.aftercare,
      ...faqs.map((f) => `${f.question} ${f.answer}`),
      body,
    ].join("\n");
    checkForbidden(where, joined);

    // 제목·본문 품목 일치 — 제목에 든 품목과 keyAnswer 계열이 충돌하지 않는지.
    if (k.item) {
      const titleAxis = axisOfContentFamily(familyOf(k.item));
      const answerAxis = axisOfFamilyLabel(familyLabel(k.item));
      if (titleAxis !== "other" && answerAxis !== "other" && titleAxis !== answerAxis) {
        fail("제목·본문 품목 불일치", where, `제목 품목 계열=${titleAxis}, 핵심답변 계열=${answerAxis}`);
      }
    }

    pages.push({ slug: k.slug, title, desc, body, indexable: ix.indexable, region: k.region, item: k.item, type: String(k.type) });
  }

  // 지역 허브 인트로(65개 전수) — "판교을(를)" 류 병기 잔존 검사.
  const hubRegions = [...new Set(keywords.filter((k) => k.type === "region-item" && k.region).map((k) => k.region as string))];
  for (const region of hubRegions) {
    const intro = fillTemplate((ui as { regionPage: { introTemplate: string } }).regionPage.introTemplate, {
      region,
      cluster: clusterLabelOf(region),
      experience: company.experience,
    });
    checkForbidden(`/services/${region} (intro)`, intro);
    const ka = keyAnswerForRegion(region);
    checkForbidden(`/services/${region} (keyAnswer)`, `${ka.question}\n${ka.answer}\n${ka.supplement}`);
  }

  return pages;
}

// ─── ④ 중복 title/description (색인 대상끼리) ─────────────────────────────────
function checkDuplicates(pages: PageText[]): void {
  const byTitle = new Map<string, string[]>();
  const byDesc = new Map<string, string[]>();
  for (const p of pages) {
    if (!p.indexable) continue;
    byTitle.set(p.title, [...(byTitle.get(p.title) || []), p.slug]);
    byDesc.set(p.desc, [...(byDesc.get(p.desc) || []), p.slug]);
  }
  for (const [t, slugs] of byTitle) if (slugs.length > 1) fail("중복 title", slugs.map((s) => `/${s}`).join(" "), t);
  for (const [d, slugs] of byDesc) if (slugs.length > 1) fail("중복 description", slugs.map((s) => `/${s}`).join(" "), d.slice(0, 80));
}

// ─── ⑤ 사이트맵 ↔ 색인 판정 정합 ──────────────────────────────────────────────
function checkSitemap(): void {
  const keywords = getKeywords();
  const bySlugTier = new Map(keywords.map((k) => [k.slug, indexabilityFor(k)]));
  const hubs = new Set(
    keywords.filter((k) => k.type === "region-item" && k.region).map((k) => `${siteUrl}/services/${encodeURIComponent(k.region as string)}`)
  );
  const postIds = new Set(posts.map((p) => p.id));
  const coreUrls = new Set([siteUrl, `${siteUrl}/services`, `${siteUrl}/gallery`, `${siteUrl}/reviews`, `${siteUrl}/faq`, `${siteUrl}/blog`]);

  const seen = new Set<string>();
  for (const group of SITEMAP_GROUPS) {
    for (const e of entriesForGroup(group)) {
      if (seen.has(e.loc)) fail("사이트맵 중복 loc", group, e.loc);
      seen.add(e.loc);
      if (!e.loc.startsWith("https://")) fail("사이트맵 비HTTPS", group, e.loc);
      if (e.loc.includes("//www.")) fail("사이트맵 www 표기", group, e.loc);

      if (coreUrls.has(e.loc) || hubs.has(e.loc)) continue;
      if (e.loc.startsWith(`${siteUrl}/blog/`)) {
        const id = e.loc.slice(`${siteUrl}/blog/`.length);
        if (!postIds.has(id)) fail("사이트맵 무효 블로그", group, e.loc);
        continue;
      }
      const slug = decodeURIComponent(e.loc.slice(siteUrl.length + 1));
      const ix = bySlugTier.get(slug);
      if (!ix) { fail("사이트맵 무효 슬러그(404 후보)", group, e.loc); continue; }
      if (!ix.inSitemap) fail("사이트맵 자격 미달 포함", group, `${e.loc} (tier ${ix.tier}, ${ix.reasons[0] || ""})`);
      if (ix.canonicalUrl !== e.loc) fail("사이트맵 loc ≠ canonical", group, `${e.loc} vs ${ix.canonicalUrl}`);
    }
  }
  // 역방향: Tier A(사이트맵 자격) 키워드가 실제로 포함됐는지.
  for (const k of keywords) {
    const ix = bySlugTier.get(k.slug)!;
    if (ix.inSitemap && !seen.has(keywordUrl(k.slug))) {
      fail("Tier A 사이트맵 누락", `/${k.slug}`, keywordUrl(k.slug));
    }
    if (ix.canonicalUrl && !ix.canonicalUrl.startsWith("https://prodaco.kr") && !process.env.NEXT_PUBLIC_SITE_URL) {
      fail("canonical 호스트 오류", `/${k.slug}`, ix.canonicalUrl);
    }
  }
}

// ─── ⑥ 본문 유사도 클러스터(--full, 휴리스틱 리포트 전용) ─────────────────────
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function minhashSig(text: string, perms = 64): Uint32Array {
  const words = text.replace(/\s+/g, " ").split(" ");
  const shingles: number[] = [];
  for (let i = 0; i + 2 < words.length; i++) shingles.push(hash32(words.slice(i, i + 3).join(" ")));
  const sig = new Uint32Array(perms).fill(0xffffffff);
  for (const sh of shingles) {
    for (let p = 0; p < perms; p++) {
      // xorshift 계열 결정적 퍼뮤테이션
      const v = (Math.imul(sh ^ (p * 0x9e3779b1), 2654435761) >>> 0);
      if (v < sig[p]) sig[p] = v;
    }
  }
  return sig;
}
function estJaccard(a: Uint32Array, b: Uint32Array): number {
  let eq = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) eq++;
  return eq / a.length;
}

function similarityClusters(pages: PageText[]): void {
  const THRESHOLD = 0.8;
  const sigs = new Map(pages.map((p) => [p.slug, minhashSig(p.body)]));
  // 같은 품목(지역만 다른 형제)끼리 + 같은 지역(품목만 다른 형제)끼리 비교 — near-dup 주축.
  const groups = new Map<string, PageText[]>();
  for (const p of pages) {
    if (p.item) groups.set(`item:${p.item}`, [...(groups.get(`item:${p.item}`) || []), p]);
    if (p.region) groups.set(`region:${p.region}`, [...(groups.get(`region:${p.region}`) || []), p]);
  }
  // union-find
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const p of pages) parent.set(p.slug, p.slug);

  const pairSims = new Map<string, number>();
  for (const [, members] of groups) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i], b = members[j];
        const key = a.slug < b.slug ? `${a.slug}|${b.slug}` : `${b.slug}|${a.slug}`;
        if (pairSims.has(key)) continue;
        const sim = estJaccard(sigs.get(a.slug)!, sigs.get(b.slug)!);
        pairSims.set(key, sim);
        if (sim >= THRESHOLD) union(a.slug, b.slug);
      }
    }
  }
  const clusters = new Map<string, string[]>();
  for (const p of pages) {
    const r = find(p.slug);
    clusters.set(r, [...(clusters.get(r) || []), p.slug]);
  }
  const rows: Array<Record<string, unknown>> = [];
  let clusterId = 0;
  for (const [, members] of clusters) {
    if (members.length < 2) continue;
    clusterId++;
    for (const slug of members) {
      rows.push({ cluster: clusterId, size: members.length, url: `/${slug}`, note: `본문 유사도 ≥ ${THRESHOLD} (minhash 근사 — 내부 휴리스틱)` });
    }
  }
  const file = path.join(OUT, "seo-duplicate-clusters.csv");
  const headers = ["cluster", "size", "url", "note"];
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => String(r[h]).replace(/,/g, "·")).join(","))].join("\n");
  fs.writeFileSync(file, "﻿" + csv, "utf8");
  console.log(`[seo:quality] 유사도 클러스터 ${clusterId}개(멤버 ${rows.length}) → reports/seo-duplicate-clusters.csv`);
  if (clusterId > 0) warn("본문 유사도", "clusters", `${clusterId}개 클러스터 — 지역별 고유 사례·사진 보강 우선순위 참고`);
}

// ─── 실행 ─────────────────────────────────────────────────────────────────────
function main(): void {
  fs.mkdirSync(OUT, { recursive: true });
  checkItemConsistency();
  const pages = collectAndCheckPages();
  checkDuplicates(pages);
  checkSitemap();
  if (FULL) similarityClusters(pages);

  const report = [
    `# SEO 품질 게이트 리포트 (${new Date().toISOString().slice(0, 10)})`,
    "",
    `- 검사 페이지: ${pages.length} (키워드) + 지역 허브 전수`,
    `- 실패: ${failures.length} · 경고: ${warnings.length}`,
    "",
    ...(failures.length ? ["## 실패", ...failures.map((f) => `- [${f.check}] ${f.where} — ${f.detail}`)] : ["## 실패", "- 없음"]),
    "",
    ...(warnings.length ? ["## 경고", ...warnings.map((w) => `- [${w.check}] ${w.where} — ${w.detail}`)] : []),
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "seo-quality-report.md"), report, "utf8");

  if (failures.length) {
    console.error(`[seo:quality] 실패 ${failures.length}건 — reports/seo-quality-report.md 확인`);
    for (const f of failures.slice(0, 20)) console.error(`  · [${f.check}] ${f.where} — ${f.detail}`);
    if (failures.length > 20) console.error(`  · … 외 ${failures.length - 20}건`);
    process.exit(1);
  }
  console.log(`[seo:quality] 통과 — 페이지 ${pages.length}개, 경고 ${warnings.length}건 (reports/seo-quality-report.md)`);
}

main();
