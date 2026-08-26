// 블로그 목록 본문 — /blog(1페이지)와 /blog/page/N 이 같은 마크업을 쓴다.
import Link from "next/link";
import type { BlogPost } from "@/types";
import { blogPath } from "@/lib/blogUrl";
import Pagination from "@/components/Pagination";
import type { Paged } from "@/lib/pagination";
import { postFeaturedImage, SITE_OG_IMAGE } from "@/lib/featuredImage";
import { uploadedImage } from "@/lib/cdnImage";
import ui from "../../content/ui.json";

const categoryColor: Record<string, string> = Object.fromEntries(
  (ui.blogPage.categoryColors as { category: string; className: string }[]).map((c) => [c.category, c.className])
);

export default function BlogList({ paged }: { paged: Paged<BlogPost> }) {
  return (
    <section className="py-12 px-5">
      <div className="max-w-4xl mx-auto">
        <div className="divide-y divide-gray-100">
          {paged.items.map((post) => {
            // 카드 썸네일 — 검색결과·SNS 와 같은 사진을 쓴다(src/lib/featuredImage.ts 단일 출처).
            const featured = postFeaturedImage(post);
            return (
            <Link
              key={post.id}
              href={blogPath(post.id)}
              className="group flex flex-col md:flex-row gap-4 py-7 hover:bg-gray-50 -mx-2 px-2 transition-colors"
            >
              <div className="md:w-24 md:pt-0.5 shrink-0">
                <p className={`text-xs font-bold uppercase ${categoryColor[post.category] ?? "text-gray-500"}`}>
                  {post.category}
                </p>
                <p className="text-xs text-gray-400 mt-1">{post.date}</p>
              </div>
              {featured.src !== SITE_OG_IMAGE && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={uploadedImage(featured.src, 320)}
                  alt={featured.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-40 w-full shrink-0 rounded-sm border border-gray-200 bg-gray-100 object-cover md:h-[76px] md:w-[112px]"
                />
              )}
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
            );
          })}
        </div>
        <Pagination paged={paged} label="블로그 글 목록 페이지 이동" />
      </div>
    </section>
  );
}
