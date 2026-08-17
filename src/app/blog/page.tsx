import type { Metadata } from "next";
import { posts } from "@/data/posts";
import BlogList from "@/components/BlogList";
import { paginate, BLOG_PAGE_SIZE } from "@/lib/pagination";
import ui from "../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

const desc = "바닥재 철거 비용, 방법, 주의사항 — 10년 현장 경험에서 나온 정보를 확인하세요.";

export const metadata: Metadata = {
  title: "바닥재 철거 정보",
  description: desc,
  alternates: {
    canonical: `${siteUrl}/blog`,
    // 블로그 목록은 RSS 의 실제 대상 페이지다 — 여기서도 피드를 명시한다.
    types: { "application/rss+xml": `${siteUrl}/rss.xml` },
  },
  openGraph: {
    title: "바닥재 철거 정보 | 프로다",
    description: desc,
    type: "website",
    url: `${siteUrl}/blog`,
    images: ["/opengraph-image"],
  },
};

// 이 페이지 계층(홈 > 바닥철거 정보) — 전역 브레드크럼 제거 후 페이지별로만 출력.
const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "바닥철거 정보", item: `${siteUrl}/blog` },
  ],
};

export default function BlogPage() {
  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-[0.2em] mb-4">{ui.blogPage.badge}</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{ui.blogPage.h1}</h1>
          <p className="text-gray-400 text-sm">{ui.blogPage.subheading}</p>
        </div>
      </section>

      <BlogList paged={paginate(posts, "/blog", BLOG_PAGE_SIZE, 1)} />
    </div>
  );
}
