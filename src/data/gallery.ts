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
// 레거시 before/after 7세트 — CMS 사례가 하나도 없을 때만 쓰는 폴백(아래 galleryItems).
// CMS(content/gallery)에 사례가 있으면 이 배열은 노출되지 않아 중복이 생기지 않는다.
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
// CMS 사례가 있으면 그것만(중복 없음), 하나도 없으면 레거시로 폴백 →
// 홈페이지 galleryItems[0]/[1] 접근이 빈 배열로 크래시("Application error")나지 않게 보장.
const _cmsGallery = loadCmsGallery();
export const galleryItems: GalleryItem[] = _cmsGallery.length > 0 ? _cmsGallery : legacyGalleryItems;

// 작업 현장 사진 48장 — 구글 드라이브 "3.사진_작업현장" 폴더의 실제 현장 사진.
//   [slug]/services 페이지가 슬러그 시드로 6장씩 회전 노출하므로, 매수가 많을수록
//   1,546개 페이지 사이의 사진 조합 중복이 줄어(고유성↑) 색인 품질에 유리하다.
//   (빌드 시 scripts/fetch-gallery.mjs 가 드라이브에서 받아 WebP 자체호스팅. 실패 시 lh3 CDN 폴백.)
export const worksitePhotos: GalleryPhoto[] = [
  { id: "ws1", src: driveThumb("1t3g4NpLa0oWdVD2OpmFSiqz1RshDmI1g"), alt: "바닥재 철거·샌딩 작업 현장 1" },
  { id: "ws2", src: driveThumb("1Fm5T6FgiqxVqv1pJGm7sJFypbCOsCnMA"), alt: "바닥재 철거·샌딩 작업 현장 2" },
  { id: "ws3", src: driveThumb("1vtoPT7E5etyMHcVEYwgqjGoRtIsedWwH"), alt: "바닥재 철거·샌딩 작업 현장 3" },
  { id: "ws4", src: driveThumb("1_8AqcX56jXlYzyYWVvnYIKUozsIPph1J"), alt: "바닥재 철거·샌딩 작업 현장 4" },
  { id: "ws5", src: driveThumb("1IXa2Q57jdfNkztPsIC1mtvD77mbHyyPJ"), alt: "바닥재 철거·샌딩 작업 현장 5" },
  { id: "ws6", src: driveThumb("1972GfWcZ1157TX8GZylpAtgqW4tFcKyk"), alt: "바닥재 철거·샌딩 작업 현장 6" },
  { id: "ws7", src: driveThumb("1-BdAUvxQTTa3jf7o9vWGHv3ImQCKtWyb"), alt: "바닥재 철거·샌딩 작업 현장 7" },
  { id: "ws8", src: driveThumb("1vjVT5zYI33oPm_FkY2rA-LGMnXziz5ZP"), alt: "바닥재 철거·샌딩 작업 현장 8" },
  { id: "ws9", src: driveThumb("1j-V2zxoMzVc06dtsqMVgRw3QOr3Zfrqn"), alt: "바닥재 철거·샌딩 작업 현장 9" },
  { id: "ws10", src: driveThumb("1_b2DnyRvZ8q4l5H74dWxO2t9z6gJaeOq"), alt: "바닥재 철거·샌딩 작업 현장 10" },
  { id: "ws11", src: driveThumb("1x5-WimruTNyQHX_MoE_yeHredR2O3e79"), alt: "바닥재 철거·샌딩 작업 현장 11" },
  { id: "ws12", src: driveThumb("1O6zamNA6OJCrNFyd0tbgKyqAvQAhq0yQ"), alt: "바닥재 철거·샌딩 작업 현장 12" },
  { id: "ws13", src: driveThumb("1PuByjtHO9N9vEGjkjqtDohx30PRoi93k"), alt: "바닥재 철거·샌딩 작업 현장 13" },
  { id: "ws14", src: driveThumb("1WRwsvN2UrDjr_75QlYYt2dCKq8hrnCB8"), alt: "바닥재 철거·샌딩 작업 현장 14" },
  { id: "ws15", src: driveThumb("1a_y4LeJAb3LdQjqE2P9O4c8nw30pzIvT"), alt: "바닥재 철거·샌딩 작업 현장 15" },
  { id: "ws16", src: driveThumb("18vLevZiWjVszBOUR6sIsK2_NhFVTJUlF"), alt: "바닥재 철거·샌딩 작업 현장 16" },
  { id: "ws17", src: driveThumb("1yqDsdrgow_tsRf69rmfamaxZkpx9McaU"), alt: "바닥재 철거·샌딩 작업 현장 17" },
  { id: "ws18", src: driveThumb("1UWcoORrWr140GlP-bWCERth61GciuvPW"), alt: "바닥재 철거·샌딩 작업 현장 18" },
  { id: "ws19", src: driveThumb("1CbQX26ELdwDxT8oCviPwHZtfHHlbcOxX"), alt: "바닥재 철거·샌딩 작업 현장 19" },
  { id: "ws20", src: driveThumb("1cr7ijTTzzo4mz9omMKyucBWJfHATAXZI"), alt: "바닥재 철거·샌딩 작업 현장 20" },
  { id: "ws21", src: driveThumb("1D_bt3dpTjMMmAGKtMlF_aHRsUFFwr6Ae"), alt: "바닥재 철거·샌딩 작업 현장 21" },
  { id: "ws22", src: driveThumb("19qg4H02tFSG1oU898tGB2O4OSGiWO6N5"), alt: "바닥재 철거·샌딩 작업 현장 22" },
  { id: "ws23", src: driveThumb("1II74i0rCgWnXKVrH7iMhB1e7nHKXV1UH"), alt: "바닥재 철거·샌딩 작업 현장 23" },
  { id: "ws24", src: driveThumb("1ZV0y_kG1hNJ4v4rE9Eeo_Jmj46CHDLhb"), alt: "바닥재 철거·샌딩 작업 현장 24" },
  { id: "ws25", src: driveThumb("1eERS3Y1C6qMp768nf-mjWACzp4TwTT3Q"), alt: "바닥재 철거·샌딩 작업 현장 25" },
  { id: "ws26", src: driveThumb("121MhuwzEIfvptR8rRBgwIhEMuwildK01"), alt: "바닥재 철거·샌딩 작업 현장 26" },
  { id: "ws27", src: driveThumb("1XCDdXdCL-ezFtAbnaCey6hLnD95pAR_G"), alt: "바닥재 철거·샌딩 작업 현장 27" },
  { id: "ws28", src: driveThumb("1zGzPUM1nK89EBaBJ0W4MoadPi5t5uUaF"), alt: "바닥재 철거·샌딩 작업 현장 28" },
  { id: "ws29", src: driveThumb("1Hy3kAHYaVOAE0zKDj7E1VLxiO8Iu6Zpc"), alt: "바닥재 철거·샌딩 작업 현장 29" },
  { id: "ws30", src: driveThumb("1TnNKReAEOTTPm-USocKgsmJ4Ofvrw3Xt"), alt: "바닥재 철거·샌딩 작업 현장 30" },
  { id: "ws31", src: driveThumb("1DSXiFK-ajMbEfXJZB5qc2xJPiF6dmhEv"), alt: "바닥재 철거·샌딩 작업 현장 31" },
  { id: "ws32", src: driveThumb("1Afv4MhqEe5XclgUnhQTHhF-lE3lNbQTo"), alt: "바닥재 철거·샌딩 작업 현장 32" },
  { id: "ws33", src: driveThumb("1ndjp4NTw70Ndlz95aue8JYTgRu0Nsskr"), alt: "바닥재 철거·샌딩 작업 현장 33" },
  { id: "ws34", src: driveThumb("1VeKpE-lcpZPRCO84vbCeg8osThFr9KZi"), alt: "바닥재 철거·샌딩 작업 현장 34" },
  { id: "ws35", src: driveThumb("1zyVEVgxz9SKisdK2yivc50TXlXopX-qi"), alt: "바닥재 철거·샌딩 작업 현장 35" },
  { id: "ws36", src: driveThumb("1XQdf2pWZx8fysVcmoaY2886CVZP8bn_W"), alt: "바닥재 철거·샌딩 작업 현장 36" },
  { id: "ws37", src: driveThumb("1rtlSZQNxJ0f4MWLYXMHZvX7PUccO2G67"), alt: "바닥재 철거·샌딩 작업 현장 37" },
  { id: "ws38", src: driveThumb("1y665LzidsWEIF9TWjtlLHHUtkX65_gaF"), alt: "바닥재 철거·샌딩 작업 현장 38" },
  { id: "ws39", src: driveThumb("1uOOJubaRAMnI-PgOBk_I-1sYfPqt-KFj"), alt: "바닥재 철거·샌딩 작업 현장 39" },
  { id: "ws40", src: driveThumb("1xb44BeOZ5_InIJ3O32s1uDvnLzpJhGhD"), alt: "바닥재 철거·샌딩 작업 현장 40" },
  { id: "ws41", src: driveThumb("1kU_3U48yd7kLa5hhaiMvRwVw8t6anhkH"), alt: "바닥재 철거·샌딩 작업 현장 41" },
  { id: "ws42", src: driveThumb("1sJdaK7ARRwXDpUp5jpkqu6FAO1XFwikC"), alt: "바닥재 철거·샌딩 작업 현장 42" },
  { id: "ws43", src: driveThumb("13ZMIKkyNgeJzltqyKXuLAiWSn00GSUCV"), alt: "바닥재 철거·샌딩 작업 현장 43" },
  { id: "ws44", src: driveThumb("1MeYw-uI4gIRzLGHk6kpVFjLrGISJ0MrF"), alt: "바닥재 철거·샌딩 작업 현장 44" },
  { id: "ws45", src: driveThumb("1lkcacHxVuxJTxWel4u3eg3888eZiOzmF"), alt: "바닥재 철거·샌딩 작업 현장 45" },
  { id: "ws46", src: driveThumb("1QzlEhvqL9_4FJIArxTdOJMCXZ_jdtZOA"), alt: "바닥재 철거·샌딩 작업 현장 46" },
  { id: "ws47", src: driveThumb("1FiafHuuBDWOexIci7rHhJxMjsKpU-J7q"), alt: "바닥재 철거·샌딩 작업 현장 47" },
  { id: "ws48", src: driveThumb("1sqRDkGrx2Bt7ZmfCXClXSFlqqlkHsand"), alt: "바닥재 철거·샌딩 작업 현장 48" },
];
