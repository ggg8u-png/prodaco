// 구글 드라이브 작업사진 폴더 목록 조회 → content/photos/drive-inventory.json
//
// 공개(링크 공유) 폴더의 embeddedfolderview HTML을 파싱한다 — 자격증명 불필요.
// (fetch-gallery.mjs 와 같은 공개 링크 방식. 폴더가 비공개로 바뀌면 결과가 비므로
//  그 경우 서비스 계정 방식으로 전환: GOOGLE_SERVICE_ACCOUNT_EMAIL /
//  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY 환경변수 — 현재는 불필요해 미구현 TODO.)
//
// 사용: node scripts/photos-scan.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "content", "photos");
const OUT_FILE = path.join(OUT_DIR, "drive-inventory.json");

// 운영 폴더(링크 공유). env 로 교체 가능.
const WORKSITE_FOLDER = process.env.GOOGLE_DRIVE_WORKSITE_FOLDER_ID || "1RLyyr7y4pAF2qBGuVgxDp8rt7ZJVylNY"; // 3.사진_작업현장
const BEFORE_AFTER_FOLDER = process.env.GOOGLE_DRIVE_BEFOREAFTER_FOLDER_ID || "1STQ5cgJIWE1sZlo8juSqbnJtZnvwL1v2"; // 2.사진_비포애프터

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/i;

async function fetchFolderHtml(folderId) {
  const url = `https://drive.google.com/embeddedfolderview?id=${folderId}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`folder ${folderId}: HTTP ${res.status}`);
  return await res.text();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// embeddedfolderview HTML → { files: [{id,name}], folders: [{id,name}] }
function parseFolder(html) {
  const files = [];
  const folders = [];
  // 항목 블록: <div class="flip-entry" id="entry-<ID>"> ... <a href="..."> ... flip-entry-title">NAME<
  const entryRe = /<div class="flip-entry"[^>]*id="entry-([A-Za-z0-9_-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m;
  while ((m = entryRe.exec(html)) !== null) {
    const [, id, href, rawName] = m;
    const name = decodeEntities(rawName.trim());
    if (href.includes("/drive/folders/")) folders.push({ id, name });
    else files.push({ id, name });
  }
  return { files, folders };
}

async function scan() {
  const inventory = [];
  const warnings = [];

  // 1) 작업 현장 폴더(일반 배치 풀)
  const ws = parseFolder(await fetchFolderHtml(WORKSITE_FOLDER));
  for (const f of ws.files) {
    inventory.push({
      driveFileId: f.id,
      originalFilename: f.name,
      folder: "3.사진_작업현장",
      category: "worksite",
      isImage: IMAGE_EXT.test(f.name),
    });
  }
  if (ws.folders.length) warnings.push(`작업현장 폴더에 하위 폴더 ${ws.folders.length}개 — 하위 폴더는 스캔 제외(직접 확인 필요)`);

  // 2) 비포애프터 폴더 — 큐레이션 갤러리(gallery.ts) 전용. 무작위 배치 풀에서 제외하되
  //    전체 인벤토리 파악을 위해 기록만 한다.
  const ba = parseFolder(await fetchFolderHtml(BEFORE_AFTER_FOLDER));
  for (const sub of ba.folders) {
    try {
      const subContents = parseFolder(await fetchFolderHtml(sub.id));
      for (const f of subContents.files) {
        inventory.push({
          driveFileId: f.id,
          originalFilename: f.name,
          folder: `2.사진_비포애프터/${sub.name}`,
          category: "before-after",
          isImage: IMAGE_EXT.test(f.name),
        });
      }
    } catch (e) {
      warnings.push(`비포애프터 하위 폴더 ${sub.name} 조회 실패: ${e.message}`);
    }
  }

  const result = {
    scannedAt: new Date().toISOString(),
    source: "google-drive-embeddedfolderview(공개 링크)",
    folders: { worksite: WORKSITE_FOLDER, beforeAfter: BEFORE_AFTER_FOLDER },
    counts: {
      total: inventory.length,
      worksite: inventory.filter((x) => x.category === "worksite").length,
      beforeAfter: inventory.filter((x) => x.category === "before-after").length,
      nonImage: inventory.filter((x) => !x.isImage).length,
    },
    warnings,
    files: inventory,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(`[photos:scan] total=${result.counts.total} worksite=${result.counts.worksite} beforeAfter=${result.counts.beforeAfter} nonImage=${result.counts.nonImage}`);
  for (const w of warnings) console.log(`[photos:scan] ⚠ ${w}`);
  console.log(`[photos:scan] → ${path.relative(ROOT, OUT_FILE)}`);
}

scan().catch((e) => {
  console.error("[photos:scan] 실패:", e.message);
  process.exit(1);
});
