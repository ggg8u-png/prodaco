import type { MetadataRoute } from "next";
import { getKeywords, canonicalSlugFor, isIndexable } from "@/data/keywords";
import { posts } from "@/data/posts";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

// 콘텐츠 버전 날짜 — 정적 페이지 lastmod 기준(매 빌드 갱신 신호 방지).
const SITE_LASTMOD = new Date("2026-06-23");

// 안전한 lastmod 파서 — 값이 없거나(빈 문자열/undefined) 파싱 불가한 날짜면
// SITE_LASTMOD 로 폴백해 sitemap 에 'Invalid Date' 가 새어 나가지 않게 한다.
function safeLastmod(...candidates: (string | undefined)[]): Date {
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d;
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

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl,                  lastModified: SITE_LASTMOD, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${siteUrl}/services`,    lastModified: SITE_LASTMOD, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${siteUrl}/gallery`,     lastModified: SITE_LASTMOD, changeFrequency: "monthly", priority: 0.75 },
    { url: `${siteUrl}/reviews`,     lastModified: SITE_LASTMOD, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${siteUrl}/faq`,         lastModified: SITE_LASTMOD, changeFrequency: "monthly", priority: 0.85 },
    { url: `${siteUrl}/blog`,        lastModified: SITE_LASTMOD, changeFrequency: "weekly",  priority: 0.75 },
  ];

  // 스팸/중복 방지:
  //  1) noindex(자동 생성/GENERATE_COUNT 로 추가된 staging) 페이지는 사이트맵에서 제외
  //  2) 동의어 꼬리말 등 비-canonical URL은 사이트맵에서 제외(대표 URL만 제출)
  //  3) lastmod 생략 — 매 빌드마다 수만 URL이 동시에 변경된 듯 보이는 신호를 피함
  const keywordPages: MetadataRoute.Sitemap = getKeywords()
    .filter((k) => isIndexable(k) && canonicalSlugFor(k) === k.slug)
    .map((k) => ({
      // 한글 슬러그를 퍼센트 인코딩해 페이지 canonical(인코딩 형태)과 정확히 일치시킴
      url: `${siteUrl}/${encodeURIComponent(k.slug)}`,
      changeFrequency: "monthly" as const,
      priority: keywordPriority(String(k.type)),
    }));

  // 지역 허브 페이지(/services/{region}) — region-item 이 있는 지역만(허브 라우트와 일치).
  const hubRegions = [...new Set(getKeywords().filter((k) => k.type === "region-item" && k.region).map((k) => k.region as string))];
  const regionHubPages: MetadataRoute.Sitemap = hubRegions.map((region) => ({
    url: `${siteUrl}/services/${encodeURIComponent(region)}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // 블로그 개별 글 — content/blog/*.json 전체가 posts 로 로드되어 사이트맵에 포함된다.
  //  · URL 세그먼트는 글의 id 를 쓴다. id 는 곧 URL 슬러그로, 라우트(/blog/[id],
  //    generateStaticParams → { id: p.id })와 정확히 일치해야 404 가 나지 않는다.
  //    (별도 slug 필드를 URL 에 쓰려면 라우트도 함께 바꿔야 하므로 여기선 id 로 통일 —
  //     남은 TODO 참고. 지금은 slug 필드가 없어 항상 id 로 동작한다.)
  //  · lastmod 는 updatedAt(최종 수정일) → date(발행일) → SITE_LASTMOD 순으로 안전 폴백.
  //  · id 가 없는(손상된) 글은 방어적으로 제외 — 404 URL 제출을 막는다.
  const blogPages: MetadataRoute.Sitemap = posts
    .filter((p) => typeof p.id === "string" && p.id.length > 0)
    .map((p) => ({
      url: `${siteUrl}/blog/${p.id}`,
      lastModified: safeLastmod(p.updatedAt, p.date),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));

  return [...staticPages, ...regionHubPages, ...keywordPages, ...blogPages];
}
