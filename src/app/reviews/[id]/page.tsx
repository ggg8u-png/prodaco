// 고객후기 상세 — 실제 후기만 독립 URL(/reviews/<id>)을 갖는다.
//
// '상황 예시(상담 사례)' 후기는 여기서 페이지가 만들어지지 않는다(src/lib/reviewDoc.ts).
// 지어낸 후기를 독립 웹문서로 발행하는 셈이 되기 때문이다.
// 색인은 기본 꺼짐 — 운영자가 CMS 에서 '검색 노출 허용' 을 켠 후기 중 본문이 충분히
// 긴 것만 index 된다. 나머지는 noindex,follow 로 남아 주소는 유효하되 검색결과에는
// 얇은 페이지가 늘지 않는다.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import CtaBand from "@/components/CtaBand";
import { company } from "@/data/company";
import { getKeywordBySlug, hubDecisionFor } from "@/data/keywords";
import { indexabilityFor } from "@/lib/seo/indexability";
import {
  reviewPath,
  reviewUrl,
  reviewById,
  reviewPageItems,
  isReviewIndexable,
  reviewDescription,
  decodeReviewId,
} from "@/lib/reviewDoc";
import ui from "../../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

export async function generateStaticParams() {
  return reviewPageItems().map((r) => ({ id: r.id }));
}

function titleFor(r: { region: string; item: string }): string {
  return `${r.region} ${r.item} 고객 후기`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: rawId } = await params;
  const r = reviewById(decodeReviewId(rawId));
  if (!r) return {};
  const url = reviewUrl(siteUrl, r.id);
  const description = reviewDescription(r);
  return {
    title: titleFor(r),
    description,
    alternates: { canonical: url },
    ...(isReviewIndexable(r) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title: `${titleFor(r)} | 프로다`,
      description,
      type: "article",
      url,
      images: ["/opengraph-image"],
    },
  };
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const r = reviewById(decodeReviewId(rawId));
  if (!r) notFound();

  const url = reviewUrl(siteUrl, r.id);
  const title = titleFor(r);

  // 관련 서비스 — 후기의 지역·품목에 해당하는 색인 대상 페이지만 연결한다.
  const links: Array<{ href: string; label: string }> = [];
  const comboSlug = `${r.region}-${r.item.replace(/\s+/g, "").replace(/\(.*\)$/, "")}`;
  const combo = getKeywordBySlug(comboSlug);
  if (combo && indexabilityFor(combo).indexable) {
    links.push({ href: `/${encodeURIComponent(comboSlug)}`, label: `${r.region} ${combo.item ?? r.item}` });
  }
  if (hubDecisionFor(r.region).index) {
    links.push({ href: `/services/${encodeURIComponent(r.region)}`, label: `${r.region} 전체 서비스` });
  }

  const others = reviewPageItems().filter((x) => x.id !== r.id).slice(0, 3);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "고객 후기", item: `${siteUrl}/reviews` },
      { "@type": "ListItem", position: 3, name: title, item: url },
    ],
  };

  // Review 구조화데이터는 색인 대상(운영자가 검증·공개를 켠 후기)에만 붙인다.
  // 자기평가 리치결과 정책 리스크 때문에 aggregateRating 은 만들지 않는다 — 개별 Review 만.
  const reviewJsonLd = isReviewIndexable(r)
    ? {
        "@context": "https://schema.org",
        "@type": "Review",
        "@id": url,
        url,
        inLanguage: "ko",
        itemReviewed: { "@type": "Service", name: `${r.item} · ${r.region}`, provider: { "@id": `${siteUrl}/#business` } },
        reviewBody: r.content,
        author: { "@type": "Person", name: r.name },
        ...(r.date ? { datePublished: r.date } : {}),
        ...(typeof r.rating === "number"
          ? { reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 } }
          : {}),
      }
    : null;

  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {reviewJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJsonLd) }} />
      )}

      <section className="bg-[#16181D] px-5 pt-14 pb-12 text-white">
        <div className="mx-auto max-w-3xl">
          <nav className="mb-5 flex items-center gap-2 text-xs text-gray-500">
            <Link href="/" className="hover:text-gray-300">홈</Link>
            <span>›</span>
            <Link href="/reviews" className="hover:text-gray-300">고객 후기</Link>
            <span>›</span>
            <span className="text-gray-400">{r.region}</span>
          </nav>
          <p className="font-mono-pd mb-3 text-xs font-bold uppercase tracking-widest text-[#FFD400]">
            {ui.reviewsPage.realLabel}
          </p>
          <h1 className="mb-4 text-2xl font-black leading-tight md:text-3xl">{title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className="flex gap-0.5 text-[#FFD400]" aria-label={`별점 ${r.rating}점`}>
              {Array.from({ length: Math.max(0, Math.min(5, r.rating)) }).map((_, i) => (
                <Star key={i} size={13} fill="currentColor" />
              ))}
            </span>
            <span>{r.type === "business" ? "업체·시공팀" : "일반 고객"}</span>
            {r.date && <time dateTime={r.date}>{r.date}</time>}
          </div>
        </div>
      </section>

      <section className="px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <blockquote className="border-l-4 border-[#FFD400] pl-5 text-[16px] leading-[1.9] text-[#3A4048]">
            {r.content}
          </blockquote>
          <p className="mt-5 border-t border-gray-200 pt-4 text-[13px] text-gray-500">
            {r.name} · {r.region} · {r.item}
          </p>

          {links.length > 0 && (
            <section className="mt-10">
              <h2 className="font-mono-pd mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9A8A2E]">관련 서비스</h2>
              <div className="flex flex-wrap gap-2">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#16181D] transition-colors hover:border-[#9A8A2E] hover:text-[#9A8A2E]"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className="mt-12">
              <h2 className="font-mono-pd mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#9A8A2E]">다른 후기</h2>
              <div className="divide-y divide-gray-100 border-t border-gray-200">
                {others.map((o) => (
                  <Link key={o.id} href={reviewPath(o.id)} className="group flex items-start gap-3 py-4">
                    <span className="font-mono-pd w-16 shrink-0 pt-0.5 text-[11px] font-bold uppercase text-[#9A8A2E]">{o.region}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold leading-snug text-[#16181D] transition-colors group-hover:text-[#9A8A2E]">
                        {o.item}
                      </span>
                      <span className="mt-1 line-clamp-1 block text-[13px] text-gray-500">{o.content}</span>
                    </span>
                    <span aria-hidden className="font-mono-pd text-gray-300 transition-colors group-hover:text-[#9A8A2E]">→</span>
                  </Link>
                ))}
              </div>
              <div className="mt-5">
                <Link href="/reviews" className="inline-flex items-center gap-2 text-[14px] font-extrabold text-[#16181D] transition-colors hover:text-[#9A8A2E]">
                  후기 전체 보기 <span aria-hidden className="font-mono-pd">→</span>
                </Link>
              </div>
            </section>
          )}
        </div>
      </section>

      <CtaBand heading={`${company.speciality}, 사진 한 장이면 견적 상담 시작`} />
    </div>
  );
}
