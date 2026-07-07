"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import type { Review } from "@/types";
import { reviews as actualReviews, sampleReviews } from "@/data/reviews";
import ui from "../../../content/ui.json";

type Filter = "all" | "consumer" | "business";

// 실제 후기 카드 — 별점 UI 노출(검증된 실제 후기만).
function ActualCard({ review }: { review: Review }) {
  return (
    <div className="bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-0.5 text-yellow-400" aria-label={`별점 ${review.rating}점`}>
          {Array.from({ length: Math.max(0, Math.min(5, review.rating)) }).map((_, i) => (
            <Star key={i} size={13} fill="currentColor" />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-sm bg-[#FFD400]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A8A2E]">
            {ui.reviewsPage.realLabel}
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
  );
}

// 상황 예시 카드 — 별점 없음, 실제 후기와 시각적으로 확연히 구분(회색 배경·점선 테두리).
// 실제 후기가 아니라 '상담 사례'임을 카드 단위로도 명시해 E-E-A-T/검색정책 리스크를 차단한다.
function ExampleCard({ review }: { review: Review }) {
  return (
    <div className="border border-dashed border-gray-300 bg-[#F4F4F1] p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded-sm bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {ui.reviewsPage.sampleLabel}
          </span>
          <span className="text-[10px] font-semibold text-gray-400">{ui.reviewsPage.exampleCardHint}</span>
        </span>
        <span className={`text-xs font-semibold ${review.type === "business" ? "text-blue-500" : "text-green-600"}`}>
          {review.type === "business" ? "업체·시공팀" : "일반 고객"}
        </span>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-gray-600">{review.content}</p>
      <p className="border-t border-dashed border-gray-300 pt-4 text-xs text-gray-400">
        {review.region} · {review.item}
      </p>
    </div>
  );
}

export default function ReviewsClient() {
  const [filter, setFilter] = useState<Filter>("all");
  const byFilter = (r: Review) => filter === "all" || r.type === filter;
  const actual = actualReviews.filter(byFilter);
  const examples = sampleReviews.filter(byFilter);

  return (
    <div className="pb-20 md:pb-0">

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-[0.2em] mb-4">{ui.regionPage.reviewsLabel}</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{ui.reviewsPage.h1}</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {ui.reviewsPage.intro}
          </p>
        </div>
      </section>

      <section className="py-12 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 mb-10">
            {ui.reviewsPage.filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as Filter)}
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

          {/* 실제 고객 후기 — 검증된 후기만, 별점 표시 */}
          {actual.length > 0 && (
            <div className="mb-14">
              <p className="mb-4 font-mono-pd text-xs font-bold uppercase tracking-[0.16em] text-[#9A8A2E]">
                {ui.reviewsPage.actualSectionLabel}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100">
                {actual.map((review) => (
                  <ActualCard key={review.id} review={review} />
                ))}
              </div>
            </div>
          )}

          {/* 상황 예시(상담 사례) — 별점 없음, 실제 후기가 아님을 명시 */}
          {examples.length > 0 && (
            <div>
              <p className="mb-1.5 font-mono-pd text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                {ui.reviewsPage.exampleSectionLabel}
              </p>
              <p className="mb-4 text-xs text-gray-400 leading-relaxed">{ui.reviewsPage.exampleSectionNote}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {examples.map((review) => (
                  <ExampleCard key={review.id} review={review} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
