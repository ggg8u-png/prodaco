// 시공사례 상세 — 목록(/gallery) 안의 카드가 아니라 독립 웹문서.
//
// 서버 컴포넌트 + generateStaticParams = 빌드 시 정적 HTML 로 생성된다. 즉 검색로봇이
// JavaScript 를 실행하지 않아도 H1·본문·이미지 alt·내부링크가 HTML 안에 그대로 있다.
// 새 사례를 CMS 에서 발행하면 파일이 하나 늘고, 이 라우트가 그 사례의 페이지를 자동으로
// 만든다 — 개발자가 손댈 곳이 없다.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import GalleryImage from "@/components/GalleryImage";
import CtaBand from "@/components/CtaBand";
import { company } from "@/data/company";
import { itemFactsFor } from "@/data/itemFacts";
import {
  casePath,
  caseUrl,
  caseById,
  casePageItems,
  isCaseIndexable,
  caseDateInfo,
  caseRelatedLinks,
  siblingCases,
  decodeCaseId,
} from "@/lib/caseDoc";
import { uploadedImage } from "@/lib/cdnImage";
import CaseVideo, { videoEmbedUrl } from "@/components/CaseVideo";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

export async function generateStaticParams() {
  return casePageItems().map((g) => ({ id: g.id }));
}

/** 사례 설명을 그대로 쓰되, 지역·품목을 앞에 붙여 검색결과에서 무엇인지 바로 알게 한다. */
function descriptionFor(region: string, item: string, desc: string): string {
  const head = `${region} ${item} 시공사례.`;
  const body = (desc || "").trim().replace(/\s+/g, " ");
  const full = body ? `${head} ${body}` : head;
  if (full.length <= 158) return full;
  const slice = full.slice(0, 155);
  return `${slice.slice(0, slice.lastIndexOf(" ") > 100 ? slice.lastIndexOf(" ") : 155).trim()}…`;
}

