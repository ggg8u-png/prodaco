import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { posts } from "@/data/posts";
import { company } from "@/data/company";
import { faqs } from "@/data/faq";
import CtaBand from "@/components/CtaBand";
import { PhoneIcon, KakaoIcon } from "@/components/icons";
import ui from "../../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

export async function generateStaticParams() {
  return posts.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = posts.find((p) => p.id === id);
  if (!post) return {};
  const url = `${siteUrl}/blog/${id}`;
  return {
    // 레이아웃 template이 "| 프로다"를 붙이므로 제목만 지정 (이중 접미사 방지)
    title: post.title,
    description: post.excerpt,
    keywords: post.tags,
    alternates: { canonical: url },
    openGraph: {
      title: `${post.title} | 프로다`,
      description: post.excerpt,
      type: "article",
      url,
      publishedTime: post.date,
      tags: post.tags,
      images: ["/opengraph-image"],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = posts.find((p) => p.id === id);
  if (!post) notFound();

  const postUrl = `${siteUrl}/blog/${id}`;

  // 관련 글 — 같은 카테고리 우선, 부족하면 다른 글로 채움 (내부 링크 → SEO)
  const rest = posts.filter((p) => p.id !== post.id);
  const relatedPosts = [
    ...rest.filter((p) => p.category === post.category),
    ...rest.filter((p) => p.category !== post.category),
  ].slice(0, 4);

  const faqSubset = faqs.slice(0, 4);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": postUrl,
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: "ko",
    url: postUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    image: [`${siteUrl}/opengraph-image`],
    author: {
      "@type": "Organization",
      name: company.name,
      url: siteUrl,
      telephone: company.phone,
    },
    publisher: {
      "@type": "Organization",
      name: company.name,
      url: siteUrl,
    },
    keywords: post.tags.join(", "),
    articleSection: post.category,
  };

  // 브레드크럼 — 검색결과 경로 표시 + 내부 링크 구조 강화
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "정보", item: `${siteUrl}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: postUrl },
    ],
  };

  // FAQ 스키마 — 본문 하단 자주 묻는 질문과 일치
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqSubset.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-3xl mx-auto">
          <nav className="text-gray-500 text-xs mb-5 flex items-center gap-2">
            <Link href="/" className="hover:text-gray-300">홈</Link>
            <span>›</span>
            <Link href="/blog" className="hover:text-gray-300">정보</Link>
            <span>›</span>
            <span className="text-gray-400">{post.category}</span>
          </nav>
          <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-widest mb-3">{post.category}</p>
          <h1 className="text-2xl md:text-3xl font-black leading-tight mb-4">{post.title}</h1>
          <p className="text-gray-500 text-xs">{post.date}</p>
        </div>
      </section>

      <section className="py-12 px-5">
        <div className="max-w-3xl mx-auto">
          <article className="space-y-4">
            {post.content.split("\n\n").map((block, i) => {
              if (block.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-lg font-black mt-10 mb-3 pt-6 border-t border-gray-100">
                    {block.slice(3)}
                  </h2>
                );
              }
              if (block.startsWith("### ")) {
                return <h3 key={i} className="text-base font-bold mt-6 mb-2">{block.slice(4)}</h3>;
              }
              if (block.startsWith("> ")) {
                return (
                  <blockquote key={i} className="border-l-[3px] border-[#FFD400] pl-4 text-gray-600 text-sm italic my-4">
                    {block.slice(2)}
                  </blockquote>
                );
              }
              if (block.match(/^[1-9]\. /)) {
                const items = block.split("\n").filter(Boolean);
                return (
                  <ol key={i} className="space-y-2 my-4">
                    {items.map((item, j) => (
                      <li key={j} className="text-gray-700 text-sm flex gap-3">
                        <span className="text-[#9A8A2E] font-bold shrink-0">{j + 1}.</span>
                        <span>{item.replace(/^\d+\.\s*/, "")}</span>
                      </li>
                    ))}
                  </ol>
                );
              }
              if (block.startsWith("- ")) {
                const items = block.split("\n").filter(Boolean);
                return (
                  <ul key={i} className="space-y-2 my-4 border-l-2 border-gray-100 pl-4">
                    {items.map((item, j) => (
                      <li key={j} className="text-gray-700 text-sm">{item.replace(/^-\s*/, "")}</li>
                    ))}
                  </ul>
                );
              }
              return <p key={i} className="text-gray-700 text-sm leading-relaxed">{block}</p>;
            })}
          </article>

          {/* 태그 */}
          {post.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-sm border border-gray-200 bg-[#F7F6F3] px-2.5 py-1 text-xs font-semibold text-gray-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 업체 소개 / 업장 정보 — 홈페이지 정보와 연동 */}
          <section className="mt-12 border-2 border-[#16181D] bg-white">
            <div className="border-b-2 border-[#16181D] bg-[#16181D] px-5 py-3">
              <p className="font-mono-pd text-[11px] font-bold uppercase tracking-[0.16em] text-[#FFD400]">About</p>
              <p className="mt-0.5 text-base font-black text-white">{ui.blogPost.aboutHeading}</p>
            </div>
            <div className="px-5 py-6">
              <p className="text-[14px] leading-[1.8] text-[#3A4048]">{company.geoSummary}</p>
              <dl className="mt-5 grid grid-cols-2 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-4">
                <div className="bg-white px-3 py-3">
                  <dt className="font-mono-pd text-[10px] font-bold uppercase tracking-[0.1em] text-[#9A8A2E]">{ui.blogPost.specialtyLabel}</dt>
                  <dd className="mt-1 text-[13px] font-extrabold text-[#16181D]">{company.speciality}</dd>
                </div>
                <div className="bg-white px-3 py-3">
                  <dt className="font-mono-pd text-[10px] font-bold uppercase tracking-[0.1em] text-[#9A8A2E]">{ui.blogPost.experienceLabel}</dt>
                  <dd className="mt-1 text-[13px] font-extrabold text-[#16181D]">{company.experience}</dd>
                </div>
                <div className="bg-white px-3 py-3">
                  <dt className="font-mono-pd text-[10px] font-bold uppercase tracking-[0.1em] text-[#9A8A2E]">{ui.blogPost.regionLabel}</dt>
                  <dd className="mt-1 text-[13px] font-extrabold text-[#16181D]">{company.region}</dd>
                </div>
                <div className="bg-white px-3 py-3">
                  <dt className="font-mono-pd text-[10px] font-bold uppercase tracking-[0.1em] text-[#9A8A2E]">{ui.blogPost.billingLabel}</dt>
                  <dd className="mt-1 text-[13px] font-extrabold text-[#16181D]">{ui.blogPost.billingValue}</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <a
                  href={company.kakaoUrl}
                  target="_blank"
                  rel="noopener"
                  aria-label="카카오톡으로 사진 보내고 빠른 견적 받기"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm bg-[#FFD400] px-5 py-3 text-[14px] font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D]"
                >
                  <KakaoIcon className="h-[16px] w-[16px]" />
                  카톡으로 사진 보내기
                </a>
                <a
                  href={company.phoneLink}
                  aria-label={`전화로 바로 상담 ${company.phone}`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm border-2 border-[#16181D] px-5 py-3 text-[14px] font-extrabold text-[#16181D] transition-colors hover:bg-[#16181D] hover:text-white"
                >
                  <PhoneIcon className="h-[16px] w-[16px]" />
                  {company.phone}
                </a>
              </div>
            </div>
          </section>

          {/* 관련 글 — 내부 링크 */}
          {relatedPosts.length > 0 && (
            <section className="mt-12">
              <p className="mb-4 font-mono-pd text-xs font-bold uppercase tracking-[0.16em] text-[#9A8A2E]">{ui.blogPost.relatedLabel}</p>
              <div className="divide-y divide-gray-100 border-t border-gray-200">
                {relatedPosts.map((p) => (
                  <Link key={p.id} href={`/blog/${p.id}`} className="group flex items-start gap-3 py-4">
                    <span className="font-mono-pd text-[11px] font-bold uppercase text-[#9A8A2E] shrink-0 pt-0.5 w-14">{p.category}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-bold text-[#16181D] group-hover:text-[#9A8A2E] transition-colors leading-snug">{p.title}</span>
                      <span className="mt-1 block text-[13px] text-gray-500 line-clamp-1">{p.excerpt}</span>
                    </span>
                    <span aria-hidden className="font-mono-pd text-gray-300 group-hover:text-[#9A8A2E] transition-colors">→</span>
                  </Link>
                ))}
              </div>
              <div className="mt-5">
                <Link href="/blog" className="inline-flex items-center gap-2 text-[14px] font-extrabold text-[#16181D] hover:text-[#9A8A2E] transition-colors">
                  정보 글 전체 보기 <span aria-hidden className="font-mono-pd">→</span>
                </Link>
              </div>
            </section>
          )}
        </div>
      </section>

      {/* 상담 CTA — 홈/전 페이지와 동일한 연락 채널 */}
      <CtaBand heading="바닥재 철거, 사진 한 장이면 견적 상담 시작" />
    </div>
  );
}
