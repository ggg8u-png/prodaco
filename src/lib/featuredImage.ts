// 대표 썸네일(featured image) 해석 — 검색결과·SNS 공유·목록 카드가 같은 사진을 쓰게 하는 단일 출처.
//
// 운영자가 CMS 에서 사진을 직접 고르면 그 사진이 무조건 이긴다. 고르지 않았을 때만
// 아래 폴백이 순서대로 동작한다.
//
//   블로그   featuredImage → 본문 첫 사진 → 기본 사진(승인된 작업현장 풀에서 글마다 고정 1장)
//                          → 사이트 기본 OG(/opengraph-image)
//   시공사례 featuredImage → thumbnailChoice(before/after) → afterImage → beforeImage
//                          → 추가 사진 첫 장
//
// ⚠ 검색엔진이 실제로 어떤 썸네일을 고를지는 사이트가 강제할 수 없다. 여기서 하는 일은
//   "우리가 대표로 제시하는 사진" 을 og:image · twitter:image · JSON-LD image · 카드에
//   빠짐없이 같은 값으로 내보내는 것까지다(신호를 일관되게 주는 것).
import type { BlogPost, GalleryItem } from "@/types";
import { selectWorkPhotos, workPhotoAlt } from "@/lib/workPhotos";

export interface FeaturedImage {
  /** 사이트 내부 경로 또는 절대 URL(원본 그대로 — CDN 변환은 표시 직전에 한다). */
  src: string;
  alt: string;
  /** 운영자가 CMS 에서 직접 지정한 사진인가. 상세페이지 상단 노출 여부를 이 값으로 정한다. */
  explicit: boolean;
  /** 어떤 규칙으로 골랐는지 — 디버깅·테스트용. */
  source: "custom" | "before" | "after" | "body" | "extra" | "default" | "site";
}

/** 사이트 공용 OG 이미지 라우트(src/app/opengraph-image.tsx). */
export const SITE_OG_IMAGE = "/opengraph-image";

const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;

/** 본문(마크다운)에 처음 등장하는 사진. 없으면 null. */
export function firstBodyImage(content: string): { src: string; alt: string } | null {
  const m = MD_IMAGE_RE.exec(content || "");
  if (!m || !m[2]) return null;
  return { src: m[2], alt: (m[1] || "").trim() };
}

const trimmed = (v?: string): string => (typeof v === "string" ? v.trim() : "");

/**
 * 블로그 글의 대표 썸네일.
 * 기본 사진은 승인된 작업현장 풀에서 글 id 로 고정 선택한다 — 같은 글은 항상 같은 사진이고
 * (재빌드해도 안 바뀜), 지역·공정을 단정하지 않는 중립 alt 를 쓴다.
 */
export function postFeaturedImage(post: BlogPost): FeaturedImage {
  const custom = trimmed(post.featuredImage);
  if (custom) {
    return {
      src: custom,
      alt: trimmed(post.featuredImageAlt) || `${post.title} 대표 이미지`,
      explicit: true,
      source: "custom",
    };
  }

  const body = firstBodyImage(post.content);
  if (body) {
    return { src: body.src, alt: body.alt || `${post.title} 본문 사진`, explicit: false, source: "body" };
  }

  const routeKey = `blog/${post.id}`;
  const [fallback] = selectWorkPhotos(routeKey, 1);
  if (fallback) {
    return { src: fallback.src, alt: workPhotoAlt(routeKey, fallback.id), explicit: false, source: "default" };
  }

  return { src: SITE_OG_IMAGE, alt: "프로다 바닥재 철거", explicit: false, source: "site" };
}

/**
 * 시공사례의 대표 썸네일.
 * 직접 올린 사진이 있으면 그것, 없으면 운영자가 고른 전/후 중 한 장, 그것도 없으면
 * 지금까지와 같은 기본값(샌딩 후 사진)이다 — 기존 사례의 og:image 가 바뀌지 않는다.
 */
export function caseFeaturedImage(g: GalleryItem): FeaturedImage {
  const custom = trimmed(g.featuredImage);
  const altOf = (fallback: string) => trimmed(g.featuredImageAlt) || fallback;

  if (custom) {
    return { src: custom, alt: altOf(`${g.region} ${g.item} 시공사례 대표 사진`), explicit: true, source: "custom" };
  }
  if (g.thumbnailChoice === "before" && g.beforeImage) {
    return { src: g.beforeImage, alt: altOf(`${g.region} ${g.item} 철거 전 바닥 상태`), explicit: true, source: "before" };
  }
  if (g.thumbnailChoice === "after" && g.afterImage) {
    return { src: g.afterImage, alt: altOf(`${g.region} ${g.item} 철거·샌딩 완료 후 바닥`), explicit: true, source: "after" };
  }
  if (g.afterImage) {
    return { src: g.afterImage, alt: altOf(`${g.region} ${g.item} 철거·샌딩 완료 후 바닥`), explicit: false, source: "after" };
  }
  if (g.beforeImage) {
    return { src: g.beforeImage, alt: altOf(`${g.region} ${g.item} 철거 전 바닥 상태`), explicit: false, source: "before" };
  }
  const extra = g.photos?.[0];
  if (extra) {
    return { src: extra.src, alt: extra.alt || `${g.region} ${g.item} 작업 현장 사진`, explicit: false, source: "extra" };
  }
  return { src: SITE_OG_IMAGE, alt: `${g.region} ${g.item} 시공사례`, explicit: false, source: "site" };
}

/** 상대 경로를 절대 URL 로 — og:image·JSON-LD 는 상대경로를 쓰면 안 된다. */
export function absoluteImageUrl(siteUrl: string, src: string): string {
  if (!src) return `${siteUrl}${SITE_OG_IMAGE}`;
  if (/^https?:\/\//.test(src)) return src;
  return `${siteUrl}${src.startsWith("/") ? "" : "/"}${src}`;
}
