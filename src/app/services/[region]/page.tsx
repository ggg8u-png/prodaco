import type { Metadata } from "next";
import Link from "next/link";
import { Phone, MessageCircle } from "lucide-react";
import { getKeywords, hubDecisionFor } from "@/data/keywords";
import { neighborsOf, clusterLabelOf } from "@/data/regions";
import { FLOOR_COSTS, perPyeongText } from "@/data/costs";
import { pickFaqs } from "@/lib/seo";
import { keyAnswerForRegion } from "@/data/keyAnswer";
import { applyReplacements } from "@/lib/replacements";
import { fillTemplate } from "@/lib/template";
import { company } from "@/data/company";
import { galleryItems } from "@/data/gallery";
import { reviews } from "@/data/reviews";
import GalleryImage from "@/components/GalleryImage";
import KeyAnswer from "@/components/KeyAnswer";
import WorkPhotos from "@/components/WorkPhotos";
import { notFound } from "next/navigation";
import { indexabilityFor } from "@/lib/seo/indexability";
import { itemAnchorFor } from "@/lib/itemGuides";
import { caseGroupLabelFor } from "@/lib/caseGroups";
import ui from "../../../../content/ui.json";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

// region-item 키워드가 존재하는 지역만 허브로 생성.
function regionsWithPages(): string[] {
  const set = new Set<string>();
  for (const k of getKeywords()) {
    if (k.type === "region-item" && k.region) set.add(k.region);
  }
  return [...set];
}

// ISR 캐시 — 지역 허브도 CDN 캐시(stale-while-revalidate)로 빠르게 제공(크롤 속도 개선).
// ([slug] 페이지와 동일한 이유. Cache-Control: max-age=0 → 콜드스타트 5초 응답 방지.)
export const revalidate = 86400;

