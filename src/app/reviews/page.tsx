import type { Metadata } from "next";
import ReviewsClient from "./ReviewsClient";
import { buildReviewJsonLd } from "@/lib/reviewSchema";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";
const desc =
  "바닥재 철거·바닥 샌딩 고객 후기. 반셀프 인테리어, 인테리어·시공업체, 상가·사무실 원상복구 등 다양한 현장의 상담·작업 후기를 확인하세요.";

export const metadata: Metadata = {
  title: "고객 후기",
  description: desc,
  alternates: { canonical: `${siteUrl}/reviews` },
  openGraph: {
    title: "고객 후기 | 프로다",
    description: desc,
    type: "website",
    url: `${siteUrl}/reviews`,
    images: ["/opengraph-image"],
  },
};

// 이 페이지 계층(홈 > 고객 후기) — 전역 브레드크럼 제거 후 페이지별로만 출력.
const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "고객 후기", item: `${siteUrl}/reviews` },
  ],
};

export default function ReviewsPage() {
  // 후기 구조화데이터 — 검증된 실제 후기만, config(seo.json reviewSchema)로 게이트.
  // 기본 비활성(self-serving 리치결과 정책 리스크)이라 보통 null → 아무 스키마도 렌더하지 않는다.
  // 예시(상담 사례)는 verifiedReviews 에 구조적으로 포함될 수 없어 절대 스키마에 들어가지 않는다.
  const reviewJsonLd = buildReviewJsonLd(siteUrl);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {reviewJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJsonLd) }} />
      )}
      <ReviewsClient />
    </>
  );
}
