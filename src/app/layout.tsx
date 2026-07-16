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

// 엔티티 그래프 연결(sameAs) — 네이버 플레이스·구글 비즈니스 프로필·카카오 채널 URL을
// CMS(settings.json)/환경변수에 넣으면 자동으로 구조화 데이터에 반영된다(값이 있을 때만).
// 로컬 업체의 E-E-A-T·엔티티 인식에 영향이 크므로, URL 확보 즉시 채우면 된다.
// (company.ts 에서 네이버·구글·카카오 + business.sameAs 를 모아 값 있는 URL만 노출)
const businessSameAs: string[] = company.sameAs;

// 사업자(NAP) 신뢰신호 — businessConfig(company.business)에 값이 있을 때만 JSON-LD에 주입.
// 미확인 정보(상호·주소·사업자등록번호·대표자)는 넣지 않는다(허위 표기 방지). 값 확보 즉시 자동 반영.
const b = company.business;
const napJsonLd: Record<string, unknown> = {
  ...(b.legalName ? { legalName: b.legalName } : {}),
  ...(b.address ? { address: { "@type": "PostalAddress", streetAddress: b.address, addressCountry: "KR" } } : {}),
  ...(b.registrationNumber ? { taxID: b.registrationNumber } : {}),
  ...(b.representativeName ? { founder: { "@type": "Person", name: b.representativeName } } : {}),
};

// 서비스 지역(areaServed) — businessConfig.serviceArea 배열에서 파생(광역시/도는 AdministrativeArea).
const ADMIN_AREAS = new Set(["경기", "수도권", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]);
const areaServedJsonLd = b.serviceArea.map((a) => ({
  "@type": ADMIN_AREAS.has(a) ? "AdministrativeArea" : "City",
  name: a === "경기" ? "경기도" : a,
}));

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  "@id": `${siteUrl}/#business`,
  name: company.brandName,
  alternateName: company.nameEn,
  url: siteUrl,
  // 로고는 '정사각'(/logo.png) — 네이버/구글이 로고를 정사각으로 크롭해도 '프로다'가 안 잘린다.
  // 대표 이미지는 가로형 OG(중앙정렬)로 별도 제공.
  logo: `${siteUrl}/logo.png`,
  image: `${siteUrl}/opengraph-image`,
  telephone: company.phone,
  // 사업자 NAP(상호·주소·사업자등록번호·대표자) — 값이 있을 때만 포함.
  ...napJsonLd,
  ...(businessSameAs.length ? { sameAs: businessSameAs } : {}),
  description: "10년 바닥재 철거·바닥 샌딩 전문. 마루·데코타일·장판·타일·우레탄·에폭시 철거, 상가·사무실 원상복구 바닥 철거, 실측 면적 정산. 서울·경기·인천 수도권 전 지역.",
  priceRange: "$$",
  areaServed: areaServedJsonLd,
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
  name: company.brandName,
  alternateName: company.nameEn,
  ...(b.legalName ? { legalName: b.legalName } : {}),
  ...(b.representativeName ? { founder: { "@type": "Person", name: b.representativeName } } : {}),
  url: siteUrl,
  // Organization.logo 는 정사각(/logo.png) — 가로 OG를 로고로 쓰면 검색 썸네일에서 좌우가 잘린다.
  logo: `${siteUrl}/logo.png`,
  ...(businessSameAs.length ? { sameAs: businessSameAs } : {}),
  description: "수도권 바닥재 철거·바닥 샌딩·상가 원상복구 전문",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: company.phone,
    contactType: "customer service",
    areaServed: "KR",
    availableLanguage: ["Korean"],
  },
};

// ⚠ 전역 BreadcrumbList 제거: 이전엔 상단 네비(홈>시공사례>후기>FAQ>정보)를 BreadcrumbList 로
//   모든 페이지에 주입했는데, 이는 '현재 페이지까지의 계층 경로'가 아니라 사이트 메뉴라서
//   검색결과에 "후기 > 자주 묻는 질문 > 정보" 같은 잘못된 경로를 노출시켰다. 또 개별 페이지의
//   올바른 브레드크럼과 이중 출력됐다. → 브레드크럼은 각 페이지가 자기 계층으로만 출력한다.
//   (faq·reviews·gallery·blog 목록엔 페이지별 BreadcrumbList 를 추가함)

const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  url: siteUrl,
  name: "프로다",
  // 검색결과 사이트명 신호: 정식명은 '프로다', 보조명으로 영문·업종설명을 제공(억지 키워드 반복 아님).
  alternateName: ["PRODA", "프로다 바닥철거·샌딩"],
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
