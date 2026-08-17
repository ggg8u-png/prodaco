import type { Metadata } from "next";
import Link from "next/link";
import { galleryItems } from "@/data/gallery";
import { casePath } from "@/lib/caseDoc";
import { selectWorkPhotos, workPhotoAlt, workPhotoCount } from "@/lib/workPhotos";
import { company } from "@/data/company";
import GalleryImage from "@/components/GalleryImage";
import { Phone } from "lucide-react";
import ui from "../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

const desc = "바닥재 철거·바닥 샌딩 시공 사례. 마루·데코타일·장판·타일 철거 전후 사진과 작업 현장 사진을 확인하세요.";

export const metadata: Metadata = {
  title: "시공 사례",
  description: desc,
  alternates: { canonical: `${siteUrl}/gallery` },
  openGraph: {
    title: "시공 사례 | 프로다",
    description: desc,
    type: "website",
    url: `${siteUrl}/gallery`,
    images: ["/opengraph-image"],
  },
};

// 이 페이지 계층(홈 > 시공사례) — 전역 브레드크럼 제거 후 페이지별로만 출력.
const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "시공사례", item: `${siteUrl}/gallery` },
  ],
};

export default function GalleryPage() {
  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-[0.2em] mb-4">시공 사례</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{ui.galleryPage.h1}</h1>
          <p className="text-gray-400 text-sm max-w-xl">
            {ui.galleryPage.intro}
          </p>
        </div>
      </section>

      {/* 비포·애프터 */}
      <section className="py-14 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="border-b border-gray-200 pb-4 mb-10">
            <h2 className="text-xl font-black">{ui.galleryPage.beforeAfterLabel}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {galleryItems.map((item) => (
              <div key={item.id}>
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
                {/* 상세 문서로 가는 <a href> — 검색로봇이 목록에서 개별 사례를 발견하는 유일한 경로다.
                    JS 클릭 핸들러가 아니라 실제 링크여야 한다. */}
                <Link href={casePath(item.id)} className="group block">
                  <p className="font-bold text-sm transition-colors group-hover:text-[#9A8A2E]">{item.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{item.description}</p>
                </Link>
                <div className="flex gap-2 mt-1.5">
                  <span className="text-xs text-[#9A8A2E] font-semibold">{item.region}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">{item.item}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 작업 현장 — 승인된 자체 호스팅 풀에서 고정 24장(전체 나열은 모바일 성능상 제외) */}
      <section className="py-14 px-5 bg-[#F7F6F3]">
        <div className="max-w-5xl mx-auto">
          <div className="border-b border-gray-200 pb-4 mb-10">
            <h2 className="text-xl font-black">{ui.galleryPage.worksiteLabel}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {selectWorkPhotos("gallery", 24).map((photo) => (
              <img
                key={photo.id}
                src={photo.thumb}
                alt={workPhotoAlt("gallery", photo.id)}
                width={photo.thumbWidth}
                height={photo.thumbHeight}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover bg-[#EDEBE4]"
              />
            ))}
          </div>
          {workPhotoCount() > 24 && (
            <p className="text-xs text-gray-400 mt-4 leading-relaxed">
              전체 {workPhotoCount()}장 중 일부입니다. 사진은 특정 지역·공정 순서와 무관한 실제 작업 현장 기록입니다.
            </p>
          )}
        </div>
      </section>

      <section className="py-12 px-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-5 border-l-4 border-[#FFD400] pl-5">
          <p className="text-gray-600 text-sm leading-relaxed flex-1">
            {ui.galleryPage.ctaCopy.split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br className="hidden md:block" />}
              </span>
            ))}
          </p>
          <a href={company.phoneLink} className="inline-flex items-center gap-2 bg-[#FFD400] text-[#16181D] font-bold px-6 py-3 text-sm shrink-0 hover:bg-[#FFE34D] transition-colors">
            <Phone size={15} /> {company.phone}
          </a>
        </div>
      </section>

    </div>
  );
}
