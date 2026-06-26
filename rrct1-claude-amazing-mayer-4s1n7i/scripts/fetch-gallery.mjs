// 빌드 시점에 구글 드라이브의 시공 사진을 받아 WebP로 변환해 자체 호스팅한다.
//   결과물: public/assets/gallery/{driveId}.webp
//   - 드라이브 ID는 src/data/gallery.ts 에서 자동 추출(단일 출처).
//   - 이미 파일이 있으면 건너뜀(재빌드 비용 절감 / 직접 커밋한 파일 보존).
//   - 네트워크/변환 실패는 전부 무시하고 종료코드 0 으로 끝낸다.
//     (사진을 못 받아도 gallery.ts 가 자동으로 Drive URL 로 폴백 → 빌드는 절대 깨지지 않음)
//
// 로컬에서 직접 생성·커밋하려면: `node scripts/fetch-gallery.mjs` 실행 후 public/assets/gallery 커밋.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "assets", "gallery");
const GALLERY_TS = path.join(ROOT, "src", "data", "gallery.ts");

function collectIds() {
  try {
    const txt = fs.readFileSync(GALLERY_TS, "utf8");
    const ids = new Set();
    for (const m of txt.matchAll(/driveThumb\("([A-Za-z0-9_-]+)"\)/g)) ids.add(m[1]);
    return [...ids];
  } catch (e) {
    console.log("[fetch-gallery] gallery.ts 읽기 실패:", e.message);
    return [];
  }
}

async function fetchImage(id) {
  const urls = [
    `https://lh3.googleusercontent.com/d/${id}=w1600`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w1600`,
    `https://drive.usercontent.google.com/download?id=${id}&export=view`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      const buf = Buffer.from(await res.arrayBuffer());
      if (ct.startsWith("image/") && buf.length > 1024) return buf;
    } catch {
      /* 다음 URL 시도 */
    }
  }
  return null;
}

async function main() {
  const ids = collectIds();
  if (ids.length === 0) {
    console.log("[fetch-gallery] 대상 ID 없음 — 건너뜀");
    return;
  }

  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch (e) {
    console.log("[fetch-gallery] sharp 미설치 — WebP 변환 건너뜀(Drive 폴백 사용):", e.message);
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let created = 0, skipped = 0, failed = 0;

  for (const id of ids) {
    const dest = path.join(OUT_DIR, `${id}.webp`);
    if (fs.existsSync(dest)) { skipped++; continue; }
    try {
      const buf = await fetchImage(id);
      if (!buf) { failed++; continue; }
      await sharp(buf)
        .rotate() // EXIF 방향 보정
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(dest);
      created++;
    } catch {
      failed++;
    }
  }

  console.log(`[fetch-gallery] total=${ids.length} created=${created} skipped=${skipped} failed=${failed}`);
  if (failed > 0) {
    console.log("[fetch-gallery] 일부 사진을 못 받았습니다(드라이브 비공개/네트워크). 해당 사진은 Drive URL로 자동 폴백됩니다.");
  }
}

main()
  .catch((e) => console.log("[fetch-gallery] 비치명적 오류:", e?.message))
  .finally(() => process.exit(0));