/** 절대 URL 로 정규화 — 구조화데이터·og:image 는 상대경로를 쓰면 안 된다. */
function absoluteImage(src: string): string {
  const s = uploadedImage(src);
  return s.startsWith("http") ? s : `${siteUrl}${s.startsWith("/") ? "" : "/"}${s}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: rawId } = await params;
  const g = caseById(decodeCaseId(rawId));
  if (!g) return {};
  const url = caseUrl(siteUrl, g.id);
  const description = descriptionFor(g.region, g.item, g.description);
  const indexable = isCaseIndexable(g);
  return {
    title: g.title,
    description,
    alternates: { canonical: url },
    // 얇은 사례는 검색결과에 내보내지 않되 링크는 따라가게 둔다(follow).
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title: `${g.title} | 프로다`,
      description,
      type: "article",
      url,
      images: [absoluteImage(g.afterImage)],
    },
  };
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const g = caseById(decodeCaseId(rawId));
  if (!g) notFound();

  const url = caseUrl(siteUrl, g.id);
  const { published, modified } = caseDateInfo(g);
  const related = caseRelatedLinks(g);
  const siblings = siblingCases(g, 3);
  const facts = itemFactsFor(g.item);

  // 화면에 실제로 표시하는 항목만 모은다 — JSON-LD 와 화면 내용이 어긋나면 안 된다.
  const specs: Array<[string, string]> = [
    ["지역", g.region],
    ["작업 종류", g.item],
    ...(g.buildingType ? ([["건물 유형", g.buildingType]] as Array<[string, string]>) : []),
    ...(g.area ? ([["작업 면적", g.area]] as Array<[string, string]>) : []),
    ...(g.workScope ? ([["작업 범위", g.workScope]] as Array<[string, string]>) : []),
    ...(g.cost ? ([["비용", g.cost]] as Array<[string, string]>) : []),
    ...(published ? ([["작업일", published]] as Array<[string, string]>) : []),
  ];

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": url,
    headline: g.title,
    description: descriptionFor(g.region, g.item, g.description),
    inLanguage: "ko",
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: [absoluteImage(g.beforeImage), absoluteImage(g.afterImage)],
    // 날짜는 있는 것만 싣는다 — git 을 못 읽는 환경에서 없는 날짜를 지어내지 않는다.
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    author: { "@type": "Organization", name: company.brandName, url: siteUrl, telephone: company.phone },
    publisher: { "@type": "Organization", name: company.brandName, url: siteUrl },
    articleSection: "시공사례",
    about: g.item,
    contentLocation: { "@type": "Place", name: g.region },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "시공사례", item: `${siteUrl}/gallery` },
      { "@type": "ListItem", position: 3, name: g.title, item: url },
    ],
  };

  // 영상 구조화데이터 — 실제 영상 주소가 있을 때만 내보낸다(없는 영상을 선언하지 않는다).
  const videoJsonLd = videoEmbedUrl(g)
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: g.videoTitle || `${g.region} ${g.item} 시공 영상`,
        description: g.description || `${g.region} ${g.item} 시공 과정 영상`,
        thumbnailUrl: [absoluteImage(g.videoThumbnail || g.afterImage)],
        contentUrl: g.videoUrl,
        embedUrl: videoEmbedUrl(g),
        ...(published ? { uploadDate: published } : {}),
      }
    : null;

  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {videoJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }} />
      )}

      <section className="bg-[#16181D] px-5 pt-14 pb-12 text-white">
        <div className="mx-auto max-w-3xl">
          <nav className="mb-5 flex items-center gap-2 text-xs text-gray-500">
            <Link href="/" className="hover:text-gray-300">홈</Link>
            <span>›</span>
            <Link href="/gallery" className="hover:text-gray-300">시공사례</Link>
            <span>›</span>
            <span className="text-gray-400">{g.region}</span>
          </nav>
          <p className="font-mono-pd mb-3 text-xs font-bold uppercase tracking-widest text-[#FFD400]">{g.item}</p>
          <h1 className="mb-4 text-2xl font-black leading-tight md:text-3xl">{g.title}</h1>
          {published && (
            <p className="text-xs text-gray-500">
              작업일 <time dateTime={published}>{published}</time>
              {modified && modified !== published && (
                <> · 수정 <time dateTime={modified}>{modified}</time></>
              )}
            </p>
          )}
        </div>
      </section>

      <section className="px-5 py-12">
        <div className="mx-auto max-w-3xl">
          {/* 철거 전 / 샌딩 후 — alt 에 지역·품목을 넣어 이미지 검색에서도 의미가 통하게 한다. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <figure>
              <figcaption className="mb-1 font-mono-pd text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Before · 철거 전
              </figcaption>
              <GalleryImage
                src={g.beforeImage}
                alt={`${g.region} ${g.item} 철거 전 바닥 상태`}
                className="h-56 w-full sm:h-64"
                priority
              />
            </figure>
            <figure>
              <figcaption className="mb-1 font-mono-pd text-[11px] font-bold uppercase tracking-widest text-[#9A8A2E]">
                After · 샌딩 후
              </figcaption>
              <GalleryImage
                src={g.afterImage}
                alt={`${g.region} ${g.item} 철거·샌딩 완료 후 바닥`}
                className="h-56 w-full sm:h-64"
              />
            </figure>
          </div>

          {g.description && (
            <p className="mt-8 text-[15px] leading-[1.85] text-[#3A4048]">{g.description}</p>
          )}

          {/* 시공 영상 — 값이 없으면 아무것도 그리지 않는다. */}
          <CaseVideo item={g} />

          {/* 현장 정보 — 운영자가 입력한 값만 나온다(없는 항목은 행 자체가 없다). */}
          <dl className="mt-8 grid grid-cols-2 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-3">
            {specs.map(([k, v]) => (
              <div key={k} className="bg-white px-3 py-3">
                <dt className="font-mono-pd text-[10px] font-bold uppercase tracking-[0.1em] text-[#9A8A2E]">{k}</dt>
                <dd className="mt-1 text-[13px] font-extrabold text-[#16181D]">{v}</dd>
              </div>
            ))}
          </dl>

          {/* 이 품목의 실제 작업 방식 — src/data/itemFacts.ts 의 운영자 확인 정보. */}
          {facts.removal && (
            <section className="mt-10 border-l-4 border-[#FFD400] pl-5">
              <h2 className="text-base font-black text-[#16181D]">{g.item}는 이렇게 진행합니다</h2>
              <p className="mt-2 text-[14px] leading-[1.8] text-[#4A4F58]">{facts.removal}</p>
              {facts.attach && <p className="mt-2 text-[14px] leading-[1.8] text-[#4A4F58]">{facts.attach}</p>}
            </section>
          )}

          {/* 관련 페이지 — 색인 대상 페이지로만 연결한다. */}
          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="font-mono-pd mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9A8A2E]">관련 서비스</h2>
              <div className="flex flex-wrap gap-2">
                {related.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#16181D] transition-colors hover:border-[#9A8A2E] hover:text-[#9A8A2E]"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 다른 사례 — 목록을 거치지 않고도 사례끼리 탐색되도록 한다. */}
          {siblings.length > 0 && (
            <section className="mt-12">
              <h2 className="font-mono-pd mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#9A8A2E]">다른 시공사례</h2>
              <div className="divide-y divide-gray-100 border-t border-gray-200">
                {siblings.map((s) => (
                  <Link key={s.id} href={casePath(s.id)} className="group flex items-start gap-3 py-4">
                    <span className="font-mono-pd w-16 shrink-0 pt-0.5 text-[11px] font-bold uppercase text-[#9A8A2E]">{s.region}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold leading-snug text-[#16181D] transition-colors group-hover:text-[#9A8A2E]">
                        {s.title}
                      </span>
                      <span className="mt-1 line-clamp-1 block text-[13px] text-gray-500">{s.description}</span>
                    </span>
                    <span aria-hidden className="font-mono-pd text-gray-300 transition-colors group-hover:text-[#9A8A2E]">→</span>
                  </Link>
                ))}
              </div>
              <div className="mt-5">
                <Link href="/gallery" className="inline-flex items-center gap-2 text-[14px] font-extrabold text-[#16181D] transition-colors hover:text-[#9A8A2E]">
                  시공사례 전체 보기 <span aria-hidden className="font-mono-pd">→</span>
                </Link>
              </div>
            </section>
          )}
        </div>
      </section>

      <CtaBand heading={`${g.region} ${g.item}, 사진 한 장이면 견적 상담 시작`} />
    </div>
  );
}
