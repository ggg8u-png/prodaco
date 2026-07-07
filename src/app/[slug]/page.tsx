import type { Metadata } from "next";
import Link from "next/link";
import { Phone, MessageCircle } from "lucide-react";
import { getKeywords, getKeywordBySlug, indexDecisionFor } from "@/data/keywords";
import { getContentForKeyword, getRelatedKeywords } from "@/lib/content";
import { company } from "@/data/company";
import { galleryItems, worksitePhotos } from "@/data/gallery";
import { reviews } from "@/data/reviews";
import { FLOOR_COSTS, costKeyOf, perPyeongText } from "@/data/costs";
import { itemFactsFor, FLOOR_COMPARE, compareKeyOf } from "@/data/itemFacts";
import { neighborsOf, clusterLabelOf } from "@/data/regions";
import { pickFaqs, uniqueDescription, uniqueTitle } from "@/lib/seo";
import { relatedGuidesFor } from "@/lib/relatedGuides";
import { keyAnswerFor, normalizeKeyAnswer } from "@/data/keyAnswer";
import { comboProfileFor } from "@/data/comboProfiles";
import { applyReplacements } from "@/lib/replacements";
import GalleryImage from "@/components/GalleryImage";
import KeyAnswer from "@/components/KeyAnswer";
import { notFound } from "next/navigation";

// 슬러그 시드 — 같은 슬러그는 항상 같은 결과(빌드 안정), 인접 슬러그는 다르게.
function slugSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// 배열에서 시드 시작점부터 n개를 순환 선택 — 페이지마다 다른 실사진/후기 조합.
function rotatePick<T>(arr: T[], seed: number, n: number): T[] {
  if (arr.length <= n) return arr;
  const start = seed % arr.length;
  return Array.from({ length: n }, (_, i) => arr[(start + i) % arr.length]);
}

export async function generateStaticParams() {
  const keywords = getKeywords();
  return keywords.map((k) => ({ slug: k.slug }));
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  // 한글 슬러그는 런타임에 퍼센트 인코딩(%EA%B0%95…)되어 들어오므로 디코딩 후 조회한다.
  const slug = decodeURIComponent(rawSlug);
  const keyword = getKeywordBySlug(slug);
  if (!keyword) return {};
  // 페이지마다 다른 고유 description(품목·지역·실제 비용·권역 반영) — 중복 description 방지.
  const desc = uniqueDescription(keyword, company.phone);
  const title = uniqueTitle(keyword);
  // 색인 게이트: 큐레이션 라이브는 index(동의어 꼬리말은 대표 변형으로 canonical 통합),
  // GENERATE_COUNT 로 자동 추가된 staging 페이지는 noindex,follow + 상위 지역+품목으로
  // canonical → 도어웨이/중복 색인 방지.
  const decision = indexDecisionFor(keyword);
  // 사이트맵은 slug 를 encodeURIComponent 로 인코딩해 제출한다(sitemap.ts).
  // canonical/og:url 도 동일하게 퍼센트 인코딩해, 한글 슬러그의 raw(가) vs
  // 인코딩(%EA%B0%95) 표기가 달라 구글이 서로 다른 URL로 오인하는 여지를 없앤다.
  const canonicalUrl = `${siteUrl}/${encodeURIComponent(decision.canonicalSlug)}`;
  return {
    title,
    description: desc,
    alternates: { canonical: canonicalUrl },
    robots: decision.index ? undefined : { index: false, follow: true },
    openGraph: {
      title: applyReplacements(`${keyword.keyword} | 프로다`),
      description: desc,
      type: "website",
      url: canonicalUrl,
      images: ["/opengraph-image"],
    },
    other: keyword.region
      ? { "geo.region": "KR", "geo.placename": keyword.region }
      : { "geo.region": "KR", "geo.placename": "서울·경기·인천" },
  };
}

