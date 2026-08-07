// 사이트맵 공유 로직 — sitemap 인덱스(/sitemap.xml)와 하위 sitemap(/sitemaps/<group>.xml)이
// 동일한 URL 규칙을 쓰도록 단일 출처로 모은다.
//
// 포함 규칙(스팸/중복 방지):
//   · isIndexable(k) && canonicalSlugFor(k) === k.slug  → 200·index·self-canonical 만 포함
//   · 동의어 꼬리말 등 비-canonical, noindex, 관리자/유틸 URL 은 제외
//   · 한글 슬러그는 encodeURIComponent 로 인코딩해 페이지 canonical(인코딩형)과 정확히 일치
//   · lastmod 는 그 페이지 콘텐츠가 실제로 바뀐 날(git 커밋 날짜) — content/lastmod.json.
//     같은 커밋을 다시 빌드하면 값이 같아 "매 빌드 갱신 신호" 는 여전히 나지 않는다.
//     파일이 없으면(git 없는 환경) SITE_LASTMOD 로 폴백한다.
import fs from "node:fs";
import path from "node:path";
import { getKeywords, hubDecisionFor } from "@/data/keywords";
import { indexabilityFor } from "@/lib/seo/indexability";
import { posts } from "@/data/posts";
import { blogUrl } from "@/lib/blogUrl";
import type { KeywordEntry } from "@/data/taxonomy";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

// 폴백 콘텐츠 버전 날짜 — content/lastmod.json 이 없을 때만 쓰인다.
export const SITE_LASTMOD = "2026-06-23";

// ─── 실제 수정일(content/lastmod.json) ──────────────────────────────────────────
// scripts/build-lastmod.mjs 가 빌드 전에 git 커밋 날짜로 생성한다(커밋되지 않는 산출물).
interface LastmodMap {
  core?: string;
  keywords?: string;
  hubs?: string;
  regions?: Record<string, string>;
  slugs?: Record<string, string>;
}

const lastmodMap: LastmodMap = (() => {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "content", "lastmod.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as LastmodMap) : {};
  } catch {
    return {};
  }
})();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 후보 날짜 중 가장 최신. 유효한 값이 하나도 없으면 SITE_LASTMOD. */
function newest(...candidates: (string | undefined)[]): string {
  const valid = candidates.filter((d): d is string => !!d && DATE_RE.test(d));
  return valid.length ? valid.sort().slice(-1)[0] : SITE_LASTMOD;
}

/** 코어 정적 페이지(홈·서비스·갤러리·후기·FAQ·블로그 목록)의 수정일. */
function coreLastmod(): string {
  return newest(lastmodMap.core);
}

/** 지역 허브 수정일 — 허브 템플릿 변경과 그 지역 시공사례 추가 중 늦은 쪽. */
function hubLastmod(region: string): string {
  return newest(lastmodMap.hubs, lastmodMap.regions?.[region]);
}

/**
 * 조합 페이지 수정일 — 조합 데이터(키워드·색인 허용목록) 변경과
 * 그 페이지에 걸린 시공사례 추가 중 늦은 쪽.
 */
function keywordLastmod(k: KeywordEntry): string {
  return newest(
    lastmodMap.keywords,
    lastmodMap.slugs?.[k.slug],
    k.region ? lastmodMap.regions?.[k.region] : undefined
  );
}

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq?: string;
  priority?: number;
}

// 안전한 lastmod(YYYY-MM-DD) — 파싱 불가/누락 시 SITE_LASTMOD 로 폴백.
function safeLastmod(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return SITE_LASTMOD;
}

function keywordPriority(type: string): number {
  switch (type) {
    case "region-item": return 0.75;
    case "item-tail":
    case "region-item-tail": return 0.65;
    case "b2b":
    case "consumer": return 0.7;
    case "sanding": return 0.72;
    case "synonym": return 0.6;
    default: return 0.6;
  }
}

// 사이트맵에 실을 자격이 있는 키워드 — 단일 출처(indexability.ts)의 inSitemap 판정.
// (Tier A = 200 · index,follow · self-canonical 만 포함. noindex/중복 통합 변형 제외.)
function indexableKeywords(): KeywordEntry[] {
  return getKeywords().filter((k) => indexabilityFor(k).inSitemap);
}

function keywordEntry(k: KeywordEntry): SitemapEntry {
  return {
    loc: `${siteUrl}/${encodeURIComponent(k.slug)}`,
    lastmod: keywordLastmod(k),
    changefreq: "monthly",
    priority: keywordPriority(String(k.type)),
  };
}

