import type { Metadata } from "next";
import Link from "next/link";
import { Phone, MessageCircle } from "lucide-react";
import { getKeywords } from "@/data/keywords";
import { neighborsOf, clusterLabelOf } from "@/data/regions";
import { FLOOR_COSTS, perPyeongText } from "@/data/costs";
import { pickFaqs } from "@/lib/seo";
import { keyAnswerForRegion } from "@/data/keyAnswer";
import { applyReplacements } from "@/lib/replacements";
import { fillTemplate } from "@/lib/template";
import { company } from "@/data/company";
import { galleryItems } from "@/data/gallery";
import { reviews } from "@/data/reviews";
import GalleryImage from "@/components/GalleryImage";
import KeyAnswer from "@/components/KeyAnswer";
import { notFound } from "next/navigation";
import ui from "../../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

// region-item 키워드가 존재하는 지역만 허브로 생성.
function regionsWithPages(): string[] {
  const set = new Set<string>();
  for (const k of getKeywords()) {
    if (k.type === "region-item" && k.region) set.add(k.region);
  }
  return [...set];
}

// ISR 캐시 — 지역 허브도 CDN 캐시(stale-while-revalidate)로 빠르게 제공(크롤 속도 개선).
// ([slug] 페이지와 동일한 이유. Cache-Control: max-age=0 → 콜드스타트 5초 응답 방지.)
export const revalidate = 86400;

export function generateStaticParams() {
  return regionsWithPages().map((region) => ({ region }));
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rotatePick<T>(arr: T[], seed: number, n: number): T[] {
  if (arr.length <= n) return arr;
  const start = seed % arr.length;
  return Array.from({ length: n }, (_, i) => arr[(start + i) % arr.length]);
}

function itemsForRegion(region: string) {
  return getKeywords().filter((k) => k.type === "region-item" && k.region === region);
}

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }): Promise<Metadata> {
  const { region: raw } = await params;
  const region = decodeURIComponent(raw);
  if (!regionsWithPages().includes(region)) return {};
  const cluster = clusterLabelOf(region);
  const desc = `${region} 바닥재 철거 전문 업체. 강마루·데코타일·장판·타일 철거와 바닥 샌딩. ${cluster} 방문, 평당 참고가 1만~8만원(실측 정산), ${company.experience} 경력. 당일 상담 ☎ ${company.phone}`;
  return {
    title: `${region} 바닥재 철거 · 마루/타일/장판 전문`,
    description: desc,
    alternates: { canonical: `${siteUrl}/services/${encodeURIComponent(region)}` },
    openGraph: {
      title: `${region} 바닥재 철거 | 프로다`,
      description: desc,
      type: "website",
      url: `${siteUrl}/services/${encodeURIComponent(region)}`,
      images: ["/opengraph-image"],
    },
    other: { "geo.region": "KR", "geo.placename": region },
  };
}

