// 시공사례 목록 2페이지 이후. 1페이지는 /gallery 이므로 여기서는 만들지 않는다.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { galleryItems } from "@/data/gallery";
import CaseGrid from "@/components/CaseGrid";
import { paginate, extraPageNumbers, pageHref, CASE_PAGE_SIZE } from "@/lib/pagination";
import ui from "../../../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

export async function generateStaticParams() {
  return extraPageNumbers(galleryItems.length, CASE_PAGE_SIZE).map((n) => ({ n: String(n) }));
}

function parsePage(raw: string, total: number): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  const totalPages = Math.max(1, Math.ceil(total / CASE_PAGE_SIZE));
  return n >= 2 && n <= totalPages ? n : null;
}

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const { n: raw } = await params;
  const n = parsePage(raw, galleryItems.length);
  if (!n) return {};
  const url = `${siteUrl}${pageHref("/gallery", n)}`;
  const totalPages = Math.max(1, Math.ceil(galleryItems.length / CASE_PAGE_SIZE));
  return {
    title: `시공 사례 (${n}/${totalPages}페이지)`,
    description: `마루·데코타일·장판·타일 철거 전후 시공 사례 목록 ${n}페이지입니다.`,
    alternates: { canonical: url },
  };
}

export default async function GalleryPagedPage({ params }: { params: Promise<{ n: string }> }) {
  const { n: raw } = await params;
  const n = parsePage(raw, galleryItems.length);
  if (!n) notFound();

  const paged = paginate(galleryItems, "/gallery", CASE_PAGE_SIZE, n);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "시공사례", item: `${siteUrl}/gallery` },
      { "@type": "ListItem", position: 3, name: `${n}페이지`, item: `${siteUrl}${pageHref("/gallery", n)}` },
    ],
  };

  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {paged.prevHref && <link rel="prev" href={`${siteUrl}${paged.prevHref}`} />}
      {paged.nextHref && <link rel="next" href={`${siteUrl}${paged.nextHref}`} />}

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-[0.2em] mb-4">시공 사례</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3">
            {ui.galleryPage.h1} <span className="text-gray-500 text-2xl md:text-3xl">{n}페이지</span>
          </h1>
        </div>
      </section>

      <CaseGrid paged={paged} heading={ui.galleryPage.beforeAfterLabel} />
    </div>
  );
}
