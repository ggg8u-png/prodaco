"use client";
import { useEffect, useState } from "react";
import { company } from "@/data/company";
import { PhoneIcon, KakaoIcon, MessageIcon } from "@/components/icons";

export default function FloatingCTA() {
  // 데스크톱 떠다니는 CTA가 푸터/본문 하단을 가리지 않도록, 푸터가 보이면 숨긴다.
  const [hideDesktop, setHideDesktop] = useState(false);
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setHideDesktop(entry.isIntersecting),
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(footer);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* 모바일: 하단 고정 바 (전화 · 카톡 · 문자) */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] flex gap-2 border-t-2 border-[#FFD400] bg-[#0F1115]/95 p-2.5 backdrop-blur-sm lg:hidden">
        <a
          href={company.phoneLink}
          aria-label={`전화 상담 ${company.phone}`}
          className="flex flex-1 items-center justify-center gap-[6px] rounded-sm bg-[#FFD400] py-3.5 text-[14px] font-extrabold text-[#16181D]"
        >
          <PhoneIcon className="h-[16px] w-[16px]" />
          전화
        </a>
        <a
          href={company.kakaoUrl}
          target="_blank"
          rel="noopener"
          aria-label="카카오톡으로 사진 보내고 상담"
          className="flex flex-1 items-center justify-center gap-[6px] rounded-sm bg-white py-3.5 text-[14px] font-extrabold text-[#16181D]"
        >
          <KakaoIcon className="h-[16px] w-[16px]" />
          카톡
        </a>
        <a
          href={company.smsLink}
          aria-label="문자로 사진 보내기"
          className="flex flex-1 items-center justify-center gap-[6px] rounded-sm border border-white/30 py-3.5 text-[14px] font-extrabold text-white"
        >
          <MessageIcon className="h-[16px] w-[16px]" />
          문자
        </a>
      </div>

      {/* 데스크톱: 우측 하단 플로팅 CTA (푸터가 보이면 숨김 — 콘텐츠 가림 방지) */}
      <div
        className={`fixed bottom-7 right-7 z-[70] hidden flex-col items-stretch gap-2.5 transition-opacity duration-300 lg:flex ${
          hideDesktop ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <a
          href={company.kakaoUrl}
          target="_blank"
          rel="noopener"
          aria-label="카카오톡으로 사진 보내고 빠른 견적 받기"
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-[#FFD400] px-5 py-3.5 text-[15px] font-extrabold text-[#16181D] shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-colors hover:bg-[#FFE34D]"
        >
          <KakaoIcon className="h-[18px] w-[18px]" />
          카톡 상담
        </a>
        <a
          href={company.phoneLink}
          aria-label={`전화 상담 ${company.phone}`}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-[#16181D] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-colors hover:bg-[#22262E]"
        >
          <PhoneIcon className="h-[16px] w-[16px]" />
          {company.phone}
        </a>
        <a
          href={company.smsLink}
          aria-label="문자로 사진 보내기"
          className="inline-flex items-center justify-center gap-2 rounded-sm border-2 border-[#16181D]/15 bg-white px-5 py-2.5 text-[13px] font-bold text-[#16181D] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-colors hover:border-[#16181D]/35"
        >
          <MessageIcon className="h-[15px] w-[15px]" />
          문자로 사진 보내기
        </a>
      </div>
    </>
  );
}
