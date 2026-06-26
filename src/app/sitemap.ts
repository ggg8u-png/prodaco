import type { MetadataRoute } from "next";
import { getKeywords, canonicalSlugFor, isIndexable } from "@/data/keywords";
import { posts } from "@/data/posts";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

// 콘텐츠 버전 날짜 — 정적 페이지 lastmod 기준(매 빌드 갱신 신호 방지).
const SITE_LASTMOD = new Date("2026-06-23");

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

  const blogPages: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${siteUrl}/blog/${p.id}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...regionHubPages, ...keywordPages, ...blogPages];
}