// ─── 그룹 정의 ──────────────────────────────────────────────────────────────────
// 논리적으로 분리하되 URL 총량은 그대로 유지한다.
export const SITEMAP_GROUPS = [
  "core",
  "regions",
  "services",
  "programmatic-1",
  "programmatic-2",
  "blog",
] as const;
export type SitemapGroup = (typeof SITEMAP_GROUPS)[number];

export function isSitemapGroup(name: string): name is SitemapGroup {
  return (SITEMAP_GROUPS as readonly string[]).includes(name);
}

// region-item 이 존재하는 지역만 허브로(허브 라우트 generateStaticParams 와 일치).
function hubRegions(): string[] {
  return [...new Set(getKeywords().filter((k) => k.type === "region-item" && k.region).map((k) => k.region as string))];
}

/** 사이트맵에 실을 허브 — INDEX 티어만(SUPPORT 는 noindex,follow 라 제외). */
function indexHubRegions(): string[] {
  return hubRegions().filter((r) => hubDecisionFor(r).inSitemap);
}

export function entriesForGroup(group: SitemapGroup): SitemapEntry[] {
  const kws = indexableKeywords();
  switch (group) {
    case "core": {
      // 갤러리 목록은 시공사례가 추가되면 실제로 바뀐다 → 사례 날짜까지 반영.
      const core = coreLastmod();
      const galleryLastmod = newest(core, ...Object.values(lastmodMap.regions ?? {}));
      return [
        { loc: siteUrl, lastmod: core, changefreq: "weekly", priority: 1.0 },
        { loc: `${siteUrl}/services`, lastmod: core, changefreq: "weekly", priority: 0.9 },
        { loc: `${siteUrl}/gallery`, lastmod: galleryLastmod, changefreq: "monthly", priority: 0.75 },
        { loc: `${siteUrl}/reviews`, lastmod: core, changefreq: "weekly", priority: 0.8 },
        { loc: `${siteUrl}/faq`, lastmod: core, changefreq: "monthly", priority: 0.85 },
        { loc: `${siteUrl}/blog`, lastmod: newest(core, ...posts.map((p) => p.updatedAt || p.date)), changefreq: "weekly", priority: 0.75 },
      ];
    }
    case "regions":
      return indexHubRegions().map((region) => ({
        loc: `${siteUrl}/services/${encodeURIComponent(region)}`,
        lastmod: hubLastmod(region),
        changefreq: "weekly",
        priority: 0.8,
      }));
    case "services":
      // 핵심 지역×품목 상세 페이지.
      return kws.filter((k) => k.type === "region-item").map(keywordEntry);
    case "programmatic-1":
      // 품목 꼬리말 + B2B 협력.
      return kws.filter((k) => k.type === "item-tail" || k.type === "b2b").map(keywordEntry);
    case "programmatic-2":
      // 용어·직접시공(consumer·synonym) + 공간·상황별(target) + 기타.
      return kws
        .filter((k) => !["region-item", "item-tail", "b2b"].includes(String(k.type)))
        .map(keywordEntry);
    case "blog":
      return posts
        .filter((p) => typeof p.id === "string" && p.id.length > 0)
        .map((p) => ({
          loc: blogUrl(siteUrl, p.id),
          lastmod: safeLastmod(p.updatedAt, p.date),
          changefreq: "monthly",
          priority: 0.8,
        }));
  }
}

// 인덱스에 실을 하위 sitemap 목록(비어 있는 그룹은 제외).
export function nonEmptyGroups(): { group: SitemapGroup; lastmod: string; count: number }[] {
  return SITEMAP_GROUPS.map((group) => {
    const entries = entriesForGroup(group);
    // 인덱스의 lastmod 는 그 하위 sitemap 안에서 가장 최근 수정일이어야 한다
    // (구글은 인덱스의 날짜를 보고 하위 sitemap 재수집 여부를 정한다).
    return { group, lastmod: newest(...entries.map((e) => e.lastmod)), count: entries.length };
  }).filter((g) => g.count > 0);
}

// ─── XML 직렬화 ──────────────────────────────────────────────────────────────────
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderUrlset(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`<loc>${xmlEscape(e.loc)}</loc>`, `<lastmod>${e.lastmod}</lastmod>`];
      if (e.changefreq) parts.push(`<changefreq>${e.changefreq}</changefreq>`);
      if (typeof e.priority === "number") parts.push(`<priority>${e.priority.toFixed(2)}</priority>`);
      return `  <url>${parts.join("")}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderIndex(): string {
  const items = nonEmptyGroups()
    .map(
      (g) =>
        `  <sitemap><loc>${xmlEscape(`${siteUrl}/sitemaps/${g.group}.xml`)}</loc><lastmod>${g.lastmod}</lastmod></sitemap>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}
