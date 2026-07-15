import type { MetadataRoute } from "next";

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
    // 표준 크롤러 — 관리자(/admin)만 색인 제외(업로드 이미지는 이미지검색 허용)
    { userAgent: "*", allow: "/", disallow: ["/admin/"] },
    // 네이버 크롤러(Yeti) — 명시적 허용(관리자만 제외). 네이버 서치어드바이저 수집 대상.
    { userAgent: "Yeti", allow: "/", disallow: ["/admin/"] },
  ];

  return { rules, sitemap: `${siteUrl}/sitemap.xml` };
}
