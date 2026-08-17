// 지역 허브 전용 OG 이미지 — /services/{지역}/opengraph-image
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogImage";
import { regionVariants } from "@/data/regionVariants";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "프로다 — 지역별 바닥재 철거·샌딩";

export default async function Image({ params }: { params: Promise<{ region: string }> }) {
  const { region: raw } = await params;
  let region = raw;
  try { region = decodeURIComponent(raw); } catch { /* 인코딩 그대로 사용 */ }
  const vs = regionVariants(region);
  return renderOgImage({
    region: vs.length > 1 ? vs[1] : region,
    service: "바닥재 철거 · 샌딩",
    eyebrow: "지역별 서비스",
  });
}
