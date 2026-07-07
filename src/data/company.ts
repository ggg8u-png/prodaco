import settings from "../../content/settings.json";
import companyContent from "../../content/company.json";

// 연락처·요약·문구 등은 CMS(/admin)가 편집하는 content/settings.json 에서 가져온다.
// (환경변수가 있으면 환경변수 > settings 순으로 우선. 둘 다 없으면 기본값.)
const phone = settings.phone || "010-8470-4965";
const phoneDigits = phone.replace(/[^0-9]/g, "");

// ── 사업자(NAP) 신뢰신호 — businessConfig 중앙화 ──────────────────────────────
// content/settings.json 의 business 블록이 단일 출처(Single Source of Truth)다.
// 상호·대표자·사업자등록번호·주소·서비스지역·외부 프로필(sameAs)을 한곳에서 관리하고,
// 푸터와 LocalBusiness/Organization JSON-LD가 모두 이 config 를 사용한다.
//
// 원칙: 미확인 정보는 빈 문자열(TODO)로 두고 '값이 있을 때만' 화면/구조화데이터에 노출.
//   허위 주소·가짜 사업자·있지도 않은 지역 사무실·임의 지도 프로필 표기 금지.
const businessRaw = ((settings as { business?: Record<string, unknown> }).business) || {};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(/[·,]/).map((s) => s.trim()).filter(Boolean);
  return [];
}
const sameAsRaw = (businessRaw.sameAs && typeof businessRaw.sameAs === "object" && !Array.isArray(businessRaw.sameAs)
  ? (businessRaw.sameAs as Record<string, unknown>)
  : {});

// 연락 채널(오픈채팅) — 시민(citation)용 sameAs 와 구분되는 '문의 채널'.
const kakaoOpenChatUrl =
  process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || settings.kakaoUrl || "https://open.kakao.com/o/sUneW8Xg";

// 외부 프로필/인용(sameAs) — 이름 있는 슬롯. 값이 있을 때만 sameAs 배열에 들어간다.
//  · naverPlace / googleBusinessProfile 는 환경변수 > business.sameAs > (legacy)settings 순.
//  · kakaoMap 은 오픈채팅(kakaoOpenChatUrl)과 다른 '지도 프로필' — 별도 슬롯.
const sameAs = {
  facebook: str(sameAsRaw.facebook),
  twitter: str(sameAsRaw.twitter),
  naverPlace: process.env.NEXT_PUBLIC_NAVER_PLACE_URL || str(sameAsRaw.naverPlace) || settings.naverPlaceUrl || "",
  kakaoMap: str(sameAsRaw.kakaoMap),
  googleBusinessProfile: process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL || str(sameAsRaw.googleBusinessProfile) || "",
};
// JSON-LD sameAs 용 — 값 있는 프로필 URL만(오픈채팅은 citation 아니므로 제외).
const sameAsList: string[] = [
  sameAs.facebook,
  sameAs.twitter,
  sameAs.naverPlace,
  sameAs.kakaoMap,
  sameAs.googleBusinessProfile,
].filter((u) => u.length > 0);

const brandName = str(businessRaw.brandName) || "프로다";
const serviceArea = toStringArray(businessRaw.serviceArea).length
  ? toStringArray(businessRaw.serviceArea)
  : ["서울", "경기", "인천", "수도권"];

const business = {
  // 브랜드명(고객이 부르는 이름) — 로고·타이틀·구조화데이터 name 에 사용.
  brandName,
  // 법적 상호(사업자등록증 기준). 브랜드명과 다를 수 있음. TODO: 운영자 확인 후 입력.
  legalName: str(businessRaw.legalName),
  // 대표자명. TODO: 운영자 확인 후 입력.
  representativeName: str(businessRaw.representativeName),
  // 사업자등록번호(예: 123-45-67890). TODO: 운영자 확인 후 입력.
  registrationNumber: str(businessRaw.businessRegistrationNumber),
  // 사업장 주소. TODO: 확인된 실제 주소만 입력(가짜 지역 사무실 표기 금지).
  address: str(businessRaw.address),
  // 서비스 지역 — 배열(구조화데이터 areaServed) + 표기용 텍스트(푸터).
  serviceArea,
  serviceAreaText: serviceArea.join("·"),
  // 연락 채널(오픈채팅).
  kakaoOpenChatUrl,
  // 외부 프로필/인용 슬롯(이름 있음) — 값 있는 것만 노출.
  sameAs,
};

export const company = {
  name: companyContent.name,
  nameEn: companyContent.nameEn,
  // 브랜드명(고객이 부르는 이름) — 로고·구조화데이터 name 에 사용. businessConfig 단일 출처.
  brandName,
  // 웹사이트 노출 전화 = 인입 추적용 전용 번호. content/settings.json 에서 수정.
  phone,
  phoneLink: `tel:${phoneDigits}`,
  // 카톡이 익숙치 않은 현장 고객용 — 문자(SMS)로 사진·내용 전송
  smsLink: `sms:${phoneDigits}`,
  // 실제 업체 회선 (참고용 — 사이트 CTA에는 노출하지 않음)
  repPhone: "1661-4290",
  mobile: "010-6247-9099",
  // 카카오톡 오픈채팅(문의 채널) — sameAs(citation)와 구분.
  kakaoUrl: kakaoOpenChatUrl,
  // 네이버 플레이스/구글 비즈니스 URL — 있으면 관련 CTA 노출. 없으면 미노출.(sameAs 슬롯에서 파생)
  naverPlaceUrl: sameAs.naverPlace,
  googleBusinessUrl: sameAs.googleBusinessProfile,
  // 사업자(NAP) 신뢰신호 config — 값이 있는 필드만 화면/구조화데이터에 노출.
  business,
  // 엔티티 그래프 sameAs — 값 있는 외부 프로필 URL만(JSON-LD 용 플랫 배열).
  sameAs: sameAsList,
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