export function generateStaticParams() {
  return regionsWithPages().map((region) => ({ region }));
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rotatePick<T>(arr: T[], seed: number, n: number): T[] {
  if (arr.length <= n) return arr;
  const start = seed % arr.length;
  return Array.from({ length: n }, (_, i) => arr[(start + i) % arr.length]);
}

// 허브 기본 화면에 노출할 핵심 품목(우선순위 순). 지역×품목 18개 전부를 키워드
// 목록처럼 나열하지 않는다 — 도어웨이 신호이자 noindex 페이지로의 링크 낭비.
const CORE_HUB_ITEMS = [
  "마루철거", "강마루철거", "데코타일철거", "장판철거",
  "타일철거", "바닥샌딩", "에폭시철거", "바닥재철거",
] as const;

// 허브 링크 영역: 핵심 품목 우선 정렬로 최대 8개.
//
// ⚠ 이전 구현은 Tier A(색인 대상)만 남기는 필터를 걸었다. 7/1 색인 티어링으로 지역×품목
// 대부분이 noindex 로 내려가면서, 허브 65개 중 21개가 품목 링크 0개 · 26개가 1개인
// "아무것도 허브하지 않는 허브"가 됐다(빌드 산출물 실측). 그 결과:
//   · 허브 → 하위 페이지 크롤 경로가 끊겼다.
//   · 허브끼리 본문이 64% 유사해졌다(링크 블록이 지역별 차이의 거의 유일한 원천이었다).
//   · 정작 허브는 강등된 바닥철거·바닥재철거 150여 개의 canonical 수렴 대상이다.
// noindex,follow 페이지는 색인 경쟁에서만 빠질 뿐 실제로 존재하는 서비스 페이지이고
// 링크는 그대로 전달한다. 그래서 Tier A 를 앞에 놓고, 남는 자리를 그 지역의 실제
// 품목 페이지로 채운다(개수 상한 8은 유지 — 18개 전량 나열은 도어웨이 신호).
function itemsForRegion(region: string) {
  const rank = (item: string) => {
    const i = (CORE_HUB_ITEMS as readonly string[]).indexOf(item);
    return i === -1 ? CORE_HUB_ITEMS.length : i;
  };
  const pool = getKeywords()
    .filter((k) => k.type === "region-item" && k.region === region && k.item)
    .sort((a, b) => rank(a.item as string) - rank(b.item as string));
  const tierA = pool.filter((k) => indexabilityFor(k).inSitemap);
  const rest = pool.filter((k) => !indexabilityFor(k).inSitemap);
  // 색인 대상 하위 페이지는 전부 링크한다 — 허브의 존재 이유가 하위 페이지를 모으는 것이고,
  // 여기서 잘리면 그 페이지들이 내부링크로 도달 불가능한 고아가 된다(실제로 48개가 그랬다).
  // 색인 대상이 아닌 나머지는 4개까지만 붙여 목록이 무한정 길어지지 않게 한다.
  return [...tierA, ...rest.slice(0, 4)];
}

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }): Promise<Metadata> {
  const { region: raw } = await params;
  const region = decodeURIComponent(raw);
  if (!regionsWithPages().includes(region)) return {};
  const cluster = clusterLabelOf(region);
  // 허브 24개가 지역명만 바뀐 동일 title·description 을 쓰고 있었다(길이 편차 1자).
  // 검색결과에서 서로 구분되지 않으므로, 그 지역 허브가 실제로 링크하는 품목을
  // 앞세운다 — 억지 수식어가 아니라 그 페이지에 실제로 있는 내용이다.
  const hubItems = itemsForRegion(region).map((k) => k.item as string).filter(Boolean);
  // 한글 SERP 는 30자 전후에서 잘린다. 핵심(지역+바닥재 철거)을 앞에 두고
  // 품목은 2개까지만 — 잘려도 무엇을 다루는 페이지인지 전달된다.
  const itemLead = hubItems.slice(0, 2).join("·");
  const desc = `${region} 바닥재 철거·바닥 샌딩 현장 방문 작업. ${
    itemLead ? `${itemLead} 등 ${hubItems.length}개 품목 안내와 ` : ""
  }평당 참고가(실측 정산), 자주 묻는 질문을 정리했습니다. ${cluster} 방문 ☎ ${company.phone}`;
  return {
    title: itemLead
      ? `${region} 바닥재 철거 | ${itemLead} 등 ${hubItems.length}개`
      : `${region} 바닥재 철거·바닥 샌딩`,
    description: desc,
    alternates: { canonical: `${siteUrl}/services/${encodeURIComponent(region)}` },
    // SUPPORT 허브는 noindex,follow — 색인 경쟁에서만 빠지고 링크는 그대로 전달한다.
    // self-canonical 은 유지한다(noindex + 타 URL canonical 조합은 canonical 대상까지
    // noindex 가 번질 수 있어 금지 — indexDecisionFor 불변식 ②와 같은 규칙).
    robots: hubDecisionFor(region).index
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title: `${region} 바닥재 철거 | 프로다`,
      description: desc,
      type: "website",
      url: `${siteUrl}/services/${encodeURIComponent(region)}`,
      // 이 허브 전용 OG 이미지. 한글 세그먼트가 이중 인코딩되지 않도록 직접 지정한다
      // (파일 규약에 맡기면 %25EC%25… 로 깨진 URL 이 나간다).
      images: [{ url: `${siteUrl}/services/${encodeURIComponent(region)}/opengraph-image`, width: 1200, height: 630, alt: `${region} 바닥재 철거 — 프로다` }],
    },
    other: { "geo.region": "KR", "geo.placename": region },
  };
}

