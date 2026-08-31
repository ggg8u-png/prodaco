// 시공사례 비포·애프터 그리드 — /gallery(1페이지)와 /gallery/page/N 이 같은 마크업을 쓴다.
import Link from "next/link";
import type { GalleryItem } from "@/types";
import GalleryImage from "@/components/GalleryImage";
import Pagination from "@/components/Pagination";
import type { Paged } from "@/lib/pagination";
import { caseFeaturedImage } from "@/lib/featuredImage";

export default function CaseGrid({ paged, heading }: { paged: Paged<GalleryItem>; heading: string }) {
  return (
    <section className="py-14 px-5">
      <div className="max-w-5xl mx-auto">
        <div className="border-b border-gray-200 pb-4 mb-10">
          <h2 className="text-xl font-black">{heading}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {paged.items.map((item) => {
            const featured = caseFeaturedImage(item);
            return (
            <div key={item.id}>
              {featured.source === "custom" ? (
                <GalleryImage
                  src={featured.src}
                  alt={featured.alt}
                  label="대표 사진"
                  className="mb-3 h-52 w-full"
                />
              ) : (
              <div className="grid grid-cols-2 gap-0.5 mb-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Before</p>
                  <GalleryImage src={item.beforeImage} alt={`${item.title} 철거 전`} className="h-36 w-full" />
                </div>
                <div>
                  <p className="font-mono-pd text-xs text-[#9A8A2E] font-bold uppercase tracking-widest mb-1">After</p>
                  <GalleryImage src={item.afterImage} alt={`${item.title} 샌딩 후`} className="h-36 w-full" />
                </div>
              </div>
              )}
              {/* 상세 문서로 가는 <a href> — 검색로봇이 목록에서 개별 사례를 발견하는 유일한 경로다.
                  JS 클릭 핸들러가 아니라 실제 링크여야 한다. */}
              <Link href={`/gallery/${encodeURIComponent(item.id)}`} className="group block">
                <p className="font-bold text-sm transition-colors group-hover:text-[#9A8A2E]">{item.title}</p>
                <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{item.description}</p>
              </Link>
              <div className="flex gap-2 mt-1.5">
                <span className="text-xs text-[#9A8A2E] font-semibold">{item.region}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{item.item}</span>
              </div>
            </div>
            );
          })}
        </div>
        <Pagination paged={paged} label="시공사례 목록 페이지 이동" />
      </div>
    </section>
  );
}
