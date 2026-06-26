import type { MetadataRoute } from "next";
import { allowAiCrawlers } from "@/data/keywords";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";
const productionUrl = "https://prodaco.kr";
const isProduction = siteUrl === productionUrl;

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    // Block all crawlers on staging/preview deployments to prevent duplicate indexing
    return {
      rules: { userAgent: "*", disallow: "/" },
      sitemap: `${siteUrl}/sitemap.xml`,
    };
  }

  const rules: MetadataRoute.Robots["rules"] = [
    // Standard crawlers — 관리자(/admin)·업로드 경로는 색인 제외
    { userAgent: "*", allow: "/", disallow: ["/admin/", "/uploads/"] },
    // 네이버 크롤러(Yeti) — 명시적 허용(관리자·업로드만 제외). 네이버 서치어드바이저 수집 대상.
    { userAgent: "Yeti", allow: "/", disallow: ["/admin/", "/uploads/"] },
  ];

  // 생성형 검색 크롤러(GEO) — CMS content/seo.json 의 allowAiCrawlers 로 on/off.
  if (allowAiCrawlers) {
    rules.push(
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
      { userAgent: "Applebot-Extended", allow: "/" },
    );
  } else {
    // 차단: AI 학습·인용 크롤러를 명시적으로 막는다.
    rules.push(
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "PerplexityBot", disallow: "/" },
      { userAgent: "ClaudeBot", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Applebot-Extended", disallow: "/" },
    );
  }

  return { rules, sitemap: `${siteUrl}/sitemap.xml` };
}
