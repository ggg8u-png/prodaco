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
  /** CMS 공개 상태. 기존 데이터에서 미지정이면 published로 취급한다. */
  status?: "draft" | "published";
  /** 명시적 게시일. 기존 date 필드와 하위 호환된다. */
  publishedAt?: string;
  /** 실제 검색 도구 근거가 있을 때만 confirmed. IndexNow 제출 성공은 confirmed가 아니다. */
  indexStatus?: "unknown" | "confirmed";
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  // 최종 수정일(선택) — 있으면 sitemap lastmod 로 사용(없으면 date 로 폴백).
  updatedAt?: string;
  category: string;
  tags: string[];
  // ── 대표 썸네일(선택) ───────────────────────────────────────────────────────
  // 운영자가 검색결과·SNS 공유·목록 카드에 쓸 사진을 직접 고른 값.
  // 비어 있으면 src/lib/featuredImage.ts 의 폴백 순서(본문 첫 사진 → 기본 사진)를 따른다.
  /** 대표 썸네일 경로(/uploads/... 또는 절대 URL). */
  featuredImage?: string;
  /** 대표 썸네일 대체텍스트. 비면 제목 기반 문구를 쓴다. */
  featuredImageAlt?: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  /** CMS 공개 상태. 기존 데이터의 미지정 값은 published로 취급한다. */
  status?: "draft" | "published";
  /** 사이트 게시일(YYYY-MM-DD). 목록 정렬에 사용하며 실제 작업일과 구분한다. */
  publishedAt?: string;
  /** 실제 검색 도구 근거가 있을 때만 confirmed. IndexNow 제출 성공은 confirmed가 아니다. */
  indexStatus?: "unknown" | "confirmed";
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
  // ── 영상(전부 선택) ─────────────────────────────────────────────────────────
  // 값이 없으면 UI 도, VideoObject 구조화데이터도 출력하지 않는다.
  /** 영상 주소(YouTube·Vimeo·직접 mp4 URL). */
  videoUrl?: string;
  /** 플랫폼 — 미지정 시 videoUrl 에서 추정한다. */
  videoPlatform?: "youtube" | "vimeo" | "file";
  /** 썸네일 이미지 주소(선택). 없으면 afterImage 를 쓴다. */
  videoThumbnail?: string;
  /** 영상 제목(선택). 없으면 사례 제목을 쓴다. */
  videoTitle?: string;
  // ── 대표 썸네일 / 추가 사진 / 고정 (전부 선택) ──────────────────────────────
  /** 목록 맨 위 고정 — 운영자가 켠 사례만 최신순보다 앞에 온다. */
  featured?: boolean;
  /**
   * 대표 썸네일로 쓸 사진 선택.
   *   "after"(기본) · "before" · "custom"(featuredImage 에 직접 올린 사진)
   * 미지정은 "after" 로 취급한다(기존 사례 하위호환 — 지금까지 og:image 가 afterImage 였다).
   */
  thumbnailChoice?: "after" | "before" | "custom";
  /** 직접 올린 대표 썸네일. 값이 있으면 thumbnailChoice 와 무관하게 이 사진이 우선한다. */
  featuredImage?: string;
  /** 대표 썸네일 대체텍스트(선택). */
  featuredImageAlt?: string;
  /**
   * 같은 현장에서 찍은 추가 사진(선택).
   * 전/후 쌍과 구분해서 보여준다 — 임의의 두 장을 '작업 전/작업 후'로 묶지 않기 위해서다.
   */
  photos?: CasePhoto[];
}

/** 시공사례 상세에 붙는 추가 사진 한 장. */
export interface CasePhoto {
  src: string;
  alt?: string;
  caption?: string;
}

export interface GalleryPhoto {
  id: string;
  src: string;
  alt: string;
}
