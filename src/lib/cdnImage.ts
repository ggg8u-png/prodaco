// CMS(/admin)로 올린 사진은 폰에서 찍은 원본(3~8MB)이 그대로 커밋된다.
// 운영자가 미리 줄이거나 변환하지 않아도 되도록, 화면에 보낼 때만 Netlify Image CDN 을
// 거쳐 WebP·지정 폭으로 변환한다(원본 파일은 그대로 둔다).
//
//  · 대상: /uploads/... (CMS 업로드본)만. 드라이브 URL·이미 최적화된 /images/work/*.webp 는 통과.
//  · 로컬 개발(next dev)에는 /.netlify/images 가 없으므로 원본 경로를 그대로 쓴다.
//  · 배포 후 혹시 변환에 실패해도 <img onError> 폴백(GalleryImage)이 원본으로 되돌린다.

const CDN_ENABLED = process.env.NODE_ENV === "production";

/** CMS 업로드 이미지면 Netlify Image CDN 경로로, 아니면 원본 그대로. */
export function uploadedImage(src: string, width = 1600, quality = 74): string {
  if (!src || !CDN_ENABLED) return src;
  if (!src.startsWith("/uploads/")) return src;
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&fm=webp&q=${quality}`;
}

/** Netlify Image CDN 으로 감싼 주소에서 원본 경로를 되돌린다(폴백용). */
export function originalImage(src: string): string | null {
  if (!src.startsWith("/.netlify/images?")) return null;
  const m = src.match(/[?&]url=([^&]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}
