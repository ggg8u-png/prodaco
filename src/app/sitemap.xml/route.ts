// /sitemap.xml — 사이트맵 인덱스. 모든 하위 sitemap(/sitemaps/<group>.xml)을 참조한다.
// robots.txt 는 이 인덱스를 가리킨다(src/app/robots.ts).
import { renderIndex } from "@/lib/sitemap";

export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  return new Response(renderIndex(), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
