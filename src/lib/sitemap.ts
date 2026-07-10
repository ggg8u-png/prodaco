// 사이트맵 공유 로직 — sitemap 인덱스(/sitemap.xml)와 하위 sitemap(/sitemaps/<group>.xml)이
// 동일한 URL 규칙을 쓰도록 단일 출처로 모은다.
//
// 포함 규칙(스팸/중복 방지):
//   · isIndexable(k) && canonicalSlugFor(k) === k.slug  → 200·index·self-canonical 만 포함
//   · 동의어 꼬리말 등 비-canonical, noindex, 관리자/유틸 URL 은 제외
//   · 한글 슬러그는 encodeURIComponent 로 인코딩해 페이지 canonical(인코딩형)과 정확히 일치
//   · lastmod 는 고정 상수(SITE_LASTMOD) — 매 빌드 변경 신호를 내지 않으면서 크롤 기준 날짜 제공
import { getKeywords, canonicalSlugFor, isIndexable } from "@/data/keywords";
import { posts } from "@/data/posts";
import type { KeywordEntry } from "@/data/taxonomy";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

// 콘텐츠 버전 날짜 — 정적 페이지 lastmod 기준(매 빌드 갱신 신호 방지).
export const SITE_LASTMOD = "2026-06-23";

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

// 사이트맵에 실을 자격이 있는 키워드(색인 가능 + self-canonical)만.
function indexableKeywords(): KeywordEntry[] {
  return getKeywords().filter((k) => isIndexable(k) && canonicalSlugFor(k) === k.slug);
}

function keywordEntry(k: KeywordEntry): SitemapEntry {
  return {
    loc: `${siteUrl}/${encodeURIComponent(k.slug)}`,
    lastmod: SITE_LASTMOD,
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

export function entriesForGroup(group: SitemapGroup): SitemapEntry[] {
  const kws = indexableKeywords();
  switch (group) {
    case "core":
      return [
        { loc: siteUrl, lastmod: SITE_LASTMOD, changefreq: "weekly", priority: 1.0 },
        { loc: `${siteUrl}/services`, lastmod: SITE_LASTMOD, changefreq: "weekly", priority: 0.9 },
        { loc: `${siteUrl}/gallery`, lastmod: SITE_LASTMOD, changefreq: "monthly", priority: 0.75 },
        { loc: `${siteUrl}/reviews`, lastmod: SITE_LASTMOD, changefreq: "weekly", priority: 0.8 },
        { loc: `${siteUrl}/faq`, lastmod: SITE_LASTMOD, changefreq: "monthly", priority: 0.85 },
        { loc: `${siteUrl}/blog`, lastmod: SITE_LASTMOD, changefreq: "weekly", priority: 0.75 },
      ];
    case "regions":
      return hubRegions().map((region) => ({
        loc: `${siteUrl}/services/${encodeURIComponent(region)}`,
        lastmod: SITE_LASTMOD,
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
          loc: `${siteUrl}/blog/${p.id}`,
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
    return { group, lastmod: SITE_LASTMOD, count: entries.length };
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
