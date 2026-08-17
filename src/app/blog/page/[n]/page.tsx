// 블로그 목록 2페이지 이후. 1페이지는 /blog 이므로 여기서는 만들지 않는다.
// 각 페이지는 self-canonical + index — 2페이지를 1페이지로 canonical 하면 거기 실린
// 글들이 발견 경로를 잃는다.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { posts } from "@/data/posts";
import BlogList from "@/components/BlogList";
import { paginate, extraPageNumbers, pageHref, BLOG_PAGE_SIZE } from "@/lib/pagination";
import ui from "../../../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

export async function generateStaticParams() {
  return extraPageNumbers(posts.length, BLOG_PAGE_SIZE).map((n) => ({ n: String(n) }));
}

function parsePage(raw: string, total: number): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  // 1페이지는 /blog 가 담당하고, 범위를 넘는 번호는 존재하지 않는 페이지다.
  return n >= 2 && n <= totalPages ? n : null;
}

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const { n: raw } = await params;
  const n = parsePage(raw, posts.length);
  if (!n) return {};
  const url = `${siteUrl}${pageHref("/blog", n)}`;
  const totalPages = Math.max(1, Math.ceil(posts.length / BLOG_PAGE_SIZE));
  return {
    title: `바닥재 철거 정보 (${n}/${totalPages}페이지)`,
    description: `바닥재 철거 비용·방법·주의사항 정보 글 목록 ${n}페이지입니다.`,
    alternates: { canonical: url },
  };
}

export default async function BlogPagedPage({ params }: { params: Promise<{ n: string }> }) {
  const { n: raw } = await params;
  const n = parsePage(raw, posts.length);
  if (!n) notFound();

  const paged = paginate(posts, "/blog", BLOG_PAGE_SIZE, n);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "바닥철거 정보", item: `${siteUrl}/blog` },
      { "@type": "ListItem", position: 3, name: `${n}페이지`, item: `${siteUrl}${pageHref("/blog", n)}` },
    ],
  };

  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {/* 순서 신호 — 수집기가 목록의 앞뒤를 알 수 있게 한다. */}
      {paged.prevHref && <link rel="prev" href={`${siteUrl}${paged.prevHref}`} />}
      {paged.nextHref && <link rel="next" href={`${siteUrl}${paged.nextHref}`} />}

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-[0.2em] mb-4">{ui.blogPage.badge}</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3">
            {ui.blogPage.h1} <span className="text-gray-500 text-2xl md:text-3xl">{n}페이지</span>
          </h1>
          <p className="text-gray-400 text-sm">{ui.blogPage.subheading}</p>
        </div>
      </section>

      <BlogList paged={paged} />
    </div>
  );
}
