import fs from "node:fs";
import path from "node:path";
import type { GalleryItem, GalleryPhoto } from "@/types";

const GALLERY_DIR = path.join(process.cwd(), "public", "assets", "gallery");

/**
 * 시공 사진은 구글 드라이브(2.사진_비포애프터 / 3.사진_작업현장)에 보관돼 있습니다.
 * 아래는 그 원본 파일을 가리키는 드라이브 이미지 URL입니다.
 *
 * ※ 사진이 노출되려면 드라이브 폴더 공유가 '링크가 있는 모든 사용자(뷰어)'여야 합니다.
 *   비공개면 자동으로 '시공 사진 준비 중' 플레이스홀더가 표시됩니다(GalleryImage 폴백).
 *
 * 우선순위(빌드 시점에 결정):
 *   1) 자체 호스팅 WebP — public/assets/gallery/{id}.webp 가 있으면 그 경로 사용
 *      (scripts/fetch-gallery.mjs 가 빌드 전에 드라이브에서 받아 WebP로 생성).
 *   2) 없으면 구글 이미지 CDN(lh3.googleusercontent.com) URL.
 * 런타임에 lh3가 실패하면 GalleryImage가 drive thumbnail → 플레이스홀더로 자동 폴백합니다.
 *
 * 즉 사진을 못 받아도(드라이브 비공개 등) 빌드는 깨지지 않고 단계적으로 폴백합니다.
 */
export const driveThumb = (id: string, w = 1600): string => {
  try {
    if (fs.existsSync(path.join(GALLERY_DIR, `${id}.webp`))) {
      return `/assets/gallery/${id}.webp`;
    }
  } catch {
    /* fs 접근 불가 시 원격 URL 사용 */
  }
  return `https://lh3.googleusercontent.com/d/${id}=w${w}`;
};

