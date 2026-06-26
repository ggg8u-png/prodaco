import type { Metadata } from "next";
import Link from "next/link";
import { getKeywords } from "@/data/keywords";
import { CLUSTERS } from "@/data/regions";
import { company } from "@/data/company";
import { applyReplacements } from "@/lib/replacements";
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

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "서비스 안내", item: `${siteUrl}/services` },
    ],
  };

  const RegionList = ({ regions }: { regions: string[] }) => (
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
              <RegionList regions={broadRegions} />
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
    </div>
  );
}
