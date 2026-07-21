"use client";
import { useEffect, useRef } from "react";
import type { Review } from "@/types";
import { isExampleReview } from "@/data/reviews";

// 후기를 옆으로 흘려보내는 가로 마퀴. 마우스 오버 시 정지(.pd-marquee-x:hover).
//  · 실제 후기(검증)  → 별점 + '실제 후기' 라벨
//  · 상황 예시(상담 사례) → 별점 없이 '상담 사례' 라벨 (허위 별점 방지)
function Card({ review }: { review: Review }) {
  const example = isExampleReview(review);
  return (
    <div className="flex w-[300px] shrink-0 flex-col rounded-sm border border-white/[0.1] bg-[#22262E] p-6 sm:w-[340px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        {example ? (
          <span className="font-mono-pd text-[11px] font-bold uppercase tracking-[0.1em] text-[#7B818C]">상담 사례</span>
        ) : (
          <span className="text-sm tracking-[0.12em] text-[#FFD400]">{"★".repeat(Math.max(0, Math.min(5, review.rating)))}</span>
        )}
        {example ? (
          <span className="rounded-sm border border-white/15 px-1.5 py-0.5 font-mono-pd text-[10px] font-bold uppercase tracking-[0.1em] text-[#7B818C]">
            상황 예시
          </span>
        ) : (
          <span className="rounded-sm bg-[#FFD400]/15 px-1.5 py-0.5 font-mono-pd text-[10px] font-bold uppercase tracking-[0.1em] text-[#FFD400]">
            실제 후기
          </span>
        )}
      </div>
      <p className="mb-5 line-clamp-5 flex-1 text-[14.5px] leading-[1.7] text-[#D6D9DE]">{review.content}</p>
      <p className="text-[13px] font-bold text-[#8B919B]">
        {example ? `${review.region} · ${review.item}` : `${review.name} · ${review.region} · ${review.item}`}
      </p>
    </div>
  );
}

export default function ReviewsMarquee({ reviews }: { reviews: Review[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  // 새로고침마다 시작 위치를 랜덤화 — 항상 같은 순서로 보이는 느낌 방지
  useEffect(() => {
    if (!trackRef.current) return;
    const offset = Math.random() * 50; // 0~50% 범위 내 랜덤 오프셋 (루프 절반 이내)
    trackRef.current.style.animationDelay = `-${offset}s`;
  }, []);

  return (
    <div
      className="group relative -mx-4 overflow-hidden sm:-mx-6 lg:-mx-10"
      role="region"
      aria-label="고객 후기 모음 (가로 스크롤)"
    >
      {/* 양 끝 페이드 */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#16181D] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#16181D] to-transparent" />
      <div ref={trackRef} className="pd-marquee-x flex w-max gap-4 px-4 sm:gap-6 sm:px-6 lg:px-10">
        {reviews.map((r) => (
          <Card key={r.id} review={r} />
        ))}
        {/* 끊김 없는 루프용 복제 — 시각 효과 전용이라 접근성 트리·봇 텍스트에서 제외 */}
        <div aria-hidden="true" className="contents">
          {reviews.map((r) => (
            <Card key={`dup-${r.id}`} review={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
