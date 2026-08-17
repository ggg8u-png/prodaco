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
  // 검색 노출 허용 — 이 후기의 개별 페이지(/reviews/<id>)를 색인 대상으로 삼을지.
  // 기본(미지정)은 false 로 취급한다. 짧거나 중복되는 후기까지 검색용 페이지가
  // 무한히 생기는 걸 막기 위해, 색인은 운영자가 건별로 켜는 구조다(src/lib/reviewDoc.ts).
  searchIndexable?: boolean;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  /** 적용 품목군(itemFacts 의 family key) 또는 "all". 누락 시 "all" 로 간주(범용 FAQ). */
  services?: string[];
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
  /** 실제 작업 지역(actualRegion) — 이 값이 페이지 지역과 일치할 때만 '해당 지역 실제 사례'로 표시 가능. */
  region: string;
  item: string;
  beforeImage: string;
  afterImage: string;
  description: string;
  /** 운영자 검증 여부 — false 면 자동 색인 승급(hasRealCase) 대상에서 제외. 미지정은 검증으로 간주(하위호환). */
  verified?: boolean;
  /** 작업일(YYYY-MM-DD) — 선택. */
  workDate?: string;
  /** 건물 유형(아파트·상가·사무실 등) — 선택. */
  buildingType?: string;
  /** 작업 면적(평/㎡ 표기 자유) — 선택. */
  area?: string;
  /** 작업 범위·내용(예: "강마루 철거 + 본드 제거 + 샌딩") — 선택. */
  workScope?: string;
  /** 비용 또는 비용 범위(운영자가 적은 그대로 표기) — 선택. 없으면 표시하지 않는다. */
  cost?: string;
}

export interface GalleryPhoto {
  id: string;
  src: string;
  alt: string;
}
