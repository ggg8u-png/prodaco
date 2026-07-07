// 전환(CRO) 콘텐츠 — 견적 기준·상담 준비·CTA 카피.
// 허위 단가를 넣지 않고, 금액이 달라지는 "기준"만 안내한다.
import settings from "../../content/settings.json";
import landingContent from "../../content/landing.json";

export interface QuoteFactor {
  id: string;
  label: string;
  detail: string;
}

// "견적이 달라지는 기준" — 허위 단가 대신, 무엇으로 금액이 달라지는지만 설명
export const quoteFactors: QuoteFactor[] = landingContent.quoteFactors;

// 상담 전 준비하면 좋은 정보
export const consultPrep: { id: string; label: string; hint: string }[] = landingContent.consultPrep;

// 견적 체크리스트 UI 선택지
export const materialOptions = landingContent.materialOptions;

export const regionOptions = landingContent.regionOptions;

// CTA 카피 — 구체적 행동 중심 (주요 버튼 문구는 content/settings.json 에서 CMS 편집)
export const ctaConfig = {
  phonePrimary: settings.ctaPhoneLabel || "전화로 바로 상담",
  phoneShort: landingContent.ctaCopy.phoneShort,
  kakaoPrimary: settings.ctaKakaoLabel || "사진 보내고 빠른 견적 받기",
  kakaoShort: landingContent.ctaCopy.kakaoShort,
  smsPrimary: landingContent.ctaCopy.smsPrimary,
  kakaoMicro: landingContent.ctaCopy.kakaoMicro,
  quoteCta: landingContent.ctaCopy.quoteCta,
  midroll: landingContent.ctaCopy.midroll,
  // 신뢰 카피 — 보장 표현이 아니라 실제 운영 방식(무료 상담·견적, 실측 정산)
  trust: landingContent.ctaCopy.trust,
};
