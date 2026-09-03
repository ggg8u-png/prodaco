import type { Metadata } from "next";
import Image from "next/image";
import { galleryItems } from "@/data/gallery";
import CaseGrid from "@/components/CaseGrid";
import { paginate, CASE_PAGE_SIZE } from "@/lib/pagination";
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

      <CaseGrid paged={paginate(galleryItems, "/gallery", CASE_PAGE_SIZE, 1)} heading={ui.galleryPage.beforeAfterLabel} />

      {/* 작업 현장 — 승인된 자체 호스팅 풀에서 고정 24장(전체 나열은 모바일 성능상 제외) */}
      <section className="py-14 px-5 bg-[#F7F6F3]">
        <div className="max-w-5xl mx-auto">
          <div className="border-b border-gray-200 pb-4 mb-10">
            <h2 className="text-xl font-black">{ui.galleryPage.worksiteLabel}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {selectWorkPhotos("gallery", 24).map((photo) => (
              <Image
                key={photo.id}
                src={photo.thumb}
                alt={workPhotoAlt("gallery", photo.id)}
                width={photo.thumbWidth}
                height={photo.thumbHeight}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
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
