import type { Metadata } from "next";
import { faqs } from "@/data/faq";
import ui from "../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

const desc = "마루·장판·데코타일·타일 철거 비용과 사진 견적, 작업시간, 폐기물 처리, 바닥 샌딩 및 실측 정산 기준을 안내합니다.";

export const metadata: Metadata = {
  // title template("%s | 프로다")과 합쳐져 "바닥철거 자주 묻는 질문 | 비용·견적·작업시간 | 프로다"로 노출.
  title: "바닥철거 자주 묻는 질문 | 비용·견적·작업시간",
  description: desc,
  alternates: { canonical: `${siteUrl}/faq` },
  openGraph: {
    title: "자주 묻는 질문 | 프로다",
    description: desc,
    type: "website",
    url: `${siteUrl}/faq`,
    images: ["/opengraph-image"],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

// 이 페이지 계층(홈 > 자주 묻는 질문) — 전역 브레드크럼 제거 후 페이지별로만 출력.
const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "자주 묻는 질문", item: `${siteUrl}/faq` },
  ],
};

const categories = Array.from(new Set(faqs.map((f) => f.category)));

export default function FaqPage() {
  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-[0.2em] mb-4">{ui.faqPage.badge}</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{ui.faqPage.heading}</h1>
          <p className="text-gray-400 text-sm">{ui.faqPage.subheading}</p>
        </div>
      </section>

      <section className="py-12 px-5">
        <div className="max-w-3xl mx-auto space-y-12">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="font-mono-pd text-xs font-bold text-[#9A8A2E] uppercase tracking-[0.15em] mb-4">{cat}</p>
              <div className="divide-y divide-gray-100">
                {faqs
                  .filter((f) => f.category === cat)
                  .map((faq) => (
                    <details key={faq.id} className="group py-4">
                      <summary className="font-semibold text-sm cursor-pointer list-none flex justify-between items-center gap-4 text-[#16181D]">
                        {faq.question}
                        <span className="text-[#16181D] shrink-0 text-lg font-light group-open:rotate-45 transition-transform inline-block">+</span>
                      </summary>
                      <p className="text-gray-500 text-sm mt-3 leading-relaxed">{faq.answer}</p>
                    </details>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
