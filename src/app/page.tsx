import type { Metadata } from "next";
import Link from "next/link";
import { company } from "@/data/company";
import { allReviews } from "@/data/reviews";
import { faqs } from "@/data/faq";
import { galleryItems } from "@/data/gallery";
import { quoteFactors, consultPrep, ctaConfig } from "@/data/landing";
import { getKeywords } from "@/data/keywords";
import GalleryImage from "@/components/GalleryImage";
import KeyAnswer from "@/components/KeyAnswer";
import QuoteChecklist from "@/components/QuoteChecklist";
import CtaBand from "@/components/CtaBand";
import CallbackForm from "@/components/CallbackForm";
import ReviewsMarquee from "@/components/ReviewsMarquee";
import { PhoneIcon, KakaoIcon, MessageIcon } from "@/components/icons";
import { keyAnswerForHome } from "@/data/keyAnswer";
import home from "../../content/home.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

export const metadata: Metadata = {
  // 레이아웃 template("%s | 프로다")가 접미사를 붙이므로 여기선 접미사를 빼서 이중 표기 방지
  title: { absolute: "바닥재 철거·마루 철거 견적 상담 | 프로다" },
  description:
    "마루·데코타일·장판 철거, 상가·사무실 원상복구 바닥 철거 상담. 현장 사진과 면적을 보내면 작업 범위와 견적 기준을 안내합니다. 수도권 전 지역. ☎ 010-8470-4965",
  alternates: { canonical: siteUrl },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.slice(0, 8).map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

// HowTo는 프로세스 콘텐츠가 실제로 있는 홈에서만 출력 (콘텐츠-스키마 일치)
const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "바닥재 철거 진행 과정",
  description: "바닥재 철거 4단계 프로세스 — 상담부터 실측 정산까지",
  step: company.process.map((s) => ({
    "@type": "HowToStep",
    position: s.step,
    name: s.title,
    text: s.description,
  })),
};

