import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCTA from "@/components/FloatingCTA";
import { company } from "@/data/company";
import settings from "../../content/settings.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";
const isProduction = siteUrl === "https://prodaco.kr";

const seoTitle = settings.seoTitle || "바닥재 철거·마루 철거 견적 상담 | 프로다";
const seoDescription = settings.seoDescription || "마루·데코타일·장판 철거, 상가·사무실 원상복구 바닥 철거 상담. 현장 사진과 면적을 보내면 작업 범위와 견적 기준을 안내합니다. 서울·경기·인천 수도권. ☎ 010-8470-4965";
const seoKeywords = (settings.seoKeywords || "바닥재철거,마루철거,데코타일철거,장판철거,타일철거,바닥샌딩,면갈이,상가원상복구,사무실원상복구,수도권바닥철거,서울,경기,인천").split(",").map((k: string) => k.trim());
const naverVerify = process.env.NEXT_PUBLIC_NAVER_VERIFY || settings.naverVerify || "464f17eada9bd24d089330e0143cb118086cec15";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: seoTitle,
    template: "%s | 프로다",
  },
  description: seoDescription,
  keywords: seoKeywords,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "프로다",
    title: seoTitle,
    description: seoDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: seoTitle,
    description: seoDescription,
  },
  alternates: {
    canonical: siteUrl,
    types: {
      "application/rss+xml": `${siteUrl}/rss.xml`,
    },
  },
  robots: isProduction
    ? { index: true, follow: true, googleBot: { index: true, follow: true } }
    : { index: false, follow: false },
  verification: {
    other: {
      "naver-site-verification": naverVerify,
    },
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  "@id": `${siteUrl}/#business`,
  name: company.name,
  alternateName: company.nameEn,
  url: siteUrl,
  telephone: company.phone,
  description: "10년 바닥재 철거·바닥 샌딩 전문. 마루·데코타일·장판·타일·우레탄·에폭시 철거, 상가·사무실 원상복구 바닥 철거, 실측 면적 정산. 서울·경기·인천 수도권 전 지역.",
  priceRange: "$$",
  areaServed: [
    { "@type": "City", name: "서울" },
    { "@type": "AdministrativeArea", name: "경기도" },
    { "@type": "City", name: "인천" },
  ],
  serviceType: ["바닥재 철거", "바닥 샌딩", "원상복구 철거", "인테리어 철거"],
  knowsAbout: [
    "마루 철거", "데코타일 철거", "장판 철거", "타일 철거",
    "우레탄 철거", "에폭시 철거", "바닥 샌딩", "면갈이", "원상복구",
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "바닥재 철거 서비스",
    itemListElement: company.services.map((s, i) => ({
      "@type": "Offer",
      position: i + 1,
      itemOffered: {
        "@type": "Service",
        name: s.name,
        description: s.description,
      },
    })),
  },
  // NOTE: AggregateRating은 자사 페이지 내 리뷰(self-serving)라 구글 정책상 리치결과 대상이
  //       아니며 수동 조치 위험이 있어 제외함. 네이버 플레이스 등 외부 검증 리뷰 확보 시 재검토.
  // TODO(운영): 실제 영업시간 확인 후 조정 (현재 값은 일반적 작업 시간대 가정).
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "08:00",
    closes: "20:00",
  },
  // TODO(운영): 실제 사업장 주소(PostalAddress) 확보 시 address 필드 추가 → 네이버/구글 지역 노출 강화.
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: company.name,
  alternateName: company.nameEn,
  url: siteUrl,
  description: "수도권 바닥재 철거·바닥 샌딩·상가 원상복구 전문",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: company.phone,
    contactType: "customer service",
    areaServed: "KR",
    availableLanguage: ["Korean"],
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "시공사례", item: `${siteUrl}/gallery` },
    { "@type": "ListItem", position: 3, name: "후기", item: `${siteUrl}/reviews` },
    { "@type": "ListItem", position: 4, name: "자주 묻는 질문", item: `${siteUrl}/faq` },
    { "@type": "ListItem", position: 5, name: "정보", item: `${siteUrl}/blog` },
  ],
};

const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  url: siteUrl,
  name: "프로다",
  description: "수도권 바닥재 철거 전문",
  inLanguage: "ko",
  publisher: { "@id": `${siteUrl}/#business` },
};

// NOTE: HowTo 스키마는 콘텐츠(프로세스)가 실제로 있는 홈(/)에서만 출력한다.
//       (후기·FAQ 등 무관한 페이지에 전역 삽입 시 콘텐츠 불일치로 무효·스팸 위험)

const gaId = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      </head>
      <body className="bg-[#F7F6F3] text-[#16181D]">
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
            </Script>
          </>
        )}
        <Header />
        <main>{children}</main>
        <Footer />
        <FloatingCTA />
        {/* Netlify Identity: 초대/복구 토큰을 /admin/ 으로 리다이렉트 */}
        <Script src="https://identity.netlify.com/v1/netlify-identity-widget.js" strategy="afterInteractive" />
        <Script id="netlify-identity-redirect" strategy="afterInteractive">{`
          if(window.netlifyIdentity){window.netlifyIdentity.on("init",function(u){if(!u){window.netlifyIdentity.on("login",function(){document.location.href="/admin/";});}});}
        `}</Script>
      </body>
    </html>
  );
}
