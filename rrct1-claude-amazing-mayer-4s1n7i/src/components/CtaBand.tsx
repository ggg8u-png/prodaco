import { company } from "@/data/company";
import { ctaConfig } from "@/data/landing";
import { PhoneIcon, KakaoIcon, MessageIcon } from "@/components/icons";

// 본문 중간에 반복 배치하는 미드롤 CTA 밴드. 카톡 + 전화 + 문자 구성 + 신뢰 카피.
export default function CtaBand({ heading = ctaConfig.midroll }: { heading?: string }) {
  return (
    <section className="bg-[#16181D] px-4 py-12 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-5 text-center">
        <h2 className="text-xl font-black tracking-[-0.02em] sm:text-2xl">{heading}</h2>
        <p className="-mt-2 text-sm text-[#A8AEB8]">{ctaConfig.kakaoMicro}</p>
        <div className="flex w-full max-w-xl flex-col gap-2.5 sm:flex-row">
          <a
            href={company.kakaoUrl}
            target="_blank"
            rel="noopener"
            aria-label="카카오톡으로 사진 보내고 빠른 견적 받기"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm bg-[#FFD400] px-5 py-3.5 text-[15px] font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D]"
          >
            <KakaoIcon className="h-[17px] w-[17px]" />
            {ctaConfig.kakaoPrimary}
          </a>
          <a
            href={company.phoneLink}
            aria-label={`전화로 바로 상담 ${company.phone}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm border-2 border-white/30 px-5 py-3.5 text-[15px] font-extrabold text-white transition-colors hover:border-[#FFD400] hover:text-[#FFD400]"
          >
            <PhoneIcon className="h-[17px] w-[17px]" />
            {ctaConfig.phonePrimary}
          </a>
          <a
            href={company.smsLink}
            aria-label="문자로 사진 보내기"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm border-2 border-white/30 px-5 py-3.5 text-[15px] font-extrabold text-white transition-colors hover:border-[#FFD400] hover:text-[#FFD400]"
          >
            <MessageIcon className="h-[17px] w-[17px]" />
            {ctaConfig.smsPrimary}
          </a>
        </div>
        <p className="font-mono-pd text-[12px] font-bold uppercase tracking-[0.08em] text-[#FFD400]">{ctaConfig.trust}</p>
        {company.naverPlaceUrl && (
          <a
            href={company.naverPlaceUrl}
            target="_blank"
            rel="noopener"
            className="text-[13px] font-semibold text-[#A8AEB8] underline-offset-4 hover:text-white hover:underline"
          >
            네이버 플레이스에서 확인하기 →
          </a>
        )}
      </div>
    </section>
  );
}
