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
  sample?: boolean;
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