export default async function RegionHub({ params }: { params: Promise<{ region: string }> }) {
  const { region: raw } = await params;
  const region = decodeURIComponent(raw);
  if (!regionsWithPages().includes(region)) notFound();

  const seed = seedOf(region);
  const items = itemsForRegion(region);
  const cluster = clusterLabelOf(region);
  // 인접 지역 링크는 '허브가 실제로 존재하는 지역'만(neighborsOf 는 인접 클러스터 데이터라
  // region-item 이 없는 지역(예: 평택)도 포함될 수 있어 그대로 링크하면 /services/평택 404 발생).
  const hubSet = new Set(regionsWithPages());
  const neighbors = neighborsOf(region, 10).filter((nb) => hubSet.has(nb)).slice(0, 6);
  // 이 지역 실제 사례가 충분하면 우선 노출, 아니면 수도권 유사 사례로 명시(지역 실적 오인 방지).
  const regionCases = galleryItems.filter((c) => c.region === region);
  const casesAreLocal = regionCases.length >= 2;
  // 권역 그룹 사례(강남·서초·송파 등) — 구 단정 없이 권역 사실 그대로 우선 노출.
  const groupLabel = caseGroupLabelFor(region);
  const groupCases = groupLabel ? galleryItems.filter((c) => c.region === groupLabel) : [];
  const casesAreGroup = !casesAreLocal && groupCases.length >= 1;
  const cases = rotatePick(casesAreLocal ? regionCases : casesAreGroup ? groupCases : galleryItems, seed, 3);
  const pageReviews = rotatePick(reviews, seed, 2);
  const reviewsAreLocal = pageReviews.every((r) => r.region === region);
  // FAQ — 이 허브가 실제로 링크하는 품목에서 뽑는다.
  //
  // 이전에는 전 허브가 item:"바닥재 철거" 하나로 pickFaqs 를 호출했다. 시드는 지역별로
  // 달랐지만 preferred 절반이 항상 같은 질문(f15·f20)으로 고정돼, 65개 허브에 동일한
  // 긴 FAQ 답변 블록이 깔렸다(전 허브 공통 문장 35% 분량의 최대 기여분).
  // 지금은 화면 상단 품목 링크(itemsForRegion)에서 품목을 회전 선택해 그 품목의 FAQ 를
  // 가져온다 — 문구를 새로 만들지 않고 기존 FAQ 풀에서 '그 페이지에 실제로 맞는' 것만 고른다.
  // SUPPORT 허브는 색인 대상이 아니므로 FAQ 를 줄여 공통 블록 자체를 더 뺀다.
  const hub = hubDecisionFor(region);
  // 그 지역의 B2B(인테리어 협력·하도급) 페이지 — 색인 대상만.
  // 1차 감사에서 Tier A 인데 /services 한 곳에서만 링크를 받던 11개 중 6개가 이 유형이었다
  // (성남·인천·부천·동탄 마루철거 하도급, 고양·성남 인테리어 철거 외주).
  // 문맥상 부모가 바로 그 지역 허브다 — 새 페이지를 만들지 않고 여기서 연결한다.
  const b2bLinks = getKeywords().filter(
    (k) => k.type === "b2b" && k.region === region && indexabilityFor(k).inSitemap
  );
  const faqItems = items.length > 0 ? rotatePick(items.map((k) => k.item as string), seed, 2) : ["바닥재 철거"];
  const faqCount = hub.tier === "INDEX" ? 4 : 2;
  const faqSubset = (() => {
    const picked: ReturnType<typeof pickFaqs> = [];
    const perItem = Math.max(1, Math.ceil(faqCount / faqItems.length));
    for (const item of faqItems) {
      for (const f of pickFaqs({ slug: `region-${region}-${item}`, keyword: `${region} ${item}`, type: "region-item", region, item }, perItem + 2)) {
        if (picked.length >= faqCount) break;
        if (!picked.some((p) => p.id === f.id)) picked.push(f);
      }
      if (picked.length >= faqCount) break;
    }
    return picked;
  })();
  // GEO/AEO 핵심 답변(지역 단위) — H1 아래 노출 + FAQ 스키마 맨 앞 대표 질문으로 병합.
  const keyAnswer = keyAnswerForRegion(region);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "서비스 안내", item: `${siteUrl}/services` },
      { "@type": "ListItem", position: 3, name: `${region} 바닥재 철거`, item: `${siteUrl}/services/${encodeURIComponent(region)}` },
    ],
  };
  // ⚠ 예전에는 이 자리에서 LocalBusiness 를 다시 정의했다. @id 는 루트 레이아웃과 같은
  // `${siteUrl}/#business` 인데 address 는 { addressRegion: region } 이었다 —
  // 즉 허브 65개가 같은 업체 엔티티를 각각 강남·수원·인천 주소로 재정의하고 있었다.
  // 실제 사업장은 파주 한 곳이고, 이 구조는 검색엔진에 '지역마다 지점이 있다'로 읽힌다
  // (로컬 스팸 신호). 업체 엔티티는 루트 레이아웃이 실제 NAP 로 한 번만 선언하고,
  // 이 페이지는 '그 업체가 이 지역에 서비스한다'는 관계만 Service 로 표현한다.
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${region} 바닥재 철거`,
    serviceType: "바닥재 철거",
    description: `${region} 지역 현장 방문 바닥재 철거·바닥 샌딩 서비스.`,
    areaServed: { "@type": "City", name: region },
    provider: { "@id": `${siteUrl}/#business` },
    url: `${siteUrl}/services/${encodeURIComponent(region)}`,
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: keyAnswer.question, acceptedAnswer: { "@type": "Answer", text: keyAnswer.answer } },
      ...faqSubset
        .filter((f) => f.question !== keyAnswer.question)
        .map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
    ],
  };

  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-3xl mx-auto">
          <nav className="text-gray-500 text-xs mb-5 flex items-center gap-2 flex-wrap">
            <Link href="/" className="hover:text-gray-300">홈</Link>
            <span>›</span>
            <Link href="/services" className="hover:text-gray-300">서비스 안내</Link>
            <span>›</span>
            <span className="text-gray-400">{region}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{region} 바닥재 철거</h1>
          <p className="text-gray-400 text-sm mb-8 max-w-lg leading-relaxed">
            {/* fillTemplate: "{region}을(를)" 같은 조사 병기 표기를 받침에 맞는 조사로 교정한다
                ("판교을(를)" 노출 버그 수정 — 판교를 / 성남을). */}
            {fillTemplate(ui.regionPage.introTemplate, {
              region,
              cluster,
              experience: company.experience,
            })}
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={company.phoneLink} className="inline-flex items-center gap-2 rounded-sm bg-[#FFD400] text-[#16181D] font-bold px-6 py-3 text-sm hover:bg-[#FFE34D] transition-colors">
              <Phone size={16} /> {company.phone}
            </a>
            <a href={company.kakaoUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-sm border-2 border-white/30 text-white font-bold px-6 py-3 text-sm hover:border-[#FFD400] hover:text-[#FFD400] transition-colors">
              <MessageCircle size={16} /> {ui.header.kakaoCta}
            </a>
          </div>
        </div>
      </section>

      {/* GEO/AEO 빠른 답변 — H1 바로 아래(지역 단위), 질문형 + 핵심 답변 + 보충 + CTA */}
      <KeyAnswer {...keyAnswer} />

      <section className="py-12 px-5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">{ui.regionPage.capabilitiesLabel.replace("{region}", region)}</h2>
          <div className="flex flex-wrap gap-2">
            {items.map((k) => (
              <Link
                key={k.slug}
                href={`/${k.slug}`}
                className="text-sm font-medium text-[#16181D] px-3.5 py-2 border border-gray-300 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
              >
                {applyReplacements(itemAnchorFor(k.item))}
              </Link>
            ))}
            {/* 나머지 품목은 서비스 디렉터리로 — 키워드 나열 대신 허브→허브 링크로 정리 */}
            <Link
              href="/services"
              className="text-sm font-medium text-gray-500 px-3.5 py-2 border border-dashed border-gray-300 hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
            >
              전체 서비스 보기 →
            </Link>
          </div>
        </div>
      </section>

      <section className="py-10 px-5 bg-[#F7F6F3]">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{ui.regionPage.pricingLabel.replace("{region}", region)}</p>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            {ui.regionPage.pricingDisclaimer}<strong>{ui.regionPage.pricingDisclaimerStrong}</strong>{ui.regionPage.pricingDisclaimerSuffix}
          </p>
          <div className="overflow-hidden border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#16181D] text-white text-left">
                  <th className="px-4 py-2.5 font-semibold">{ui.regionPage.tableHeaders.material}</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">{ui.regionPage.tableHeaders.price}</th>
                  <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">{ui.regionPage.tableHeaders.note}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {FLOOR_COSTS.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-2.5 font-medium text-[#16181D]">{row.label}</td>
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{perPyeongText(row)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs hidden sm:table-cell">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {cases.length > 0 && (
        <section className="py-10 px-5">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">
              {casesAreLocal
                ? `${region} ${ui.regionPage.casesLabel}`
                : casesAreGroup
                  ? `${groupLabel} 시공사례 · Before / After`
                  : `수도권 유사 시공 사례 · Before / After`}
            </p>
            {!casesAreLocal && (
              <p className="text-xs text-gray-400 -mt-3 mb-5 leading-relaxed">
                {casesAreGroup
                  ? `${groupLabel} 권역에서 저희 팀이 진행한 시공사례입니다(카드 표기 = 작업 권역 기준). ${region} 방문 상담이 가능합니다.`
                  : `아래는 ${region} 현장이 아닌 수도권에서 진행한 유사 바닥재 시공 사례입니다(카드에 실제 작업 지역 표기). 같은 팀·같은 방식으로 작업하며, ${region} 방문 상담이 가능합니다.`}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {cases.map((c) => (
                <div key={c.id} className="border border-gray-200">
                  <div className="grid grid-cols-2">
                    <GalleryImage src={c.beforeImage} alt={`${c.title} 철거 전`} label={ui.regionPage.beforeLabel} className="aspect-square" />
                    <GalleryImage src={c.afterImage} alt={`${c.title} 작업 후`} label={ui.regionPage.afterLabel} className="aspect-square" />
                  </div>
                  <div className="px-3 py-3">
                    <p className="text-sm font-bold text-[#16181D]">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.region} · {c.item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 작업 현장 사진 — 지역과 무관한 참고 사진(중립 제목 + 오인 방지 고지는 컴포넌트 담당) */}
      <WorkPhotos routeKey={`services/${region}`} count={6} region={region} />

      {pageReviews.length > 0 && (
        <section className="py-10 px-5 bg-[#F7F6F3]">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">
              {reviewsAreLocal ? ui.regionPage.reviewsLabel : `${ui.regionPage.reviewsLabel} · 수도권 유사 작업`}
            </p>
            {!reviewsAreLocal && (
              <p className="text-xs text-gray-400 -mt-3 mb-5 leading-relaxed">
                같은 품목의 수도권 실제 작업 후기입니다(표기 지역 = 실제 작업 지역).
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pageReviews.map((r) => (
                <figure key={r.id} className="bg-white border border-gray-200 p-4">
                  <div className="flex items-center gap-1 text-[#FFB300] text-sm mb-2" aria-label={`별점 ${r.rating}점`}>
                    {"★".repeat(Math.max(0, Math.min(5, r.rating)))}
                    <span className="text-gray-300">{"★".repeat(5 - Math.max(0, Math.min(5, r.rating)))}</span>
                  </div>
                  <blockquote className="text-sm text-gray-700 leading-relaxed line-clamp-5">{r.content}</blockquote>
                  <figcaption className="text-xs text-gray-500 mt-3">{r.name} · {r.region} · {r.item}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-10 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">{ui.regionPage.faqLabel}</p>
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

      {b2bLinks.length > 0 && (
        <section className="py-10 px-5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{region} 인테리어·시공팀 협력</h2>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              {region} 인테리어 업체·시공팀의 바닥 철거 외주와 하도급을 진행합니다. 세금계산서 발행, 다수 현장, 촉박한 공정 일정에 맞춰 협력합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              {b2bLinks.map((k) => (
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

      {neighbors.length > 0 && (
        <section className="py-10 px-5 bg-[#F7F6F3]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{ui.regionPage.neighborhoodLabel.replace("{cluster}", cluster)}</h2>
            <div className="flex flex-wrap gap-2">
              {neighbors.map((nb) => (
                <Link
                  key={nb}
                  href={`/services/${encodeURIComponent(nb)}`}
                  className="text-xs font-medium text-[#16181D] px-3 py-1.5 border border-gray-300 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
                >
                  {nb} 바닥재 철거
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-14 px-5 bg-[#16181D]">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-mono-pd text-[#FFD400] text-xs font-bold uppercase tracking-widest mb-2">{ui.regionPage.ctaBadge}</p>
            <h2 className="text-xl md:text-2xl font-black text-white">{ui.regionPage.ctaHeading.replace("{region}", region)}<br />{ui.regionPage.ctaHeadingLine2}</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <a href={company.phoneLink} className="inline-flex items-center gap-2 rounded-sm bg-[#FFD400] text-[#16181D] font-bold px-6 py-3 text-sm hover:bg-[#FFE34D] transition-colors">
              <Phone size={16} /> {company.phone}
            </a>
            <a href={company.kakaoUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-sm border-2 border-white/30 text-white font-bold px-6 py-3 text-sm hover:border-[#FFD400] hover:text-[#FFD400] transition-colors">
              <MessageCircle size={16} /> {ui.regionPage.kakaoCta}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
