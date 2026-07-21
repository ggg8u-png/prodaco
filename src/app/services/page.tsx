import type { Metadata } from "next";
import Link from "next/link";
import { getKeywords } from "@/data/keywords";
import { CLUSTERS } from "@/data/regions";
import { company } from "@/data/company";
import { applyReplacements } from "@/lib/replacements";
import { keyAnswerForServices } from "@/data/keyAnswer";
import KeyAnswer from "@/components/KeyAnswer";
import ui from "../../../content/ui.json";

export const metadata: Metadata = {
  title: "지역·품목별 바닥재 철거 서비스 안내",
  description:
    "서울·경기·인천 수도권 지역별, 바닥재 품목별 철거·샌딩 서비스 전체 안내. 강마루·데코타일·장판·타일 철거와 비용·견적 페이지를 한눈에. 10년 전문 업체.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr"}/services` },
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prodaco.kr";

export default function ServicesDirectory() {
  const keywords = getKeywords();

  // 지역×품목 — 권역(cluster) → 지역 → 항목 으로 묶는다.
  const byRegion = new Map<string, typeof keywords>();
  for (const k of keywords) {
    if (k.type !== "region-item" || !k.region) continue;
    if (!byRegion.has(k.region)) byRegion.set(k.region, []);
    byRegion.get(k.region)!.push(k);
  }
  // 권역 순서대로 지역 정렬(데이터에 있는 지역만).
  const clusterSections = CLUSTERS.map((c) => ({
    label: c.label,
    regions: c.members.filter((m) => byRegion.has(m)),
  })).filter((s) => s.regions.length > 0);
  // 권역에 안 잡힌 넓은 지역(서울/경기/인천/수도권 등)
  const placed = new Set(clusterSections.flatMap((s) => s.regions));
  const broadRegions = [...byRegion.keys()].filter((r) => !placed.has(r));

  // 품목×꼬리어 — 품목 → 항목.
  const byItem = new Map<string, typeof keywords>();
  for (const k of keywords) {
    if (k.type !== "item-tail" || !k.item) continue;
    if (!byItem.has(k.item)) byItem.set(k.item, []);
    byItem.get(k.item)!.push(k);
  }

  // 나머지 유형(b2b·consumer·synonym·target)도 디렉터리에서 계층적으로 링크해
  // 내부링크 고립(orphan)을 없앤다 — 이 페이지는 홈에서 1클릭이므로 모든 항목이 2클릭 이내.
  // B2B(협력·하도급)는 지역이 있는 항목을 지역별로 묶어 계층화한다.
  // 지역 허브가 실제로 존재하는 지역(region-item 보유) — /services/{region} 링크는 이 집합에 한함.
  const hubRegionSet = new Set(byRegion.keys());
  const b2bByRegion = new Map<string, typeof keywords>();
  const b2bGeneral: typeof keywords = [];
  for (const k of keywords) {
    if (k.type !== "b2b") continue;
    if (k.region) {
      if (!b2bByRegion.has(k.region)) b2bByRegion.set(k.region, []);
      b2bByRegion.get(k.region)!.push(k);
    } else {
      b2bGeneral.push(k);
    }
  }
  // 바닥재 용어·직접 시공(consumer·synonym) / 공간·상황별(target).
  const termKeywords = keywords.filter((k) => k.type === "consumer" || k.type === "synonym");
  const targetKeywords = keywords.filter((k) => k.type === "target");

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "서비스 안내", item: `${siteUrl}/services` },
    ],
  };

  // 링크 집중 완화(크롤 우선순위 신호):
  //  · 광역(서울·경기·인천·수도권)은 최상위 수요라 품목 칩까지 그대로 노출(Tier 1 직링크).
  //  · 세부 지역 61곳은 '지역 허브 링크만' 노출 — 품목별 상세는 각 지역 허브(/services/{지역})가
  //    전부 링크하므로 고아 페이지가 생기지 않고, 홈→서비스→지역허브→상세 3클릭을 유지한다.
  //  (이전엔 이 페이지 한 곳에 콤보 1,170개 링크가 몰려 링크 목록 페이지처럼 보였다: 총 1,652 링크)
  const RegionList = ({ regions, withItems = false }: { regions: string[]; withItems?: boolean }) =>
    withItems ? (
      <div className="space-y-6">
        {regions.map((region) => (
          <div key={region} id={`region-${region}`}>
            <h3 className="mb-2 text-sm font-black">
              <Link href={`/services/${encodeURIComponent(region)}`} className="text-[#16181D] hover:text-[#9A8A2E] hover:underline underline-offset-2">
                {region} 바닥재 철거 →
              </Link>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {byRegion.get(region)!.map((k) => (
                <Link
                  key={k.slug}
                  href={`/${k.slug}`}
                  className="text-xs text-gray-600 px-2.5 py-1 border border-gray-200 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
                >
                  {k.item}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {regions.map((region) => (
          <Link
            key={region}
            id={`region-${region}`}
            href={`/services/${encodeURIComponent(region)}`}
            className="text-xs font-bold text-gray-700 px-3 py-1.5 border border-gray-200 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
          >
            {region} 바닥재 철거
          </Link>
        ))}
      </div>
    );

  return (
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className="bg-[#16181D] text-white pt-14 pb-12 px-5">
        <div className="max-w-4xl mx-auto">
          <nav className="text-gray-500 text-xs mb-5 flex items-center gap-2">
            <Link href="/" className="hover:text-gray-300">홈</Link>
            <span>›</span>
            <span className="text-gray-400">서비스 안내</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-black mb-3">{ui.servicesPage.h1}</h1>
          <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
            {ui.servicesPage.intro.replace("{experience}", company.experience)}
          </p>
        </div>
      </section>

      {/* GEO/AEO 빠른 답변 — 디렉터리 단위 대표 질문+답변 */}
      <KeyAnswer {...keyAnswerForServices()} />

      <section className="py-12 px-5">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">{ui.servicesPage.regionSectionLabel}</p>
          {clusterSections.map((s) => (
            <div key={s.label} className="mb-10">
              <p className="mb-4 text-base font-black text-[#9A8A2E] border-b border-gray-100 pb-2">{s.label}</p>
              <RegionList regions={s.regions} />
            </div>
          ))}
          {broadRegions.length > 0 && (
            <div className="mb-10">
              <p className="mb-4 text-base font-black text-[#9A8A2E] border-b border-gray-100 pb-2">{ui.servicesPage.broadRegionLabel}</p>
              <RegionList regions={broadRegions} withItems />
            </div>
          )}
        </div>
      </section>

      {byItem.size > 0 && (
        <section className="py-12 px-5 bg-[#F7F6F3]">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">{ui.servicesPage.itemSectionLabel}</p>
            <div className="space-y-6">
              {[...byItem.keys()].map((item) => (
                <div key={item} id={`item-${item}`}>
                  <h3 className="mb-2 text-sm font-black text-[#16181D]">{applyReplacements(item)}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {byItem.get(item)!.map((k) => (
                      <Link
                        key={k.slug}
                        href={`/${k.slug}`}
                        className="text-xs text-gray-600 px-2.5 py-1 border border-gray-200 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors"
                      >
                        {applyReplacements(k.modifier || k.keyword)}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {(b2bByRegion.size > 0 || b2bGeneral.length > 0) && (
        <section className="py-12 px-5">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">인테리어·시공팀 협력 · 하도급(B2B)</p>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed max-w-2xl">
              인테리어 업체·시공팀의 바닥 철거 외주와 하도급을 진행합니다. 세금계산서 발행, 다수 현장, 촉박한 공정 일정에 맞춰 협력합니다. 지역별 협력 페이지와 일반 협력 안내를 확인하세요.
            </p>
            {b2bGeneral.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-black text-[#16181D]">협력 유형·안내</h3>
                <div className="flex flex-wrap gap-1.5">
                  {b2bGeneral.map((k) => (
                    <Link key={k.slug} href={`/${k.slug}`} className="text-xs text-gray-600 px-2.5 py-1 border border-gray-200 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors">
                      {applyReplacements(k.keyword)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {[...b2bByRegion.keys()].map((region) => (
              <div key={region} className="mb-4">
                <h3 className="mb-2 text-sm font-black text-[#16181D]">
                  {hubRegionSet.has(region) ? (
                    <Link href={`/services/${encodeURIComponent(region)}`} className="hover:text-[#9A8A2E] hover:underline underline-offset-2">{region} 협력·하도급 →</Link>
                  ) : (
                    <span>{region} 협력·하도급</span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {b2bByRegion.get(region)!.map((k) => (
                    <Link key={k.slug} href={`/${k.slug}`} className="text-xs text-gray-600 px-2.5 py-1 border border-gray-200 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors">
                      {applyReplacements(k.keyword)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {targetKeywords.length > 0 && (
        <section className="py-12 px-5 bg-[#F7F6F3]">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">공간·상황별 안내</p>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-2xl">
              아파트·상가·사무실·빌라 등 공간 유형과 이사·리모델링·원상복구 같은 상황에 맞춰 바닥 철거를 안내합니다. 상황에 해당하는 페이지에서 준비 사항과 진행 방식을 확인하세요.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {targetKeywords.map((k) => (
                <Link key={k.slug} href={`/${k.slug}`} className="text-xs text-gray-600 px-2.5 py-1 border border-gray-200 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors">
                  {applyReplacements(k.keyword)}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {termKeywords.length > 0 && (
        <section className="py-12 px-5">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">바닥재 용어·직접 시공 안내</p>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-2xl">
              마루 뜯기, 장판 제거, 본드 제거처럼 바닥재를 직접 걷어내려는 분을 위한 용어·방법 안내입니다. 직접 하기 어려운 부분은 전문 시공으로도 도와드립니다.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {termKeywords.map((k) => (
                <Link key={k.slug} href={`/${k.slug}`} className="text-xs text-gray-600 px-2.5 py-1 border border-gray-200 bg-white hover:border-[#9A8A2E] hover:text-[#9A8A2E] transition-colors">
                  {applyReplacements(k.keyword)}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
