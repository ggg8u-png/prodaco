// 드라이브 인벤토리(drive-inventory.json)의 작업현장 사진 원본을 내려받는다.
//   → content/photos/originals/{driveFileId}.{ext}   (gitignore 대상 — 커밋 금지)
//
// - 이미 받은 파일은 건너뜀(파일 존재 + 크기 > 0)
// - 공개 링크 3단 폴백(fetch-gallery.mjs 와 동일 체인) + 재시도
// - 동시 다운로드 제한, 실패 목록은 reports/photo-sync-report.json 에 기록
//
// 사용: node scripts/photos-sync.mjs [--category worksite|all] [--limit N]
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INVENTORY = path.join(ROOT, "content", "photos", "drive-inventory.json");
const ORIGINALS_DIR = path.join(ROOT, "content", "photos", "originals");
const REPORT_DIR = path.join(ROOT, "reports");
const REPORT = path.join(REPORT_DIR, "photo-sync-report.json");

const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const CATEGORY = argOf("--category", "worksite");
const LIMIT = Number(argOf("--limit", "0")) || 0;
const CONCURRENCY = 6;

// 원본 화질 우선 다운로드 체인 — 전부 공개(링크 공유) 파일용, 인증정보 불필요.
function downloadUrls(id) {
  return [
    `https://drive.usercontent.google.com/download?id=${id}&export=download`,
    `https://drive.google.com/uc?export=download&id=${id}`,
    `https://lh3.googleusercontent.com/d/${id}=w2400`, // 최후 폴백(리사이즈본)
  ];
}

async function fetchOne(id) {
  for (const url of downloadUrls(id)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(45000) });
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        if (!res.ok) break;
        const ct = res.headers.get("content-type") || "";
        const buf = Buffer.from(await res.arrayBuffer());
        // 공개 대용량 파일의 바이러스 검사 확인 HTML 회피: content-type 확인
        if (!ct.startsWith("image/") && !ct.startsWith("application/octet-stream")) break;
        if (buf.length < 1024) break;
        return buf;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  return null;
}

function extOf(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(name || "");
  return m ? m[1].toLowerCase() : "jpg";
}

async function main() {
  if (!fs.existsSync(INVENTORY)) {
    console.error("[photos:sync] drive-inventory.json 없음 — 먼저 npm run photos:scan");
    process.exit(1);
  }
  const inv = JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
  let targets = inv.files.filter((f) => f.isImage && (CATEGORY === "all" || f.category === CATEGORY));
  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  let downloaded = 0, skipped = 0;
  const failed = [];
  const queue = [...targets];

  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      const dest = path.join(ORIGINALS_DIR, `${f.driveFileId}.${extOf(f.originalFilename)}`);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { skipped++; continue; }
      const buf = await fetchOne(f.driveFileId);
      if (!buf) { failed.push({ id: f.driveFileId, name: f.originalFilename }); continue; }
      fs.writeFileSync(dest, buf);
      downloaded++;
      if ((downloaded + skipped) % 25 === 0) {
        console.log(`[photos:sync] 진행 ${downloaded + skipped + failed.length}/${targets.length} (신규 ${downloaded}, 기존 ${skipped}, 실패 ${failed.length})`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const report = {
    syncedAt: new Date().toISOString(),
    category: CATEGORY,
    targets: targets.length,
    downloaded, skipped, failed: failed.length,
    failedFiles: failed,
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), "utf8");
  console.log(`[photos:sync] 완료 — 대상 ${targets.length} / 신규 ${downloaded} / 기존 ${skipped} / 실패 ${failed.length}`);
  if (failed.length) console.log("[photos:sync] 실패 목록은 reports/photo-sync-report.json 참고 (재실행 시 재시도됨)");
}

main().catch((e) => {
  console.error("[photos:sync] 실패:", e.message);
  process.exit(1);
});
