// /sitemaps/<group>.xml — 하위 sitemap. group ∈ core|regions|services|programmatic-1|programmatic-2|blog.
// 인덱스(/sitemap.xml)와 동일한 URL 규칙(200·index·self-canonical·인코딩)을 공유한다(src/lib/sitemap.ts).
import { isSitemapGroup, entriesForGroup, renderUrlset, nonEmptyGroups } from "@/lib/sitemap";
import { notFound } from "next/navigation";

export const dynamic = "force-static";
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  // 비어 있는 그룹(예: 전 유형 noindex 인 programmatic-2)은 프리렌더 제외 → 404.
  return nonEmptyGroups().map((g) => ({ group: `${g.group}.xml` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ group: string }> }) {
  const { group: raw } = await params;
  const name = raw.replace(/\.xml$/, "");
  if (!isSitemapGroup(name)) notFound();
  const entries = entriesForGroup(name);
  if (entries.length === 0) notFound(); // 빈 사이트맵(GSC "XML 태그 누락" 유발) 방지
  return new Response(renderUrlset(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
