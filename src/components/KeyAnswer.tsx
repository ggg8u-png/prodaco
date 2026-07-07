import { company } from "@/data/company";
import { KakaoIcon } from "@/components/icons";
import type { KeyAnswer as KeyAnswerData } from "@/data/keyAnswer";

// GEO/AEO "빠른 답변" 블록 — 랜딩 H1 아래에 [질문 + 40~80자 핵심 답변 + 2~3문장 보충 + CTA].
// 생성형 검색/발췌가 그대로 인용하기 좋은 형태(결론 먼저). 순수 표시용 서버 컴포넌트로,
// JSON-LD는 만들지 않는다(FAQPage 스키마와 분리 관리). answer 텍스트만 페이지 쪽에서
// 기존 FAQPage mainEntity 맨 앞에 병합돼, 화면 표시와 구조화데이터가 일치한다.
export default function KeyAnswer({ question, answer, supplement }: KeyAnswerData) {
  return (
    <section aria-label="빠른 답변" className="border-b border-gray-100 bg-white px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="border-l-[3px] border-[#FFD400] pl-4">
          <p className="mb-2.5 font-mono-pd text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A8A2E]">
            빠른 답변
          </p>
          <p className="mb-2 flex items-start gap-2 text-[15px] font-black leading-snug text-[#16181D] sm:text-base">
            <span aria-hidden className="font-mono-pd text-[#9A8A2E]">Q.</span>
            <span>{question}</span>
          </p>
          {/* 핵심 답변 — 결론 먼저(강조) */}
          <p className="flex items-start gap-2 text-[14.5px] font-semibold leading-[1.7] text-[#16181D]">
            <span aria-hidden className="font-mono-pd font-bold text-[#9A8A2E]">A.</span>
            <span>{answer}</span>
          </p>
          {/* 보충 설명 — 2~3문장 */}
          {supplement && (
            <p className="mt-2.5 pl-[22px] text-[13px] leading-[1.75] text-gray-500">{supplement}</p>
          )}
          {/* CTA — 사진 상담으로 자연스럽게 연결 */}
          <div className="mt-4 pl-[22px]">
            <a
              href={company.kakaoUrl}
              target="_blank"
              rel="noopener"
              aria-label="카카오톡으로 사진 보내고 빠른 견적 받기"
              className="inline-flex items-center gap-2 rounded-sm bg-[#FFD400] px-4 py-2.5 text-[13px] font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D]"
            >
              <KakaoIcon className="h-[15px] w-[15px]" />
              사진 보내고 빠른 견적 받기
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
