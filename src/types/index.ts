export interface Keyword {
  slug: string;
  keyword: string;
  type: "region" | "item" | "modifier" | "general";
  region?: string;
  item?: string;
  modifier?: string;
}

export interface Review {
  id: string;
  name: string;
  region: string;
  item: string;
  content: string;
  rating: number;
  type: "consumer" | "business";
  date: string;
  // true면 실제 후기가 아닌 '예시(준비중)' 후기 — UI에 반드시 '예시' 라벨 노출.
  // (하위호환 유지: 기존 데이터/코드가 계속 sample 로 실제/예시를 구분)
  sample?: boolean;
  // ── E-E-A-T / 리뷰 스키마 안전장치 ─────────────────────────────────────────
  // verified: 운영자가 실제 접수·작업으로 검증한 후기만 true. Review/AggregateRating
  //   구조화데이터는 verified===true 인 항목만 사용한다(예시성 콘텐츠는 절대 포함 금지).
  verified?: boolean;
  // sourceType: 콘텐츠의 성격.
  //   "actual"            = 실제 고객 후기(검증됨) → 별점 UI + 향후 Review 스키마 대상
  //   "consultation_case" = 상담/접수 사례 기반 예시 → '상황 예시' 카드, 별점 없음, 스키마 제외
  //   "example"           = 순수 예시(준비중) → '상황 예시' 카드, 별점 없음, 스키마 제외
  sourceType?: "actual" | "consultation_case" | "example";
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  // 최종 수정일(선택) — 있으면 sitemap lastmod 로 사용(없으면 date 로 폴백).
  updatedAt?: string;
  category: string;
  tags: string[];
}

export interface GalleryItem {
  id: string;
  title: string;
  region: string;
  item: string;
  beforeImage: string;
  afterImage: string;
  description: string;
}

export interface GalleryPhoto {
  id: string;
  src: string;
  alt: string;
}
