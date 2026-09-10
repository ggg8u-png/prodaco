import { selectWorkPhotos, workPhotoAlt } from "@/lib/workPhotos";

export interface ServiceFeaturedImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  source: "work-photo" | "site-fallback";
  photoId?: string;
}

interface ServiceFeaturedImageOptions {
  siteUrl: string;
  region?: string;
  /** Visible WorkPhotos count, so the representative photo is guaranteed to be on the page. */
  visiblePhotoCount?: number;
}

/**
 * Pick the real, approved work photo used as a service page's search/social thumbnail.
 *
 * The same route key, region and count are passed to WorkPhotos on the page. This keeps
 * og:image, Twitter metadata, structured data and the visible page evidence aligned.
 */
export function serviceFeaturedImage(
  routeKey: string,
  { siteUrl, region, visiblePhotoCount = 6 }: ServiceFeaturedImageOptions
): ServiceFeaturedImage {
  const origin = siteUrl.replace(/\/+$/, "");
  const photo = selectWorkPhotos(routeKey, Math.max(1, visiblePhotoCount), { region })[0];

  if (!photo) {
    return {
      src: `${origin}/opengraph-image`,
      alt: "프로다 바닥재 철거 서비스 안내",
      width: 1200,
      height: 630,
      source: "site-fallback",
    };
  }

  return {
    src: `${origin}${photo.src}`,
    alt: workPhotoAlt(routeKey, photo.id),
    width: photo.width,
    height: photo.height,
    source: "work-photo",
    photoId: photo.id,
  };
}
