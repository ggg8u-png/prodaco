// 원본(content/photos/originals) → 최적화 파생본 + 측정치.
//   파생본: content/photos/derived/{iid}.webp (본문용 1600w) + {iid}.thumb.webp (그리드용 640w)
//   측정치: 해상도·용량·평균 밝기·선명도(라플라시안 분산)·dHash·sha256 → photo-manifest.json
//
// - EXIF 방향 반영(.rotate) 후 메타데이터(위치정보 포함)는 저장하지 않는다(sharp 기본).
// - iid = sha256(driveFileId) 앞 12자 — 공개 경로에 드라이브 파일 ID를 그대로 쓰지 않는다.
// - derived/ 는 스테이징(gitignore). 공개 복사는 photos-audit.mjs 가 승인분만 수행.
//
// 사용: node scripts/photos-optimize.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const INVENTORY = path.join(ROOT, "content", "photos", "drive-inventory.json");
const ORIGINALS = path.join(ROOT, "content", "photos", "originals");
const DERIVED = path.join(ROOT, "content", "photos", "derived");
const MANIFEST = path.join(ROOT, "content", "photos", "photo-manifest.json");

const MAIN_W = 1600;
const THUMB_W = 640;

const iidOf = (driveId) => crypto.createHash("sha256").update(driveId).digest("hex").slice(0, 12);

// 9x8 그레이스케일 인접 비교 dHash(64bit hex) — 근접 중복 탐지용.
async function dhash(sharpInst) {
  const { data } = await sharpInst.clone().grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits += data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0";
    }
  }
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

// 선명도: 다운스케일 그레이스케일에 3x3 라플라시안 → 분산. 낮을수록 흐림.
async function sharpness(sharpInst) {
  const { data, info } = await sharpInst.clone().grayscale().resize(256, 256, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v = 4 * data[y * w + x] - data[(y - 1) * w + x] - data[(y + 1) * w + x] - data[y * w + x - 1] - data[y * w + x + 1];
      sum += v; sumSq += v * v; n++;
    }
  }
  const mean = sum / n;
  return Math.round(sumSq / n - mean * mean);
}

async function main() {
  const sharp = (await import("sharp")).default;
  const inv = JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
  const worksite = inv.files.filter((f) => f.category === "worksite" && f.isImage);
  fs.mkdirSync(DERIVED, { recursive: true });

  // 기존 manifest 를 이어서 갱신(증분) — 이미 처리한 항목은 checksum 이 같으면 건너뜀.
  let manifest = { version: 1, generatedAt: "", photos: [] };
  if (fs.existsSync(MANIFEST)) {
    try { manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch { /* 재생성 */ }
  }
  const byId = new Map(manifest.photos.map((p) => [p.sourceFileId, p]));

  let processed = 0, skipped = 0, missing = 0, failed = 0;
  for (const f of worksite) {
    const orig = fs.readdirSync(ORIGINALS).find((n) => n.startsWith(f.driveFileId + "."));
    if (!orig) { missing++; continue; }
    const origPath = path.join(ORIGINALS, orig);
    const buf = fs.readFileSync(origPath);
    const checksum = crypto.createHash("sha256").update(buf).digest("hex");
    const iid = iidOf(f.driveFileId);
    const existing = byId.get(f.driveFileId);
    const mainOut = path.join(DERIVED, `${iid}.webp`);
    const thumbOut = path.join(DERIVED, `${iid}.thumb.webp`);
    if (existing && existing.checksum === checksum && fs.existsSync(mainOut) && fs.existsSync(thumbOut)) {
      skipped++; continue;
    }
    try {
      const img = sharp(buf).rotate(); // EXIF orientation 반영 → 메타데이터는 미보존(위치정보 제거)
      const meta = await sharp(buf).metadata();
      const stats = await img.clone().stats();
      const luma = Math.round(
        0.2126 * stats.channels[0].mean + 0.7152 * (stats.channels[1]?.mean ?? stats.channels[0].mean) + 0.0722 * (stats.channels[2]?.mean ?? stats.channels[0].mean)
      );
      const [ph, sharpVar] = await Promise.all([dhash(img), sharpness(img)]);
      const mainInfo = await img.clone().resize({ width: MAIN_W, withoutEnlargement: true }).webp({ quality: 78 }).toFile(mainOut);
      const thumbInfo = await img.clone().resize({ width: THUMB_W, withoutEnlargement: true }).webp({ quality: 74 }).toFile(thumbOut);
      const now = new Date().toISOString();
      const entry = {
        id: iid,
        source: "google-drive",
        sourceFileId: f.driveFileId, // 서버 전용 manifest — 공개 manifest(src/data)에는 미포함
        originalFilename: f.originalFilename,
        folder: f.folder,
        category: "general-worksite",
        checksum,
        original: { width: meta.width ?? null, height: meta.height ?? null, bytes: buf.length, format: meta.format ?? "" },
        derived: {
          main: { width: mainInfo.width, height: mainInfo.height, bytes: mainInfo.size },
          thumb: { width: thumbInfo.width, height: thumbInfo.height, bytes: thumbInfo.size },
        },
        metrics: { meanLuma: luma, laplacianVar: sharpVar, dhash: ph },
        // 판정은 photos-audit.mjs 가 채움
        approved: existing?.approved ?? null,
        reviewNeeded: existing?.reviewNeeded ?? false,
        possiblePrivacyRisk: existing?.possiblePrivacyRisk ?? false,
        excludedReason: existing?.excludedReason ?? null,
        caption: "프로다 작업 현장 참고 사진",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      byId.set(f.driveFileId, entry);
      processed++;
    } catch (e) {
      failed++;
      console.log(`[photos:optimize] 실패 ${f.originalFilename}: ${e.message}`);
    }
  }

  manifest.photos = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  manifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");

  const totalOrig = manifest.photos.reduce((s, p) => s + (p.original?.bytes || 0), 0);
  const totalDerived = manifest.photos.reduce((s, p) => s + (p.derived?.main?.bytes || 0) + (p.derived?.thumb?.bytes || 0), 0);
  console.log(`[photos:optimize] 신규/갱신 ${processed} · 유지 ${skipped} · 원본없음 ${missing} · 실패 ${failed}`);
  console.log(`[photos:optimize] 원본 ${(totalOrig / 1048576).toFixed(1)}MB → 파생 ${(totalDerived / 1048576).toFixed(1)}MB`);
  console.log(`[photos:optimize] manifest → content/photos/photo-manifest.json (${manifest.photos.length}장)`);
}

main().catch((e) => { console.error("[photos:optimize] 실패:", e.message); process.exit(1); });
