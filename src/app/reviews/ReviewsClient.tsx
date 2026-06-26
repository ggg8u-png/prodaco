"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { allReviews } from "@/data/reviews";
import ui from "../../../content/ui.json";

export default function ReviewsClient() {
  const [filter, setFilter] = useState<"all" | "consumer" | "business">("all");
  const filtered = filter === "all" ? allReviews : allReviews.filter((r) => r.type === filter);

  return (
    <div className="pb-20 md:pb-0">

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-[0.2em] mb-4">{ui.regionPage.reviewsLabel}</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{ui.reviewsPage.h1}</h1>
          <p className="text-gray-400 text-sm">
            실제 고객 후기와 함께, 상담 사례 기반 &lsquo;예시&rsquo; 후기가 포함되어 있습니다. 각 카드에 라벨로 구분해 표기합니다.
          </p>
        </div>
      </section>

      <section className="py-12 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 mb-10">
            {ui.reviewsPage.filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as typeof filter)}
                className={`px-4 py-1.5 text-sm font-semibold transition-colors border ${
                  filter === tab.value
                    ? "bg-[#16181D] text-white border-[#16181D]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100">
            {filtered.map((review) => (
              <div key={review.id} className="bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-0.5 text-yellow-400">
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Star key={i} size={13} fill="currentColor" />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        review.sample ? "bg-gray-100 text-gray-500" : "bg-[#FFD400]/20 text-[#9A8A2E]"
                      }`}
                    >
                      {review.sample ? ui.reviewsPage.sampleLabel : ui.reviewsPage.realLabel}
                    </span>
                    <span className={`text-xs font-semibold ${review.type === "business" ? "text-blue-600" : "text-green-600"}`}>
                      {review.type === "business" ? "업체·시공팀" : "일반 고객"}
                    </span>
                  </div>
                </div>
                <p className="text-xl font-black text-gray-200 leading-none mb-2">&ldquo;</p>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">{review.content}</p>
                <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
                  {review.name} · {review.region} · {review.item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
