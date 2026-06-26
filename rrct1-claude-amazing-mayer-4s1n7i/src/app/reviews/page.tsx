import type { Metadata } from "next";
import ReviewsClient from "./ReviewsClient";

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

export default function ReviewsPage() {
  return <ReviewsClient />;
}
