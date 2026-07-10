// /sitemaps/<group>.xml — 하위 sitemap. group ∈ core|regions|services|programmatic-1|programmatic-2|blog.
// 인덱스(/sitemap.xml)와 동일한 URL 규칙(200·index·self-canonical·인코딩)을 공유한다(src/lib/sitemap.ts).
import { SITEMAP_GROUPS, isSitemapGroup, entriesForGroup, renderUrlset } from "@/lib/sitemap";
import { notFound } from "next/navigation";

export const dynamic = "force-static";
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return SITEMAP_GROUPS.map((g) => ({ group: `${g}.xml` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ group: string }> }) {
  const { group: raw } = await params;
  const name = raw.replace(/\.xml$/, "");
  if (!isSitemapGroup(name)) notFound();
  return new Response(renderUrlset(entriesForGroup(name)), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