// CMS(/admin)로 추가한 시공사례 — content/gallery/*.json (이미지는 /uploads 자체 호스팅).
// 기존(드라이브) 사례보다 앞에 노출된다. 서버 빌드 전용 로더.
const CMS_GALLERY_DIR = path.join(process.cwd(), "content", "gallery");
function loadCmsGallery(): GalleryItem[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(CMS_GALLERY_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: GalleryItem[] = [];
  for (const f of files) {
    try {
      const g = JSON.parse(fs.readFileSync(path.join(CMS_GALLERY_DIR, f), "utf8"));
      if (g && g.beforeImage && g.afterImage) {
        out.push({
          id: g.id || f.replace(/\.json$/, ""),
          title: g.title || "시공 사례",
          region: g.region || "수도권",
          item: g.item || "바닥재 철거",
          beforeImage: g.beforeImage,
          afterImage: g.afterImage,
          description: g.description || "",
        });
      }
    } catch {
      /* 잘못된 파일 건너뜀 */
    }
  }
  return out;
}

// 비포·애프터 7세트 (각 폴더의 이른 시각 = Before, 늦은 시각 = After 로 추정)
const legacyGalleryItems: GalleryItem[] = [
  {
    id: "ba1",
    title: "바닥재 철거·샌딩 현장 ①",
    region: "수도권",
    item: "바닥재 철거 · 샌딩",
    beforeImage: driveThumb("1YLdwnXX05Oj7htnNSMtfxNdsqDwjKAB7"),
    afterImage: driveThumb("1b2uPpyYWnOOqJzPND6mMOXbE5pQj71bi"),
    description: "철거 전 바닥과 샌딩 마무리 후 비교 (2026.06)",
  },
  {
    id: "ba2",
    title: "바닥재 철거·샌딩 현장 ②",
    region: "수도권",
    item: "바닥재 철거 · 샌딩",
    beforeImage: driveThumb("1tJKOX0qvcNJOQDq4jl25a6ZZhDbN03gv"),
    afterImage: driveThumb("1ekZZwhDpz75n_p16yHn52Bb3uN_9YWt1"),
    description: "철거 전 바닥과 샌딩 마무리 후 비교 (2026.06)",
  },
  {
    id: "ba3",
    title: "바닥재 철거·샌딩 현장 ③",
    region: "수도권",
    item: "바닥재 철거 · 샌딩",
    beforeImage: driveThumb("1iaZRpDZ7l--1j3sbb7f4b3c06l4gBL10"),
    afterImage: driveThumb("1mnMpkemoJ3bjeHirkyCxXm62zbgBaiEK"),
    description: "철거 전 바닥과 샌딩 마무리 후 비교 (2026.01)",
  },
  {
    id: "ba4",
    title: "바닥재 철거·샌딩 현장 ④",
    region: "수도권",
    item: "바닥재 철거 · 샌딩",
    beforeImage: driveThumb("1jIGVYfr_-Gv0nHqQiith6hIJDuzEq8mP"),
    afterImage: driveThumb("1JuAwrdBoiWPurYfRS_Ct9ViHB2bv1wYJ"),
    description: "철거 전 바닥과 샌딩 마무리 후 비교 (2025.12)",
  },
  {
    id: "ba5",
    title: "바닥재 철거·샌딩 현장 ⑤",
    region: "수도권",
    item: "바닥재 철거 · 샌딩",
    beforeImage: driveThumb("18npwF9EXWg9kwFFEJd3v41EgASLpoFVo"),
    afterImage: driveThumb("1dYR2cuHiS0YSguqfyRklTdcp_CRJED5N"),
    description: "철거 전 바닥과 샌딩 마무리 후 비교 (2025.06)",
  },
  {
    id: "ba6",
    title: "바닥재 철거·샌딩 현장 ⑥",
    region: "수도권",
    item: "바닥재 철거 · 샌딩",
    beforeImage: driveThumb("1Rru0j_g7vJnHad2uwnvyTZVSt-lF37yb"),
    afterImage: driveThumb("1t2gUxIUuMdfTbgxIaFr4-yIo_uiNMBNO"),
    description: "철거 전 바닥과 샌딩 마무리 후 비교 (2025.07)",
  },
  {
    id: "ba7",
    title: "바닥재 철거·샌딩 현장 ⑦",
    region: "수도권",
    item: "바닥재 철거 · 샌딩",
    beforeImage: driveThumb("1CuWDxS5ZrknC1sK5QdGIyhR9Q0YTzL6v"),
    afterImage: driveThumb("1l6f6l4KNOU1lntGQJwXQMo1mKrfEUQEJ"),
    description: "철거 전 바닥과 샌딩 마무리 후 비교 (2025.05)",
  },
];

// CMS 추가 사례 + 기존 사례 (CMS 항목이 앞에 노출)
export const galleryItems: GalleryItem[] = [...loadCmsGallery(), ...legacyGalleryItems];

// 작업 현장 사진 9장
export const worksitePhotos: GalleryPhoto[] = [
  { id: "ws1", src: driveThumb("1KZ3yojjw-lZxJPUvTMrT4lueoAIYM7ke"), alt: "바닥재 철거 작업 현장 1" },
  { id: "ws2", src: driveThumb("1LByKCoSldrHB-Iq-CRY697FFtfHDpdb1"), alt: "바닥재 철거 작업 현장 2" },
  { id: "ws3", src: driveThumb("10HHcmr-J6OrBZlr6ofwl9NxiNrMvqJS6"), alt: "바닥재 철거 작업 현장 3" },
  { id: "ws4", src: driveThumb("1hDay-7bzIbIbljA0FAczGATO84nJ1Wc_"), alt: "바닥재 철거 작업 현장 4" },
  { id: "ws5", src: driveThumb("135SeM2UZrhHhAjId4BTtM4WGk2zQdl4Q"), alt: "바닥재 철거 작업 현장 5" },
  { id: "ws6", src: driveThumb("1hcXrpUIYqO6VpLeByZpm95STc3qDsPIR"), alt: "바닥재 철거 작업 현장 6" },
  { id: "ws7", src: driveThumb("1oou_g1y_F989QGnN8PIXJwiSueQ8YOBV"), alt: "바닥재 철거 작업 현장 7" },
  { id: "ws8", src: driveThumb("1hQ_2KBOl5wsIybniDajhedrVZ3-y02oC"), alt: "바닥재 철거 작업 현장 8" },
  { id: "ws9", src: driveThumb("1mPq9ioVxVWrFfc2F_t2FMjGL0fEk8F8H"), alt: "바닥재 철거 작업 현장 9" },
];
