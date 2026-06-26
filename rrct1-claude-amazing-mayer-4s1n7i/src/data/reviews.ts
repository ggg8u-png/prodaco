import type { Review } from "@/types";
import data from "../../content/reviews.json";

// 후기 데이터는 CMS(/admin)가 편집하는 content/reviews.json 에서 불러온다.
// 항목의 sample=true 는 '예시(준비중)' 후기 — UI에 반드시 '예시' 라벨이 노출된다.
const items = ((data as unknown as { items: Review[] }).items) || [];

export const reviews: Review[] = items.filter((r) => !r.sample); // 실제 후기
export const sampleReviews: Review[] = items.filter((r) => !!r.sample); // 예시(준비중) 후기

// 홈/후기 페이지 노출용 — 실제 후기 우선, 그 뒤로 예시 후기.
export const allReviews: Review[] = [...reviews, ...sampleReviews];
