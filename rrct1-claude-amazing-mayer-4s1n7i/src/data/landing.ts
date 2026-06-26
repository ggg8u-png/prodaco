// 전환(CRO) 관련 콘텐츠 — 견적 기준, 상담 전 준비, CTA 카피, 시공사례 placeholder.
// 실제 수치/가격은 넣지 않는다. 현장마다 다르므로 "기준"만 안내한다.
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
  // 신뢰 보강 카피 — 보장 표현 아님(무료 상담/견적, 실측 기준 정산은 실제 운영 방식)
  trust: landingContent.ctaCopy.trust,
};

// 최근 작업 사례 — 실제 사진/데이터는 gallery.ts 사용. 이 배열은 텍스트 사례 placeholder.
// TODO(운영): 실제 작업 지역/내용으로 교체하거나 gallery 데이터와 연동.
export interface CaseStudy {
  id: string;
  region: string;
  material: string;
  scope: string;
  result: string;
}

export const caseStudies: CaseStudy[] = landingContent.caseStudies;
