// 지역×품목 페이지 전용 OG 이미지 — /{슬러그}/opengraph-image
// 지역명 · 품목명 · 대표번호 세 정보만 크게 넣는다(lib/ogImage.tsx).
// 실제 현장 사진이 없어도 항상 생성된다 — 그래픽 템플릿이라 자료 유무와 무관하다.
import { getKeywordBySlug } from "@/data/keywords";
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogImage";
import { regionVariants } from "@/data/regionVariants";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "프로다 — 바닥재 철거·샌딩";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  let slug = raw;
  try { slug = decodeURIComponent(raw); } catch { /* 인코딩 그대로 사용 */ }
  const k = getKeywordBySlug(slug);

  // 지역은 행정 표기(수원시·강남구)가 있으면 그쪽이 이미지에서 더 명확하다.
  const vs = regionVariants(k?.region);
  const region = vs.length > 1 ? vs[1] : k?.region || "서울 · 경기 · 인천";
  const service = k?.item || "바닥재 철거";

  return renderOgImage({ region, service, eyebrow: "바닥철거 · 샌딩" });
}
