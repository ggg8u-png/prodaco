import type { Metadata } from "next";
import { faqs } from "@/data/faq";
import ui from "../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

const desc = "바닥재 철거 관련 자주 묻는 질문. 비용 산정, 소요시간, 폐기물 처리, 원상복구, 면적 계산, 바닥 샌딩 차이 등 궁금한 점을 확인하세요.";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
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

const categories = Array.from(new Set(faqs.map((f) => f.category)));

export default function FaqPage() {
  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

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
