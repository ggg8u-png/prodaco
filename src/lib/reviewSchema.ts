import seo from "../../content/seo.json";
import { company } from "@/data/company";
import { verifiedReviews } from "@/data/reviews";

// =============================================================================
// 후기 구조화데이터(Review + AggregateRating) — '검증된 실제 후기'만, 조건부 출력.
//
// 정책(중요): 자사 페이지에 직접 붙인 1st-party 리뷰/별점 마크업은 구글 리치결과
//   대상이 아니며(self-serving) 수동 조치 위험이 있다. 그래서 기본값은 비활성이다.
//   또한 검증 후기 수가 임계값 미만이면 AggregateRating 자체를 만들지 않는다(만점 몇 건의
//   self-serving 평점은 오히려 리스크). 외부 검증 리뷰(네이버 플레이스/구글) 확보 후,
//   content/seo.json 의 reviewSchema.enabled 를 켜는 것이 안전한 순서다.
//
// 구조적 안전장치: 이 모듈은 오직 verifiedReviews(=검증된 실제 후기)만 읽는다.
//   예시(상담 사례/example)는 애초에 이 배열에 들어올 수 없어, 구조적으로 스키마에
//   포함이 불가능하다(허위 리뷰/별점 스키마 원천 차단).
// =============================================================================

const cfg = ((seo as { reviewSchema?: { enabled?: boolean; minVerified?: number } }).reviewSchema) || {};
const ENABLED = cfg.enabled === true; // 기본 false
const MIN_VERIFIED = typeof cfg.minVerified === "number" && cfg.minVerified > 0 ? cfg.minVerified : 8;

// YYYY / YYYY-MM / YYYY-MM-DD 형태의 부분 날짜만 통과(임의 날짜 생성 없음, 값 있을 때만).
function isoDateOrUndefined(d: string | undefined): string | undefined {
  return d && /^\d{4}(-\d{2}){0,2}$/.test(d) ? d : undefined;
}

// 검증된 실제 후기만으로 LocalBusiness(#business) 노드에 review/aggregateRating 을 덧붙인다.
// 반환 null = 스키마 미출력(비활성 또는 검증 후기 부족). null 이면 페이지는 아무 것도 렌더하지 않는다.
export function buildReviewJsonLd(siteUrl: string): object | null {
  if (!ENABLED) return null; // 정책상 기본 비활성 (self-serving 리치결과 리스크)

  const list = verifiedReviews; // 예시(상담 사례)는 구조적으로 포함 불가
  const ratings = list.map((r) => r.rating).filter((n) => typeof n === "number" && n >= 1 && n <= 5);
  if (ratings.length < MIN_VERIFIED) return null; // 검증 후기 부족 → AggregateRating 비활성

  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const reviewNodes = list.map((r) => ({
    "@type": "Review",
    reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    author: { "@type": "Person", name: r.name },
    reviewBody: r.content,
    ...(isoDateOrUndefined(r.date) ? { datePublished: isoDateOrUndefined(r.date) } : {}),
  }));

  // 기존 LocalBusiness 엔티티(@id=#business)에 병합되도록 같은 @id 로 부분 노드를 낸다.
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#business`,
    name: company.brandName,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Math.round(avg * 10) / 10,
      reviewCount: list.length,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviewNodes,
  };
}

// 진단용 — 현재 스키마가 왜 켜졌/꺼졌는지(빌드 로그·테스트 확인용).
export function reviewSchemaStatus() {
  return { enabled: ENABLED, minVerified: MIN_VERIFIED, verifiedCount: verifiedReviews.length };
}
