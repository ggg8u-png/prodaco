import type { Metadata } from "next";
import Link from "next/link";
import { posts } from "@/data/posts";
import ui from "../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

const desc = "바닥재 철거 비용, 방법, 주의사항 — 10년 현장 경험에서 나온 정보를 확인하세요.";

export const metadata: Metadata = {
  title: "바닥재 철거 정보",
  description: desc,
  alternates: { canonical: `${siteUrl}/blog` },
  openGraph: {
    title: "바닥재 철거 정보 | 프로다",
    description: desc,
    type: "website",
    url: `${siteUrl}/blog`,
    images: ["/opengraph-image"],
  },
};

const categoryColor: Record<string, string> = Object.fromEntries(
  (ui.blogPage.categoryColors as { category: string; className: string }[]).map(
    (c) => [c.category, c.className]
  )
);

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

      <section className="py-12 px-5">
        <div className="max-w-4xl mx-auto divide-y divide-gray-100">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.id}`}
              className="group flex flex-col md:flex-row gap-4 py-7 hover:bg-gray-50 -mx-2 px-2 transition-colors"
            >
              <div className="md:w-24 md:pt-0.5 shrink-0">
                <p className={`text-xs font-bold uppercase ${categoryColor[post.category] ?? "text-gray-500"}`}>
                  {post.category}
                </p>
                <p className="text-xs text-gray-400 mt-1">{post.date}</p>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-base text-[#16181D] group-hover:text-[#9A8A2E] transition-colors mb-2 leading-snug">
                  {post.title}
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{post.excerpt}</p>
                <div className="flex gap-2 mt-3">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs text-gray-400">#{tag}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