export default function Home() {
  const tickerLine = home.tickerWords.join("  ✦  ") + "  ✦  ";

  // 홈 → 지역 허브(/services/{region}) 내부링크. 주요 지역 허브로 연결해
  // 키워드 페이지의 고립을 풀고 크롤·색인 깊이를 낮춘다(허브가 롱테일로 권위 전파).
  const FEATURED_REGIONS = ["서울", "강남", "송파", "마포", "성남", "수원", "용인", "고양", "부천", "인천", "부평", "안양"];
  const regionLinks = (() => {
    const hubRegions = new Set(getKeywords().filter((k) => k.type === "region-item" && k.region).map((k) => k.region));
    return FEATURED_REGIONS.filter((r) => hubRegions.has(r));
  })();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#16181D] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-[-80px] h-full w-[340px] opacity-[0.05]"
          style={{ background: "repeating-linear-gradient(135deg,#FFD400 0 22px,transparent 22px 44px)" }}
        />
        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10 pt-12 sm:pt-16 lg:pt-[88px]">
          <div className="flex flex-wrap items-center gap-8 lg:gap-16">
            <div className="flex-1 basis-[480px] min-w-[300px]">
              <div className="mb-6 flex items-center gap-3">
                <span className="inline-block h-[3px] w-[34px] bg-[#FFD400]" />
                <span className="font-mono-pd text-xs font-medium uppercase tracking-[0.18em] text-[#FFD400]">
                  {home.hero.badgeRegions}
                </span>
              </div>
              <h1 className="mb-6 pb-1 text-[34px] sm:text-5xl lg:text-[74px] font-black leading-[1.18] tracking-[-0.03em]">
                {home.hero.h1Part1}<br />
                <span className="text-[#FFD400]">{home.hero.h1Accent}</span>{home.hero.h1Part2}<br />{home.hero.h1Part3}
              </h1>
              <p className="mb-7 max-w-[520px] text-[15px] sm:text-base lg:text-lg leading-[1.75] text-[#A8AEB8]">
                {company.heroSubcopy}
              </p>
              <div className="mb-8 inline-flex items-center gap-2.5 rounded-sm border border-[#FFD400]/35 bg-[#FFD400]/10 px-3.5 py-2.5">
                <span className="font-mono-pd text-[13px] font-extrabold text-[#FFD400]">{home.hero.badgeLabel}</span>
                <span className="text-[13.5px] font-semibold text-[#E6E8EC]">{home.hero.badgeSubtext}</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={company.kakaoUrl}
                  target="_blank"
                  rel="noopener"
                  aria-label="카카오톡으로 사진 보내고 빠른 견적 받기"
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-sm bg-[#FFD400] px-6 py-4 text-base font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D] sm:w-auto sm:justify-start"
                >
                  <KakaoIcon className="h-[18px] w-[18px] shrink-0" />
                  {ctaConfig.kakaoPrimary}
                </a>
                <a
                  href={company.phoneLink}
                  aria-label={`전화로 바로 상담 ${company.phone}`}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-sm border-2 border-white/30 px-6 py-4 text-base font-extrabold text-white transition-colors hover:border-[#FFD400] hover:text-[#FFD400] sm:w-auto sm:justify-start"
                >
                  <PhoneIcon className="h-[18px] w-[18px] shrink-0" />
                  {ctaConfig.phonePrimary}
                </a>
              </div>
              <p className="mt-3 text-[13px] text-[#7B818C]">{ctaConfig.kakaoMicro}</p>
            </div>
            <div className="relative flex-1 basis-[360px] min-w-[280px]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] border-[3px] border-[#FFD400] bg-[#22262E]">
                <GalleryImage src={galleryItems[0].afterImage} alt="바닥재 철거 후 정밀 샌딩으로 정리된 수도권 작업 현장" className="h-full w-full" priority />
              </div>
              <div className="absolute bottom-6 left-[-14px] rounded-sm bg-[#FFD400] px-[18px] py-3 text-[#16181D] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                <p className="font-mono-pd text-[11px] font-bold tracking-[0.1em]">{home.hero.sinceLabel}</p>
                <p className="mt-0.5 text-[26px] font-black leading-none">{home.hero.sinceValue}</p>
              </div>
            </div>
          </div>

          {/* trust stat strip */}
          <div className="mt-11 lg:mt-[72px] grid grid-cols-2 gap-px border border-white/[0.08] bg-white/[0.08] md:grid-cols-4">
            {home.stats.map((s) => (
              <div key={s.label} className="bg-[#16181D] px-4 py-[22px] sm:px-6">
                <p className="font-mono-pd text-[11px] uppercase tracking-[0.12em] text-[#AEB4BE]">{s.label}</p>
                <p className={`mt-[5px] text-2xl sm:text-3xl font-black leading-none ${s.accent ? "text-[#FFD400]" : ""}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="h-10 lg:h-[72px]" />
        </div>
      </section>

      {/* TICKER */}
      <div className="overflow-hidden whitespace-nowrap border-y-[3px] border-[#16181D] bg-[#FFD400] text-[#16181D]">
        <div className="pd-marquee inline-flex font-mono-pd text-[13px] sm:text-base font-bold tracking-[0.04em]" style={{ padding: "13px 0" }}>
          <span>{tickerLine}</span>
          <span>{tickerLine}</span>
        </div>
      </div>

      {/* GEO/AEO 빠른 답변 — 사이트 대표 질문+답변(생성형 검색 인용용, 상단 노출) */}
      <KeyAnswer {...keyAnswerForHome()} />

      {/* GEO SUMMARY — 생성형 검색 인용용 요약 */}
      <section className="bg-white px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[900px]">
          <p className="mb-3 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#9A8A2E]">{home.about.label}</p>
          <h2 className="mb-4 text-xl font-black tracking-[-0.02em] sm:text-2xl">{home.about.heading}</h2>
          <p className="text-[15px] leading-[1.8] text-[#3A4048] sm:text-base">{company.geoSummary}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {home.about.skillBadges.map((k) => (
              <span key={k} className="rounded-sm border border-gray-200 bg-[#F7F6F3] px-2.5 py-1 text-xs font-semibold text-gray-600">
                {k}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="bg-[#F7F6F3] px-4 py-14 sm:px-6 lg:px-10 lg:py-[104px]">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b-2 border-[#16181D] pb-[18px] lg:mb-[52px]">
            <div>
              <p className="mb-2.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#9A8A2E]">{home.sections.services.label}</p>
              <h2 className="text-[28px] sm:text-4xl lg:text-5xl font-black leading-[1.05] tracking-[-0.03em]">{home.sections.services.heading}</h2>
            </div>
            <p className="text-sm font-semibold text-[#6B7280]">{home.sections.services.subheading}</p>
          </div>
          <div className="grid grid-cols-1 gap-px border-2 border-[#16181D] bg-[#16181D] sm:grid-cols-2 lg:grid-cols-3">
            {company.services.map((service, i) => {
              const last = i === company.services.length - 1;
              return (
                <div
                  key={service.id}
                  className={`group flex flex-col p-6 lg:p-9 ${last ? "relative bg-[#16181D]" : "bg-white transition-colors hover:bg-[#FFD400]"}`}
                >
                  {last && (
                    <span className="absolute right-6 top-6 rounded-sm bg-[#FFD400] px-[7px] py-[3px] font-mono-pd text-[10px] font-bold tracking-[0.12em] text-[#16181D] lg:right-9 lg:top-9">
                      {home.labels.serviceFlagBadge}
                    </span>
                  )}
                  <p className={`mb-3.5 font-mono-pd text-[13px] font-bold ${last ? "text-[#FFD400]" : "text-[#16181D]"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className={`mb-2.5 text-xl font-extrabold tracking-[-0.02em] ${last ? "text-white" : ""}`}>{service.name}</h3>
                  <p className={`text-[14.5px] leading-[1.65] ${last ? "text-[#A8AEB8]" : "text-[#5A6068]"}`}>{service.description}</p>
                  <a
                    href={company.kakaoUrl}
                    target="_blank"
                    rel="noopener"
                    aria-label={`${service.name} 카카오톡으로 상담하기`}
                    className={`mt-auto inline-flex items-center gap-1.5 pt-5 text-[13px] font-extrabold tracking-[-0.01em] ${
                      last ? "text-[#FFD400]" : "text-[#16181D]"
                    }`}
                  >
                    {home.labels.serviceCta}
                    <span aria-hidden className="font-mono-pd">→</span>
                  </a>
                </div>
              );
            })}
          </div>

          {regionLinks.length > 0 && (
            <div className="mt-10 border-t-2 border-[#16181D] pt-7">
              <p className="mb-3 font-mono-pd text-xs font-bold uppercase tracking-[0.14em] text-[#9A8A2E]">{home.labels.regionLinksTitle}</p>
              <div className="flex flex-wrap gap-2">
                {regionLinks.map((region) => (
                  <Link
                    key={region}
                    href={`/services/${encodeURIComponent(region)}`}
                    className="border border-[#16181D]/20 bg-white px-3 py-1.5 text-[13px] font-semibold text-[#16181D] transition-colors hover:border-[#9A8A2E] hover:text-[#9A8A2E]"
                  >
                    {region}{home.labels.regionLinkSuffix}
                  </Link>
                ))}
                <Link
                  href="/services"
                  className="border border-[#16181D] bg-[#16181D] px-3 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-[#9A8A2E]"
                >
                  {home.labels.allServicesLink}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* DIFFERENTIATOR */}
      <section className="relative overflow-hidden bg-[#16181D] px-4 py-14 text-white sm:px-6 lg:px-10 lg:py-[104px]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-9 lg:gap-[72px]">
          <div className="flex-1 basis-[440px] min-w-[300px]">
            <p className="mb-3.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#FFD400]">
              {home.sections.differentiator.label}
            </p>
            <h2 className="mb-[22px] text-[28px] sm:text-4xl lg:text-[52px] font-black leading-[1.2] tracking-[-0.03em]">
              {company.differentiator.title.split(" ").length > 1 ? (
                <>{home.sections.differentiator.headingLine1}<br />{home.sections.differentiator.headingLine2}</>
              ) : company.differentiator.title}
            </h2>
            <p className="mb-7 max-w-[540px] text-[14.5px] lg:text-[16.5px] leading-[1.75] text-[#A8AEB8]">
              {company.differentiator.body}
            </p>
            <ul className="border-t border-white/[0.12]">
              {company.differentiator.points.map((p) => (
                <li key={p} className="flex items-start gap-3.5 border-b border-white/[0.12] py-4">
                  <span className="font-mono-pd text-sm font-black text-[#FFD400]">→</span>
                  <span className="text-[15.5px] font-semibold text-[#E6E8EC]">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 basis-[380px] min-w-[280px]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2.5">
              <div>
                <p className="mb-2 font-mono-pd text-[11px] font-bold uppercase tracking-[0.14em] text-[#7B818C]">{home.labels.beforeLabel}</p>
                <div className="aspect-[4/3] overflow-hidden rounded-[3px] border-2 border-white/[0.18] bg-[#22262E] sm:aspect-[3/4]">
                  <GalleryImage src={galleryItems[1].beforeImage} alt="철거 전 바닥" className="h-full w-full" />
                </div>
              </div>
              <div>
                <p className="mb-2 font-mono-pd text-[11px] font-bold uppercase tracking-[0.14em] text-[#FFD400]">{home.labels.afterLabel}</p>
                <div className="aspect-[4/3] overflow-hidden rounded-[3px] border-2 border-[#FFD400] bg-[#22262E] sm:aspect-[3/4]">
                  <GalleryImage src={galleryItems[1].afterImage} alt="정밀 샌딩 후 바닥" className="h-full w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="bg-[#EDEBE4] px-4 py-14 sm:px-6 lg:px-10 lg:py-[104px]">
        <div className="mx-auto max-w-[1200px]">
          <p className="mb-2.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#9A8A2E]">{home.sections.process.label}</p>
          <h2 className="mb-8 text-[28px] sm:text-4xl lg:text-5xl font-black leading-[1.05] tracking-[-0.03em] lg:mb-[52px]">
            {home.sections.process.heading}
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {company.process.map((step, i) => (
              <div key={step.step} className={`border-t-[3px] pt-5 ${i === company.process.length - 1 ? "border-[#FFD400]" : "border-[#16181D]"}`}>
                <p className="mb-3.5 text-[40px] lg:text-[60px] font-black leading-[0.9] tracking-[-0.04em] text-[#16181D]">
                  {String(step.step).padStart(2, "0")}
                </p>
                <h3 className="mb-2 text-[17px] font-extrabold tracking-[-0.02em]">{step.title}</h3>
                <p className="text-sm leading-[1.6] text-[#5A6068]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING ANCHOR — 견적이 달라지는 기준 + 체크리스트 */}
      <section id="quote" className="bg-[#F7F6F3] px-4 py-14 sm:px-6 lg:px-10 lg:py-[104px]">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-8 border-b-2 border-[#16181D] pb-[18px] lg:mb-[52px]">
            <p className="mb-2.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#9A8A2E]">{home.sections.quote.label}</p>
            <h2 className="text-[28px] sm:text-4xl lg:text-5xl font-black leading-[1.05] tracking-[-0.03em]">{home.sections.quote.heading}</h2>
            <p className="mt-3 max-w-2xl text-sm text-[#5A6068]">
              {home.sections.quote.intro}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            <ul className="grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2">
              {quoteFactors.map((f, i) => (
                <li key={f.id} className="bg-white p-5">
                  <p className="mb-1 flex items-baseline gap-2">
                    <span className="font-mono-pd text-xs font-bold text-[#9A8A2E]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[15px] font-extrabold text-[#16181D]">{f.label}</span>
                  </p>
                  <p className="text-[13px] leading-relaxed text-[#5A6068]">{f.detail}</p>
                </li>
              ))}
            </ul>
            <div>
              <QuoteChecklist />
            </div>
          </div>
        </div>
      </section>

      <CtaBand heading={ctaConfig.midroll} />

      {/* GALLERY */}
      <section className="bg-white px-4 py-14 sm:px-6 lg:px-10 lg:py-[104px]">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-7 border-b-2 border-[#16181D] pb-[18px] lg:mb-11">
            <p className="mb-2.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#9A8A2E]">{home.sections.gallery.label}</p>
            <h2 className="text-[28px] sm:text-4xl lg:text-5xl font-black leading-[1.05] tracking-[-0.03em]">
              {home.sections.gallery.heading} <span className="text-[0.5em] font-bold tracking-normal text-[#9CA3AF]">{home.sections.gallery.headingSuffix}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {galleryItems.slice(0, 6).map((item, i) => (
              <div key={item.id}>
                <div className={`grid grid-cols-1 gap-1 overflow-hidden rounded-[3px] border-2 sm:grid-cols-2 ${i === 5 ? "border-[#FFD400]" : "border-[#16181D]"}`}>
                  <GalleryImage src={item.beforeImage} alt={`${item.title} 철거 전`} label={home.labels.galleryBeforeChip} className="aspect-[4/3] w-full" />
                  <GalleryImage src={item.afterImage} alt={`${item.title} 샌딩 후`} label={home.labels.galleryAfterChip} className="aspect-[4/3] w-full" />
                </div>
                <p className="mb-0.5 mt-3 text-[15.5px] font-extrabold tracking-[-0.02em]">{item.title}</p>
                <p className="text-[13px] text-[#6B7280]">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-9 text-center lg:mt-12">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-[#16181D] px-6 py-3 text-[15px] font-extrabold text-[#16181D] transition-colors hover:bg-[#16181D] hover:text-white"
            >
              {home.labels.galleryAllLink}
              <span aria-hidden className="font-mono-pd">→</span>
            </Link>
          </div>
        </div>
      </section>

      <CtaBand heading={home.midrollGalleryHeading} />

      {/* REVIEWS — 가로로 흐르는 마퀴 */}
      <section className="bg-[#16181D] px-4 py-14 text-white sm:px-6 lg:px-10 lg:py-[104px]">
        <div className="mx-auto mb-8 max-w-[1100px] lg:mb-[52px]">
          <p className="mb-2.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#FFD400]">{home.sections.reviews.label}</p>
          <h2 className="mb-3 text-[28px] sm:text-4xl lg:text-5xl font-black leading-[1.05] tracking-[-0.03em]">
            {home.sections.reviews.heading}
          </h2>
          <p className="text-sm leading-relaxed text-[#9CA3AF]">
            {home.reviewsDisclaimerPrefix}
            <span className="font-bold text-[#D6D9DE]">{home.reviewsDisclaimerEmphasis}</span>{home.reviewsDisclaimerSuffix}
          </p>
        </div>

        <div className="mx-auto max-w-[1100px]">
          <ReviewsMarquee reviews={allReviews} />
        </div>

        <div className="mx-auto mt-9 max-w-[1100px] text-center lg:mt-12">
          <Link
            href="/reviews"
            className="inline-flex items-center gap-2 rounded-sm border-2 border-white/30 px-6 py-3 text-[15px] font-extrabold text-white transition-colors hover:border-[#FFD400] hover:text-[#FFD400]"
          >
            {home.labels.reviewsAllLink}
            <span aria-hidden className="font-mono-pd">→</span>
          </Link>
        </div>
      </section>

      {/* CONSULT PREP — 상담 전 준비하면 좋은 정보 */}
      <section className="bg-white px-4 py-14 sm:px-6 lg:px-10 lg:py-[88px]">
        <div className="mx-auto max-w-[1000px]">
          <p className="mb-2.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#9A8A2E]">{home.sections.prepare.label}</p>
          <h2 className="mb-7 text-[28px] sm:text-4xl font-black leading-[1.05] tracking-[-0.03em]">{home.sections.prepare.heading}</h2>
          <div className="grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-5">
            {consultPrep.map((p, i) => (
              <div key={p.id} className="bg-white p-5">
                <p className="font-mono-pd text-xs font-bold text-[#9A8A2E]">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-2 text-[15px] font-extrabold text-[#16181D]">{p.label}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#5A6068]">{p.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#F7F6F3] px-4 py-14 sm:px-6 lg:px-10 lg:py-[104px]">
        <div className="mx-auto max-w-[860px]">
          <p className="mb-2.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#9A8A2E]">{home.sections.faq.label}</p>
          <h2 className="mb-7 text-[28px] sm:text-4xl lg:text-5xl font-black leading-[1.05] tracking-[-0.03em] lg:mb-11">
            {home.sections.faq.heading}
          </h2>
          <div className="border-t-2 border-[#16181D]">
            {faqs.slice(0, 8).map((faq) => (
              <details key={faq.id} className="border-b border-[#DAD7CE]">
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-[22px] text-base font-extrabold tracking-[-0.01em] sm:text-lg">
                  {faq.question}
                  <span className="pd-faq-plus shrink-0 text-2xl font-light leading-none text-[#16181D] transition-transform">+</span>
                </summary>
                <p className="m-0 pb-6 text-[15px] leading-[1.75] text-[#5A6068]">{faq.answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-9 text-center lg:mt-11">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-[#16181D] px-6 py-3 text-[15px] font-extrabold text-[#16181D] transition-colors hover:bg-[#16181D] hover:text-white"
            >
              {home.labels.faqAllLink}
              <span aria-hidden className="font-mono-pd">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* CALLBACK — 카톡·전화가 부담스러운 분을 위한 번호 남기기 */}
      <section className="bg-white px-4 py-14 sm:px-6 lg:px-10 lg:py-[88px]">
        <div className="mx-auto grid max-w-[1000px] grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="mb-2.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#9A8A2E]">{home.sections.callback.label}</p>
            <h2 className="mb-4 text-[28px] sm:text-4xl font-black leading-[1.2] tracking-[-0.03em]">{home.sections.callback.headingLine1}<br />{home.sections.callback.headingLine2}</h2>
            <p className="text-[15px] leading-[1.8] text-[#5A6068]">
              {home.sections.callback.description}
            </p>
          </div>
          <CallbackForm />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-[#16181D] text-white">
        <div className="h-3.5" style={{ background: "repeating-linear-gradient(45deg,#FFD400 0 18px,#16181D 18px 36px)" }} />
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-7 px-4 py-12 sm:px-6 lg:gap-12 lg:px-10 lg:py-[88px]">
          <div className="flex-1 basis-[380px] min-w-[280px]">
            <p className="mb-3.5 font-mono-pd text-xs font-bold uppercase tracking-[0.18em] text-[#FFD400]">{home.finalCta.badge}</p>
            <h2 className="text-3xl sm:text-4xl lg:text-[52px] font-black leading-[1.2] tracking-[-0.03em]">
              {home.finalCta.headingLine1}<br />{home.finalCta.headingLine2Prefix}<span className="text-[#FFD400]">{home.finalCta.headingLine2Accent}</span>
            </h2>
            <p className="mt-[18px] text-[15px] leading-[1.7] text-[#A8AEB8]">
              {home.finalCta.copyPrefix}{company.responseTimeText}
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-sm border border-[#FFD400]/35 bg-[#FFD400]/10 px-3 py-2 font-mono-pd text-[12px] font-bold uppercase tracking-[0.06em] text-[#FFD400]">
              {ctaConfig.trust}
            </p>
          </div>
          <div className="flex w-full max-w-[320px] shrink-0 flex-col gap-3">
            <a
              href={company.kakaoUrl}
              target="_blank"
              rel="noopener"
              aria-label="카카오톡으로 사진 보내고 빠른 견적 받기"
              className="inline-flex items-center justify-center gap-2.5 rounded-sm bg-[#FFD400] px-6 py-[18px] text-[17px] font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D]"
            >
              <KakaoIcon className="h-[19px] w-[19px]" />
              {ctaConfig.kakaoPrimary}
            </a>
            <a
              href={company.phoneLink}
              aria-label={`전화로 바로 상담 ${company.phone}`}
              className="inline-flex items-center justify-center gap-2.5 rounded-sm border-2 border-white/30 px-6 py-[18px] text-[17px] font-extrabold text-white transition-colors hover:border-[#FFD400] hover:text-[#FFD400]"
            >
              <PhoneIcon className="h-[19px] w-[19px]" />
              {company.phone}
            </a>
            <a
              href={company.smsLink}
              aria-label="문자로 사진 보내기"
              className="inline-flex items-center justify-center gap-2.5 rounded-sm border-2 border-white/30 px-6 py-3.5 text-[15px] font-extrabold text-white transition-colors hover:border-[#FFD400] hover:text-[#FFD400]"
            >
              <MessageIcon className="h-[17px] w-[17px]" />
              {ctaConfig.smsPrimary}
            </a>
            {company.naverPlaceUrl && (
              <a
                href={company.naverPlaceUrl}
                target="_blank"
                rel="noopener"
                className="text-center text-[13px] font-semibold text-[#A8AEB8] underline-offset-4 hover:text-white hover:underline"
              >
                {home.labels.naverPlaceLink}
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