export default async function RegionHub({ params }: { params: Promise<{ region: string }> }) {
  const { region: raw } = await params;
  const region = decodeURIComponent(raw);
  if (!regionsWithPages().includes(region)) notFound();

  const seed = seedOf(region);
  const items = itemsForRegion(region);
  const cluster = clusterLabelOf(region);
  // 인접 지역 링크는 '허브가 실제로 존재하는 지역'만(neighborsOf 는 인접 클러스터 데이터라
  // region-item 이 없는 지역(예: 평택)도 포함될 수 있어 그대로 링크하면 /services/평택 404 발생).
  const hubSet = new Set(regionsWithPages());
  const neighbors = neighborsOf(region, 10).filter((nb) => hubSet.has(nb)).slice(0, 6);
  // 이 지역 실제 사례가 충분하면 우선 노출, 아니면 수도권 유사 사례로 명시(지역 실적 오인 방지).
  const regionCases = galleryItems.filter((c) => c.region === region);
  const casesAreLocal = regionCases.length >= 2;
  const cases = rotatePick(casesAreLocal ? regionCases : galleryItems, seed, 3);
  const pageReviews = rotatePick(reviews, seed, 2);
  const reviewsAreLocal = pageReviews.every((r) => r.region === region);
  const faqSubset = pickFaqs({ slug: `region-${region}`, keyword: `${region} 바닥재 철거`, type: "region-item", region, item: "바닥재 철거" }, 4);
  // GEO/AEO 핵심 답변(지역 단위) — H1 아래 노출 + FAQ 스키마 맨 앞 대표 질문으로 병합.
  const keyAnswer = keyAnswerForRegion(region);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "서비스 안내", item: `${siteUrl}/services` },
      { "@type": "ListItem", position: 3, name: `${region} 바닥재 철거`, item: `${siteUrl}/services/${encodeURIComponent(region)}` },
    ],
  };
  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#business`,
    name: company.brandName,
    description: company.geoSummary,
    telephone: company.phone,
    url: `${siteUrl}/services/${encodeURIComponent(region)}`,
    image: `${siteUrl}/opengraph-image`,
    priceRange: "평당 1만~8만원대 (바닥재·면적별, 실측 정산)",
    areaServed: { "@type": "City", name: region },
    knowsAbout: company.services.map((s) => s.name),
    address: { "@type": "PostalAddress", addressRegion: region, addressCountry: "KR" },
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: keyAnswer.question, acceptedAnswer: { "@type": "Answer", text: keyAnswer.answer } },
      ...faqSubset
        .filter((f) => f.question !== keyAnswer.question)
        .map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
    ],
  };

  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-3xl mx-auto">
          <nav className="text-gray-500 text-xs mb-5 flex items-center gap-2 flex-wrap">
            <Link href="/" className="hover:text-gray-300">홈</Link>
            <span>›</span>
            <Link href="/services" className="hover:text-gray-300">서비스 안내</Link>
            <span>›</span>
            <span className="text-gray-400">{region}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{region} 바닥재 철거</h1>
          <p className="text-gray-400 text-sm mb-8 max-w-lg leading-relaxed">
            {/* fillTemplate: "{region}을(를)" 같은 조사 병기 표기를 받침에 맞는 조사로 교정한다
                ("판교을(를)" 노출 버그 수정 — 판교를 / 성남을). */}
            {fillTemplate(ui.regionPage.introTemplate, {
              region,
              cluster,
              experience: company.experience,
            })}
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={company.phoneLink} className="inline-flex items-center gap-2 rounded-sm bg-[#FFD400] text-[#16181D] font-bold px-6 py-3 text-sm hover:bg-[#FFE34D] transition-colors">
              <Phone size={16} /> {company.phone}
            </a>
            <a href={company.kakaoUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-sm border-2 border-white/30 text-white font-bold px-6 py-3 text-sm hover:border-[#FFD400] hover:text-[#FFD400] transition-colors">
              <MessageCircle size={16} /> {ui.header.kakaoCta}
            </a>
          </div>
        </div>
      </section>

      {/* GEO/AEO 빠른 답변 — H1 바로 아래(지역 단위), 질문형 + 핵심 답변 + 보충 + CTA */}
      <KeyAnswer {...keyAnswer} />

      {items.length > 0 && (
        <section className="py-12 px-5">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">{ui.regionPage.capabilitiesLabel.replace("{region}", region)}</p>
            <div className="flex flex-wrap gap-2">
              {items.map((k) => (
                <Link
                  key={k.slug}
                  href={`/${k.slug}`}
                  className="text-sm font-medium text-[#16181D] px-3.5 py-2 border border-gray-300 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
                >
                  {applyReplacements(k.keyword)}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-10 px-5 bg-[#F7F6F3]">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{ui.regionPage.pricingLabel.replace("{region}", region)}</p>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            {ui.regionPage.pricingDisclaimer}<strong>{ui.regionPage.pricingDisclaimerStrong}</strong>{ui.regionPage.pricingDisclaimerSuffix}
          </p>
          <div className="overflow-hidden border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#16181D] text-white text-left">
                  <th className="px-4 py-2.5 font-semibold">{ui.regionPage.tableHeaders.material}</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">{ui.regionPage.tableHeaders.price}</th>
                  <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">{ui.regionPage.tableHeaders.note}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {FLOOR_COSTS.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-2.5 font-medium text-[#16181D]">{row.label}</td>
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{perPyeongText(row)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs hidden sm:table-cell">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {cases.length > 0 && (
        <section className="py-10 px-5">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">
              {casesAreLocal ? `${region} ${ui.regionPage.casesLabel}` : `수도권 유사 시공 사례 · Before / After`}
            </p>
            {!casesAreLocal && (
              <p className="text-xs text-gray-400 -mt-3 mb-5 leading-relaxed">
                아래는 {region} 현장이 아닌 수도권에서 진행한 유사 바닥재 시공 사례입니다(카드에 실제 작업 지역 표기). 같은 팀·같은 방식으로 작업하며, {region} 방문 상담이 가능합니다.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {cases.map((c) => (
                <div key={c.id} className="border border-gray-200">
                  <div className="grid grid-cols-2">
                    <GalleryImage src={c.beforeImage} alt={`${c.title} 철거 전`} label={ui.regionPage.beforeLabel} className="aspect-square" />
                    <GalleryImage src={c.afterImage} alt={`${c.title} 작업 후`} label={ui.regionPage.afterLabel} className="aspect-square" />
                  </div>
                  <div className="px-3 py-3">
                    <p className="text-sm font-bold text-[#16181D]">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.region} · {c.item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {pageReviews.length > 0 && (
        <section className="py-10 px-5 bg-[#F7F6F3]">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">
              {reviewsAreLocal ? ui.regionPage.reviewsLabel : `${ui.regionPage.reviewsLabel} · 수도권 유사 작업`}
            </p>
            {!reviewsAreLocal && (
              <p className="text-xs text-gray-400 -mt-3 mb-5 leading-relaxed">
                같은 품목의 수도권 실제 작업 후기입니다(표기 지역 = 실제 작업 지역).
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pageReviews.map((r) => (
                <figure key={r.id} className="bg-white border border-gray-200 p-4">
                  <div className="flex items-center gap-1 text-[#FFB300] text-sm mb-2" aria-label={`별점 ${r.rating}점`}>
                    {"★".repeat(Math.max(0, Math.min(5, r.rating)))}
                    <span className="text-gray-300">{"★".repeat(5 - Math.max(0, Math.min(5, r.rating)))}</span>
                  </div>
                  <blockquote className="text-sm text-gray-700 leading-relaxed line-clamp-5">{r.content}</blockquote>
                  <figcaption className="text-xs text-gray-500 mt-3">{r.name} · {r.region} · {r.item}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-10 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">{ui.regionPage.faqLabel}</p>
          <div className="divide-y divide-gray-100">
            {faqSubset.map((faq) => (
              <details key={faq.id} className="group py-4">
                <summary className="font-semibold text-sm cursor-pointer list-none flex justify-between items-center gap-4">
                  {faq.question}
                  <span className="text-[#16181D] shrink-0 text-lg font-light group-open:rotate-45 transition-transform inline-block">+</span>
                </summary>
                <p className="text-gray-500 text-sm mt-3 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {neighbors.length > 0 && (
        <section className="py-10 px-5 bg-[#F7F6F3]">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{ui.regionPage.neighborhoodLabel.replace("{cluster}", cluster)}</p>
            <div className="flex flex-wrap gap-2">
              {neighbors.map((nb) => (
                <Link
                  key={nb}
                  href={`/services/${encodeURIComponent(nb)}`}
                  className="text-xs font-medium text-[#16181D] px-3 py-1.5 border border-gray-300 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
                >
                  {nb} 바닥재 철거
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-14 px-5 bg-[#16181D]">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-widest mb-2">{ui.regionPage.ctaBadge}</p>
            <h2 className="text-xl md:text-2xl font-black text-white">{ui.regionPage.ctaHeading.replace("{region}", region)}<br />{ui.regionPage.ctaHeadingLine2}</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <a href={company.phoneLink} className="inline-flex items-center gap-2 rounded-sm bg-[#FFD400] text-[#16181D] font-bold px-6 py-3 text-sm hover:bg-[#FFE34D] transition-colors">
              <Phone size={16} /> {company.phone}
            </a>
            <a href={company.kakaoUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-sm border-2 border-white/30 text-white font-bold px-6 py-3 text-sm hover:border-[#FFD400] hover:text-[#FFD400] transition-colors">
              <MessageCircle size={16} /> {ui.regionPage.kakaoCta}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
