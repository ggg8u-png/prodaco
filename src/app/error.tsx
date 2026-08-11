"use client";
// 페이지 세그먼트에서 클라이언트 예외가 났을 때의 폴백.
//
// 왜 필요한가 — 이 파일이 없으면 Next.js 는 내장 기본 화면으로 떨어지고, 화면에 남는
// 텍스트는 딱 한 줄이다:
//   "Application error: a client-side exception has occurred while loading prodaco.kr"
// 구글은 페이지를 '렌더링해서' 색인하므로, 크롤러가 렌더하는 순간 예외가 나면 그 한 줄이
// 그대로 제목·본문으로 색인된다. 2026-08 구글 site:prodaco.kr 첫 결과가 실제로 그 상태였다.
// (예외 자체는 재배포 중 청크 해시 불일치처럼 일시적인 원인으로도 발생한다 — 원인을 전부
//  막을 수는 없으므로, '터져도 색인 가능한 실제 내용이 남게' 하는 것이 이 폴백의 목적이다.)
//
// 그래서 여기서는 사과문 한 줄이 아니라 연락 수단과 주요 링크가 있는 실제 콘텐츠를 그린다.
// 새 화면을 만드는 것이지 기존 페이지 디자인을 바꾸는 게 아니다(색상 토큰만 사이트와 맞춤).
import Link from "next/link";
import { useEffect } from "react";
import { company } from "@/data/company";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // 원인 추적용 — 브라우저 콘솔에는 남겨 둔다(운영자가 F12 로 확인 가능).
  useEffect(() => {
    console.error("[prodaco] page error", error?.digest ?? "", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <p className="font-mono-pd text-[11px] font-bold uppercase tracking-[0.18em] text-[#7B818C]">PRODA</p>
      <h1 className="mt-3 text-[26px] font-extrabold leading-[1.35] text-[#16181D] sm:text-[32px]">
        페이지를 표시하지 못했습니다
      </h1>
      <p className="mt-4 text-[15px] leading-[1.75] text-[#4A4F58]">
        일시적인 오류입니다. 잠시 후 다시 시도해 주세요. 급하시면 아래로 바로 연락 주시면 상담 도와드립니다.
        {company.speciality} 문의는 전화·카카오톡·문자 모두 가능합니다.
      </p>

      <div className="mt-7 flex flex-wrap gap-2.5">
        <button
          onClick={reset}
          className="rounded-sm bg-[#16181D] px-5 py-3 text-[14px] font-extrabold text-white transition-colors hover:bg-[#22262E]"
        >
          다시 시도
        </button>
        <a
          href={company.phoneLink}
          className="rounded-sm bg-[#FFD400] px-5 py-3 text-[14px] font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D]"
        >
          전화 {company.phone}
        </a>
        <a
          href={company.kakaoUrl}
          target="_blank"
          rel="noopener"
          className="rounded-sm border-2 border-[#16181D]/15 bg-white px-5 py-3 text-[14px] font-bold text-[#16181D] transition-colors hover:border-[#16181D]/35"
        >
          카카오톡 상담
        </a>
      </div>

      {/* 크롤러가 이 화면에 갇히지 않도록 주요 경로를 남긴다. */}
      <nav className="mt-10 border-t border-[#16181D]/10 pt-6">
        <p className="mb-3 font-mono-pd text-[11px] font-bold uppercase tracking-[0.14em] text-[#7B818C]">바로가기</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-bold text-[#16181D]">
          {[
            ["/", "홈"],
            ["/services", "지역·품목별 서비스"],
            ["/gallery", "시공 사례"],
            ["/reviews", "고객 후기"],
            ["/faq", "자주 묻는 질문"],
            ["/blog", "정보"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="underline decoration-[#FFD400] decoration-2 underline-offset-4">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
