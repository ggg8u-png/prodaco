import type { Review } from "@/types";
import data from "../../content/reviews.json";

// 후기 데이터는 CMS(/admin)가 편집하는 content/reviews.json 에서 불러온다.
//  · sample=true            : '예시(상담 사례)' 후기 — UI에 반드시 '상담 사례' 라벨 노출, 별점 없음.
//  · verified=true          : 운영자가 실제 접수·작업으로 검증한 후기.
//  · sourceType             : "actual" | "consultation_case" | "example" (types/index.ts 참고)
const items = ((data as unknown as { items: Review[] }).items) || [];

// 예시(상담 사례) 판별 — sample 플래그 또는 sourceType 이 실제(actual)가 아니면 예시로 간주.
// 하위호환: 기존 데이터가 sample 만 갖고 있어도 그대로 동작한다.
export function isExampleReview(r: Review): boolean {
  if (r.sample) return true;
  if (r.sourceType && r.sourceType !== "actual") return true;
  return false;
}

// 검증된 실제 후기 판별 — Review/AggregateRating 구조화데이터에 넣어도 되는 유일한 대상.
// verified 필드가 없던 기존 데이터는 '예시가 아니면 실제'로 간주(하위호환).
export function isVerifiedActualReview(r: Review): boolean {
  if (isExampleReview(r)) return false;
  return r.verified !== false; // 명시적으로 false 가 아니면 실제 후기로 취급
}

export const reviews: Review[] = items.filter((r) => !isExampleReview(r)); // 실제 후기
export const sampleReviews: Review[] = items.filter((r) => isExampleReview(r)); // 예시(상담 사례)

// 구조화데이터(Review/AggregateRating) 전용 — 검증된 실제 후기만.
// 예시성 콘텐츠는 이 배열에 절대 포함되지 않는다(허위 리뷰/별점 방지).
export const verifiedReviews: Review[] = items.filter(isVerifiedActualReview);

// 홈/후기 페이지 노출용 — 실제 후기 우선, 그 뒤로 예시(상담 사례).
export const allReviews: Review[] = [...reviews, ...sampleReviews];