export default async function KeywordPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  // 한글 슬러그 디코딩 (퍼센트 인코딩으로 들어옴) — 미디코딩 시 전부 404 발생
  const slug = decodeURIComponent(rawSlug);
  const keyword = getKeywordBySlug(slug);
  if (!keyword) notFound();

  const allKeywords = getKeywords();
  // 페이지 자기 URL — canonical/사이트맵과 동일한 퍼센트 인코딩 형태로 통일해
  // JSON-LD(브레드크럼·Service)와 canonical 이 서로 다른 URL 표기를 내보내지 않게 한다.
  const pageUrl = `${siteUrl}/${encodeURIComponent(slug)}`;
  const content = getContentForKeyword(keyword);
  // 품목(바닥재)별 실제 기술 정보 — 품목마다 내용이 달라 페이지 고유성을 높인다.
  const itemFacts = itemFactsFor(keyword.item);
  const itemFactRows: [string, string][] = [
    ["포함 범위", itemFacts.scope],
    ["시공·부착 방식", itemFacts.attach],
    ["철거 특징", itemFacts.removal],
    ["발생 폐기물", itemFacts.debris],
    ["하지·현장 주의", itemFacts.caution],
    ["마무리 포인트", itemFacts.aftercare],
  ];
  // 전역 문구 치환/삭제(어드민 ⑫) — 화면에 보이는 키워드 텍스트에도 적용(슬러그/URL은 불변).
  const kw = applyReplacements(keyword.keyword);
  const kwTail = keyword.tail ? applyReplacements(keyword.tail) : keyword.tail;
  const related = getRelatedKeywords(keyword, allKeywords, 10);
  // 품목·꼬리말에 맞는 심층 가이드(블로그) 링크 — 프로그래매틱↔필러 사일로 연결.
  const guides = relatedGuidesFor(keyword, 3);
  // GEO/AEO 핵심 답변(질문형) — H1 아래 노출 + FAQ 스키마 맨 앞에 대표 질문으로 병합.
  const keyAnswer = normalizeKeyAnswer(keyAnswerFor(keyword));
  // 지역×품목 결합 프로파일 — near-duplicate 완화(지역 현장특성 + 품목 난이도/샌딩·본드/
  // 사진견적/다음공정을 슬러그 시드로 조합해 형제 페이지끼리도 문단이 달라진다).
  const combo = comboProfileFor(keyword);
  // 페이지별 관련성 높은 FAQ — 모디파이어 적합 + 시드 변형(전 페이지 동일 FAQ 제거).
  const faqSubset = pickFaqs(keyword, 8);
  // 바닥재별 철거 특성 비교(현재 품목 강조) — 페이지 정보가치·고유성 강화.
  const compareKey = compareKeyOf(keyword.item);

  // 인근 지역(같은 품목) 실링크 — 로컬 사일로. 실제 존재하는 페이지만 링크.
  const neighborLinks = keyword.region && keyword.item
    ? neighborsOf(keyword.region, 6)
        .map((nb) => getKeywordBySlug(`${nb}-${keyword.item}`))
        .filter((k): k is NonNullable<typeof k> => Boolean(k))
    : [];
  const clusterLabel = clusterLabelOf(keyword.region);

  // ── 실데이터 섹션(페이지별 고유 콘텐츠) ──────────────────────────────────────
  const seed = slugSeed(slug);
  // 1) 실제 비포/애프터 시공 사례 — 같은 지역 사례가 있으면 우선 노출(로컬 실증),
  //    없으면 전체 풀에서 슬러그 시드로 2건 선택(페이지마다 다른 조합).
  const regionCases = keyword.region ? galleryItems.filter((c) => c.region === keyword.region) : [];
  const casePool = regionCases.length >= 2 ? regionCases : galleryItems;
  // 시공사례는 수도권 전역 공통(대표) 실적 — 모든 페이지에 공통 노출(3세트).
  const cases = rotatePick(casePool, seed, 3);
  // 1-b) 작업 현장(시공중) 실사진 — 슬러그 시드로 3장 회전(페이지마다 다른 조합).
  //      (XOR 결과는 부호가 생길 수 있어 >>> 0 로 부호 없는 정수로 만든다 — 음수 인덱스 방지)
  const sitePhotos = rotatePick(worksitePhotos, (seed ^ 0x2f) >>> 0, 6);
  // 2) 품목별 실제 비용 참고표 — 현재 품목 행을 강조.
  const costKey = costKeyOf(keyword.item);
  // 3) 실제 고객 후기 — 같은 품목 후기를 우선, 부족하면 시드로 채움.
  const itemReviews = keyword.item
    ? reviews.filter((r) => r.item && keyword.item && r.item.includes(keyword.item.replace(/철거|제거|샌딩|뜯기|걷어내기/g, "").trim()))
    : [];
  // 같은 지역+품목 후기가 충분하면 우선, 없으면 품목 후기, 그래도 부족하면 전체.
  const regionItemReviews = keyword.region ? itemReviews.filter((r) => r.region === keyword.region) : [];
  const reviewPool = regionItemReviews.length >= 2 ? regionItemReviews : itemReviews.length >= 2 ? itemReviews : reviews;
  const pageReviews = rotatePick(reviewPool, seed, 2);

  // region-item 계열은 지역 허브(/services/{region})를 중간 단계로 끼워 사일로를 완성한다.
  // 허브 존재 조건은 허브의 generateStaticParams(해당 지역에 region-item 존재)와 일치시킨다.
  const regionHasHub = keyword.region
    ? allKeywords.some((k) => k.type === "region-item" && k.region === keyword.region)
    : false;
  const regionHub = regionHasHub
    ? { name: `${keyword.region} 바닥재 철거`, url: `${siteUrl}/services/${encodeURIComponent(keyword.region!)}` }
    : null;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "서비스 안내", item: `${siteUrl}/services` },
      ...(regionHub ? [{ "@type": "ListItem", position: 3, name: regionHub.name, item: regionHub.url }] : []),
      { "@type": "ListItem", position: regionHub ? 4 : 3, name: kw, item: pageUrl },
    ],
  };

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: kw,
    description: applyReplacements(`${keyword.keyword} 전문 서비스. ${keyword.region ? keyword.region + " 지역 " : ""}수도권 바닥재 철거 전문 업체.`),
    serviceType: keyword.item || "바닥재 철거",
    areaServed: keyword.region
      ? { "@type": "City", name: keyword.region }
      : { "@type": "AdministrativeArea", name: "서울·경기·인천 수도권" },
    provider: { "@type": "LocalBusiness", "@id": `${siteUrl}/#business` },
    url: pageUrl,
  };

  // Service.provider 가 참조하는 실제 LocalBusiness 노드(실 NAP·권역) — 로컬 신호 강화.
  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#business`,
    name: company.brandName,
    description: company.geoSummary,
    telephone: company.phone,
    url: siteUrl,
    image: `${siteUrl}/opengraph-image`,
    // 실제 비용표(FLOOR_COSTS) 범위 기반 — 일반 참고가, 실측 정산.
    priceRange: "평당 1만~8만원대 (바닥재·면적별, 실측 정산)",
    areaServed: [
      ...(keyword.region ? [{ "@type": "City", name: keyword.region }] : []),
      { "@type": "AdministrativeArea", name: "서울특별시" },
      { "@type": "AdministrativeArea", name: "경기도" },
      { "@type": "AdministrativeArea", name: "인천광역시" },
    ],
    knowsAbout: company.services.map((s) => s.name),
    address: { "@type": "PostalAddress", addressRegion: "수도권", addressCountry: "KR" },
  };

  // 핵심 답변(가시 텍스트와 동일)을 FAQ 스키마 맨 앞 대표 질문으로 병합.
  // 중복 방지: 같은 질문이 faqSubset 에 없을 때만 추가한다.
  const faqEntities = [
    { "@type": "Question", name: keyAnswer.question, acceptedAnswer: { "@type": "Answer", text: keyAnswer.answer } },
    ...faqSubset
      .filter((f) => f.question !== keyAnswer.question)
      .map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntities,
  };

  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-3xl mx-auto">
          <nav className="text-gray-500 text-xs mb-5 flex items-center gap-2 flex-wrap">
            <Link href="/" className="hover:text-gray-300">홈</Link>
            <span>›</span>
            <Link href="/services" className="hover:text-gray-300">서비스 안내</Link>
            <span>›</span>
            {regionHub && (
              <>
                <Link href={`/services/${encodeURIComponent(keyword.region!)}`} className="hover:text-gray-300">{keyword.region}</Link>
                <span>›</span>
              </>
            )}
            <span className="text-gray-400">{kw}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{kw}</h1>
          {kwTail && (
            <p className="font-mono-pd text-[#FFD400] text-sm font-bold mb-3">{kwTail}</p>
          )}
          <p className="text-gray-400 text-sm mb-8 max-w-lg leading-relaxed">
            {keyword.region ? `${keyword.region} ` : ""}수도권 전문 업체. 10년 경력, 투명 실측 정산, 당일 상담 가능.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={company.phoneLink} className="inline-flex items-center gap-2 rounded-sm bg-[#FFD400] text-[#16181D] font-bold px-6 py-3 text-sm hover:bg-[#FFE34D] transition-colors">
              <Phone size={16} /> {company.phone}
            </a>
            <a href={company.kakaoUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-sm border-2 border-white/30 text-white font-bold px-6 py-3 text-sm hover:border-[#FFD400] hover:text-[#FFD400] transition-colors">
              <MessageCircle size={16} /> 카카오톡 상담
            </a>
          </div>
        </div>
      </section>

      {/* GEO/AEO 빠른 답변 — H1 바로 아래, 질문형 + 40~80자 핵심 답변 + 보충 + CTA(인용 최적화) */}
      <KeyAnswer {...keyAnswer} />

      {/* 지역×품목 맞춤 안내 — 지역 현장특성 + 품목 난이도·샌딩/본드·사진견적·다음공정.
          지역/품목 조합마다 다른 문단으로 near-duplicate 위험을 낮춘다(자연어, 키워드 반복 최소화). */}
      <section className="py-10 px-5 bg-[#F7F6F3] border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
            {kw} 이렇게 봅니다
          </p>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            {keyword.region && keyword.region !== "수도권" ? `${keyword.region} ` : ""}현장 특성과 이 품목의 작업 포인트를 정리했습니다. 아래 내용을 참고해 사진과 함께 문의하시면 상담이 빨라집니다.
          </p>
          <dl className="space-y-px border border-gray-200 bg-gray-200">
            {([
              ["지역 현장 특성", combo.regionLine],
              ["품목 작업 난이도", combo.difficulty],
              ["샌딩·본드 제거 필요성", combo.sandingBond],
              ["사진 견적 시 알려주실 정보", combo.photoInfo],
              ["다음 공정 전 확인할 점", combo.nextProcess],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-3.5">
                <dt className="font-mono-pd text-[10px] font-bold uppercase tracking-[0.1em] text-[#9A8A2E]">{label}</dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-[#3A4048]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 품목 철거 포인트 — 바닥재별 실제 기술 정보(품목마다 다름) */}
      <section className="py-10 px-5 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{kw} 포인트 한눈에</p>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            {applyReplacements(`${keyword.item || "바닥재"}는 부착 방식에 따라 철거 방법이 달라집니다. 아래는 이 바닥재의 실제 시공·철거 특성입니다.`)}
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-px border border-gray-200 bg-gray-200">
            {itemFactRows.map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-3.5">
                <dt className="font-mono-pd text-[10px] font-bold uppercase tracking-[0.1em] text-[#9A8A2E]">{label}</dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-[#3A4048]">{applyReplacements(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="py-12 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-4">
            {content.split("\n\n").map((paragraph, i) => {
              if (paragraph.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-lg font-black mt-10 mb-3 pt-6 border-t border-gray-100">
                    {paragraph.slice(3)}
                  </h2>
                );
              }
              if (paragraph.match(/^[1-9]\. /)) {
                const items = paragraph.split("\n").filter(Boolean);
                return (
                  <ol key={i} className="space-y-2 my-4">
                    {items.map((item, j) => (
                      <li key={j} className="text-gray-700 text-sm flex gap-3">
                        <span className="text-[#9A8A2E] font-bold shrink-0">{j + 1}.</span>
                        <span>{item.replace(/^[\d]+\.\s*/, "")}</span>
                      </li>
                    ))}
                  </ol>
                );
              }
              if (paragraph.startsWith("- ")) {
                const items = paragraph.split("\n").filter(Boolean);
                return (
                  <ul key={i} className="space-y-2 my-4 border-l-2 border-gray-100 pl-4">
                    {items.map((item, j) => (
                      <li key={j} className="text-gray-700 text-sm">{item.replace(/^-\s*/, "")}</li>
                    ))}
                  </ul>
                );
              }
              return <p key={i} className="text-gray-700 text-sm leading-relaxed">{paragraph}</p>;
            })}
          </div>
        </div>
      </section>

      {cases.length > 0 && (
        <section className="py-10 px-5 bg-[#F7F6F3]">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">실제 시공 사례 · Before / After</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {cases.map((c) => (
                <div key={c.id} className="border border-gray-200">
                  <div className="grid grid-cols-2">
                    <GalleryImage src={c.beforeImage} alt={`${c.title} 철거 전`} label="BEFORE" className="aspect-square" />
                    <GalleryImage src={c.afterImage} alt={`${c.title} 작업 후`} label="AFTER" className="aspect-square" />
                  </div>
                  <div className="px-3 py-3">
                    <p className="text-sm font-bold text-[#16181D]">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.region} · {c.item}</p>
                    {c.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{c.description}</p>}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              {keyword.region ? `${keyword.region} 포함 ` : ""}수도권 전역에서 동일 팀·동일 품질로 진행한 실제 바닥재 철거·샌딩 시공 사례입니다. 더 많은 사례는{" "}
              <Link href="/gallery" className="text-[#9A8A2E] underline underline-offset-2">시공 갤러리</Link>에서 보실 수 있습니다.
            </p>
          </div>
        </section>
      )}

      {sitePhotos.length > 0 && (
        <section className="py-10 px-5 border-t border-gray-100">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">
              {applyReplacements(`작업 현장 · ${keyword.item || "바닥재 철거"} 시공중`)}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {sitePhotos.map((p) => (
                <GalleryImage
                  key={p.id}
                  src={p.src}
                  alt={`${keyword.region ? keyword.region + " " : ""}${keyword.item || "바닥재 철거"} 작업 현장 — 직접 시공`}
                  className="aspect-square"
                />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              저희가 직접 진행한 실제 작업 현장입니다. 철거 → 본드·잔여물 정리까지 한 팀이 끝까지 책임집니다.
            </p>
          </div>
        </section>
      )}

      <section className="py-10 px-5 bg-[#F7F6F3]">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">바닥재별 철거 특성 비교</p>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            바닥재는 종류에 따라 철거 난이도·소음·분진·폐기물이 다릅니다. 아래에서 {compareKey && <strong>현재 품목({keyword.item})</strong>}{!compareKey && "각 바닥재"}을(를) 다른 바닥재와 비교해 보세요. (실제 시공 특성 기준 상대 비교)
          </p>
          <div className="overflow-x-auto border border-gray-200 bg-white">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-[#16181D] text-white text-left">
                  <th className="px-3 py-2.5 font-semibold">바닥재</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">철거 난이도</th>
                  <th className="px-3 py-2.5 font-semibold">소음</th>
                  <th className="px-3 py-2.5 font-semibold">분진</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">작업 시간</th>
                  <th className="px-3 py-2.5 font-semibold">폐기물</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {FLOOR_COMPARE.map((row) => {
                  const active = !!compareKey && row.key === compareKey;
                  return (
                    <tr key={row.key} className={active ? "bg-[#FFF8D6]" : ""}>
                      <td className="px-3 py-2.5 font-medium text-[#16181D] whitespace-nowrap">
                        {row.label}{active && <span className="ml-1.5 text-[10px] font-bold text-[#9A8A2E]">← 현재</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.difficulty}</td>
                      <td className="px-3 py-2.5 text-gray-700">{row.noise}</td>
                      <td className="px-3 py-2.5 text-gray-700">{row.dust}</td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.time}</td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.waste}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-10 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">바닥재별 철거 비용 참고</p>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            아래는 2024년 일반 시장 평균 참고가입니다(보장가 아님). 폐자재 처리·출장비는 별도일 수 있으며,
            저희는 유선 가견적 후 <strong>실측 면적 기준으로 최종 정산</strong>합니다.
          </p>
          <div className="overflow-hidden border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#16181D] text-white text-left">
                  <th className="px-4 py-2.5 font-semibold">바닥재</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">평당 단가(참고)</th>
                  <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {FLOOR_COSTS.map((row) => {
                  const active = row.key === costKey;
                  return (
                    <tr key={row.key} className={active ? "bg-[#FFF8D6]" : ""}>
                      <td className="px-4 py-2.5 font-medium text-[#16181D]">
                        {row.label}{active && <span className="ml-1.5 text-[10px] font-bold text-[#9A8A2E]">← 현재 품목</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{perPyeongText(row)}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs hidden sm:table-cell">{row.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            정확한 비용은 현장 사진·평수·바닥재 종류를 보내주시면 유선으로 안내드립니다. ☎ {company.phone}
          </p>
        </div>
      </section>

      <section className="py-10 px-5 bg-[#F7F6F3]">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">저희 강점</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
            <div className="space-y-0 divide-y divide-gray-200">
              {company.strengths.slice(0, Math.ceil(company.strengths.length / 2)).map((s) => (
                <div key={s.label} className="py-4 pr-0 sm:pr-6">
                  <p className="font-bold text-sm text-[#16181D]">{s.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{s.description}</p>
                </div>
              ))}
            </div>
            <div className="space-y-0 divide-y divide-gray-200">
              {company.strengths.slice(Math.ceil(company.strengths.length / 2)).map((s) => (
                <div key={s.label} className="py-4 pl-0 sm:pl-6">
                  <p className="font-bold text-sm text-[#16181D]">{s.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">자주 묻는 질문</p>
          <div className="divide-y divide-gray-100">
            {faqSubset.map((faq) => (
              <details key={faq.id} className="group py-4">
                <summary className="font-semibold text-sm cursor-pointer list-none flex justify-between items-center gap-4">
                  {faq.question}
                  <span className="text-[#16181D] shrink-0 text-lg font-light group-open:rotate-45 transition-transform inline-block">+</span>
                </summary>
                <p className="text-gray-500 text-sm mt-3 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {pageReviews.length > 0 && (
        <section className="py-10 px-5 bg-[#F7F6F3]">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">고객 후기</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pageReviews.map((r) => (
                <figure key={r.id} className="bg-white border border-gray-200 p-4">
                  <div className="flex items-center gap-1 text-[#FFB300] text-sm mb-2" aria-label={`별점 ${r.rating}점`}>
                    {"★".repeat(Math.max(0, Math.min(5, r.rating)))}
                    <span className="text-gray-300">{"★".repeat(5 - Math.max(0, Math.min(5, r.rating)))}</span>
                  </div>
                  <blockquote className="text-sm text-gray-700 leading-relaxed line-clamp-5">{r.content}</blockquote>
                  <figcaption className="text-xs text-gray-500 mt-3">
                    {r.name} · {r.region} · {r.item}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              실제 작업 고객 후기입니다. 더 보기 →{" "}
              <Link href="/reviews" className="text-[#9A8A2E] underline underline-offset-2">후기 전체</Link>
            </p>
          </div>
        </section>
      )}

      {neighborLinks.length > 0 && (
        <section className="py-10 px-5">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{applyReplacements(`${clusterLabel} · 인근 지역 ${keyword.item}`)}</p>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              {keyword.region} 인근 {clusterLabel} 지역도 같은 팀이 방문 작업합니다. 가까운 지역 페이지에서 동일 서비스를 확인하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              {neighborLinks.map((k) => (
                <Link
                  key={k.slug}
                  href={`/${k.slug}`}
                  className="text-xs font-medium text-[#16181D] px-3 py-1.5 border border-gray-300 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
                >
                  {applyReplacements(k.keyword)}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {guides.length > 0 && (
        <section className="py-10 px-5">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">관련 전문 가이드</p>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              {applyReplacements(`${keyword.item || "바닥재 철거"}`)} 관련해 더 깊은 내용은 아래 가이드에서 확인하세요.
            </p>
            <div className="divide-y divide-gray-100 border-t border-gray-200">
              {guides.map((g) => (
                <Link key={g.id} href={`/blog/${g.id}`} className="group flex items-center justify-between gap-3 py-3.5">
                  <span className="text-sm font-semibold text-[#16181D] group-hover:text-[#9A8A2E] transition-colors">{g.title}</span>
                  <span aria-hidden className="text-gray-300 group-hover:text-[#9A8A2E] shrink-0 transition-colors">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="py-8 px-5 bg-[#F7F6F3]">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">관련 서비스</p>
            <div className="flex flex-wrap gap-2">
              {related.map((k) => (
                <Link
                  key={k.slug}
                  href={`/${k.slug}`}
                  className="text-xs text-gray-600 px-3 py-1.5 border border-gray-200 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
                >
                  {applyReplacements(k.keyword)}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-14 px-5 bg-[#16181D]">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-widest mb-2">견적 문의</p>
            <h2 className="text-xl md:text-2xl font-black text-white">{kw}<br />전화 한 통으로 바로 확인하세요</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <a href={company.phoneLink} className="inline-flex items-center gap-2 rounded-sm bg-[#FFD400] text-[#16181D] font-bold px-6 py-3 text-sm hover:bg-[#FFE34D] transition-colors">
              <Phone size={16} /> {company.phone}
            </a>
            <a href={company.kakaoUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-sm border-2 border-white/30 text-white font-bold px-6 py-3 text-sm hover:border-[#FFD400] hover:text-[#FFD400] transition-colors">
              <MessageCircle size={16} /> 카카오 상담
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
