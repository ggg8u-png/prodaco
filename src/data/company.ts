import settings from "../../content/settings.json";
import companyContent from "../../content/company.json";

// 연락처·요약·문구 등은 CMS(/admin)가 편집하는 content/settings.json 에서 가져온다.
// (환경변수가 있으면 환경변수 > settings 순으로 우선. 둘 다 없으면 기본값.)
const phone = settings.phone || "010-8470-4965";
const phoneDigits = phone.replace(/[^0-9]/g, "");

export const company = {
  name: companyContent.name,
  nameEn: companyContent.nameEn,
  // 웹사이트 노출 전화 = 인입 추적용 전용 번호. content/settings.json 에서 수정.
  phone,
  phoneLink: `tel:${phoneDigits}`,
  // 카톡이 익숙치 않은 현장 고객용 — 문자(SMS)로 사진·내용 전송
  smsLink: `sms:${phoneDigits}`,
  // 실제 업체 회선 (참고용 — 사이트 CTA에는 노출하지 않음)
  repPhone: "1661-4290",
  mobile: "010-6247-9099",
  kakaoUrl: process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || settings.kakaoUrl || "https://open.kakao.com/o/sUneW8Xg",
  // 네이버 플레이스 URL — 있으면 관련 CTA 노출. 없으면 미노출.
  naverPlaceUrl: process.env.NEXT_PUBLIC_NAVER_PLACE_URL || settings.naverPlaceUrl || "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr",
  // 응대 안내 문구 (보장 표현 금지 — 안내 톤만)
  responseTimeText: process.env.NEXT_PUBLIC_RESPONSE_TIME_TEXT || settings.responseTimeText || "영업시간 내 빠르게 답변드립니다",
  region: companyContent.region,
  speciality: companyContent.speciality,
  experience: settings.experience || "10년",
  // 히어로 보조 문구 (CMS 편집)
  heroSubcopy: settings.heroSubcopy || "뜯는 건 누구나 합니다. 본드·잔여물까지 정밀 샌딩해 다음 공정이 바로 가는 상태로 마무리하는 것 — 10년, 수도권 현장만 해온 저희의 기준입니다.",
  // GEO(생성형 검색)용 요약 — 검색엔진이 그대로 인용하기 좋은 명확한 문장 (CMS 편집)
  geoSummary:
    settings.geoSummary ||
    "저희는 서울·경기·인천 수도권에서 바닥재 철거와 상가·사무실 원상복구 작업을 상담·진행하는 업체입니다. 주요 작업은 마루 철거, 데코타일 철거, 장판 철거, 타일 철거, 바닥 본드(접착제) 제거, 원상복구 전 바닥 정리, 그리고 철거 후 바닥 샌딩(면갈이)입니다. 바닥재 종류와 현장 환경이 다양해 보통 유선 상담으로 가견적을 안내하고, 작업 완료 후 실제 시공 면적을 측정해 최종 정산합니다.",
  strengths: companyContent.strengths,
  services: companyContent.services,
  process: companyContent.process,
  // 프로다의 핵심 무기 — '샌딩이 다릅니다' 섹션 카피
  differentiator: companyContent.differentiator,
  // 상담 순서 안내 (운영자 실제 프로세스 기반)
  consultSteps: companyContent.consultSteps,
};
