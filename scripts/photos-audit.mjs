// 사진 감사·판정·공개 반영.
//  1) 중복 탐지: sha256 완전 중복 + dHash 해밍거리 ≤ 6 근접 중복 → 그룹당 최고 화질 1장만 대표
//  2) 품질/안전 플래그: 초소형·초저용량·너무 어둡거나 흰 사진·흐림·비정상 비율·스크린샷/캡처 의심
//  3) 판정: approved / excluded(사유) / reviewNeeded(공개 보류)
//  4) 공개 반영: 승인분만 content/photos/derived → public/images/work/{id}.webp (+ thumb/)
//     비승인분은 public 에서 제거 — 배포 산출물에 미승인 사진이 실리지 않게 한다.
//  5) 공개용 manifest: src/data/work-photos.json (드라이브 파일 ID 미포함)
//  6) 리포트: reports/photo-audit.csv · photo-duplicates.csv · photo-review-needed.csv
//     + reports/photo-contact-sheet.html (운영자 육안 검토용 — 얼굴/번호판/문서는
//       자동 판별이 불완전하므로 배포 전 이 시트에서 확인 후 photos-review.mjs 로 제외)
//
// 사용: node scripts/photos-audit.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "content", "photos", "photo-manifest.json");
const DERIVED = path.join(ROOT, "content", "photos", "derived");
const PUBLIC_DIR = path.join(ROOT, "public", "images", "work");
const PUBLIC_THUMB = path.join(PUBLIC_DIR, "thumb");
const DATA_OUT = path.join(ROOT, "src", "data", "work-photos.json");
const REPORTS = path.join(ROOT, "reports");
const REPORT_ONLY = process.argv.includes("--report-only");

// ── 판정 기준(보수적) ─────────────────────────────────────────────────────────
const MIN_DIM = 500;          // 최소 변 길이
const MIN_BYTES = 20 * 1024;  // 원본 최소 용량
const LUMA_DARK = 18;         // 거의 검정
const LUMA_BRIGHT = 242;      // 거의 흰색
const BLUR_VAR = 60;          // 라플라시안 분산 — 이하면 흐림 의심(reviewNeeded)
const MAX_ASPECT = 3.0;       // 세로/가로 비율 상한
const HAMMING_NEAR = 6;       // dHash 근접 중복 임계

const SCREENSHOT_NAME = /screen\s*shot|screenshot|스크린샷|캡처|capture|kakaotalk_snapshot|img_capture/i;
const DOC_NAME = /견적|계약|세금|invoice|receipt|명함|사업자|등록증|통장|송장/i;
const PRIVACY_NAME = /전화번호|phone|주소|address|호수|번호판|license.?plate|얼굴|face|계좌|account|공동현관|출입번호|door.?code/i;

function hamming(aHex, bHex) {
  let x = BigInt("0x" + aHex) ^ BigInt("0x" + bHex);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const photos = manifest.photos;
  fs.mkdirSync(REPORTS, { recursive: true });

  // ── 1) 품질/안전 플래그 ──
  for (const p of photos) {
    const flags = [];
    let excluded = null;
    let review = false;
    const w = p.original.width ?? 0, h = p.original.height ?? 0;
    const shortSide = Math.min(w, h), aspect = shortSide ? Math.max(w, h) / shortSide : 0;
    if (!w || !h) excluded = "메타데이터 없음/손상 의심";
    else if (shortSide < MIN_DIM) excluded = `해상도 미달(${w}x${h})`;
    else if (p.original.bytes < MIN_BYTES) excluded = `용량 과소(${Math.round(p.original.bytes / 1024)}KB)`;
    else if (p.metrics.meanLuma <= LUMA_DARK) excluded = `거의 검은 사진(luma ${p.metrics.meanLuma})`;
    else if (p.metrics.meanLuma >= LUMA_BRIGHT) excluded = `거의 흰 사진(luma ${p.metrics.meanLuma})`;
    if (!excluded) {
      if (aspect > MAX_ASPECT) { review = true; flags.push(`비정상 비율(${aspect.toFixed(1)}:1)`); }
      if (p.metrics.laplacianVar < BLUR_VAR) { review = true; flags.push(`흐림 의심(선명도 ${p.metrics.laplacianVar})`); }
      if (SCREENSHOT_NAME.test(p.originalFilename) || (p.original.format === "png" && aspect > 1.9)) {
        review = true; flags.push("스크린샷/캡처 의심");
      }
      if (DOC_NAME.test(p.originalFilename)) { review = true; flags.push("문서/개인정보 의심(파일명)"); }
      if (PRIVACY_NAME.test(p.originalFilename)) { review = true; flags.push("개인정보 의심(파일명)"); }
    }
    p._flags = flags;
    p.excludedReason = excluded;
    p.reviewNeeded = !excluded && review;
    p.possiblePrivacyRisk = flags.some((f) => f.includes("문서") || f.includes("스크린샷"));
  }

  // ── 2) 중복 그룹 ──
  const candidates = photos.filter((p) => !p.excludedReason);
  const byChecksum = new Map();
  for (const p of candidates) {
    if (!byChecksum.has(p.checksum)) byChecksum.set(p.checksum, []);
    byChecksum.get(p.checksum).push(p);
  }
  // 완전 중복 → 대표 1장 외 제외
  const dupRows = [];
  for (const group of byChecksum.values()) {
    if (group.length > 1) {
      group.sort((a, b) => b.original.bytes - a.original.bytes);
      for (const d of group.slice(1)) {
        d.excludedReason = `완전 중복(대표 ${group[0].id})`;
        dupRows.push([d.id, d.originalFilename, "exact", group[0].id]);
      }
    }
  }
  // 근접 중복(dHash) — union-find
  const alive = photos.filter((p) => !p.excludedReason);
  const parent = new Map(alive.map((p) => [p.id, p.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      if (hamming(alive[i].metrics.dhash, alive[j].metrics.dhash) <= HAMMING_NEAR) union(alive[i].id, alive[j].id);
    }
  }
  const groups = new Map();
  for (const p of alive) {
    const r = find(p.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(p);
  }
  for (const group of groups.values()) {
    if (group.length > 1) {
      // 대표: 해상도×선명도 최고
      group.sort((a, b) => (b.original.width * b.original.height * (b.metrics.laplacianVar + 1)) - (a.original.width * a.original.height * (a.metrics.laplacianVar + 1)));
      for (const d of group.slice(1)) {
        d.excludedReason = `근접 중복(대표 ${group[0].id})`;
        dupRows.push([d.id, d.originalFilename, "near", group[0].id]);
      }
    }
  }

  // ── 3) 운영자 결정(review-overrides.json) 반영 — 자동 판정보다 우선 ──
  const OVERRIDES = path.join(ROOT, "content", "photos", "review-overrides.json");
  let overrides = { exclude: [], approve: [] };
  if (fs.existsSync(OVERRIDES)) {
    try { overrides = { exclude: [], approve: [], ...JSON.parse(fs.readFileSync(OVERRIDES, "utf8")) }; } catch { /* 무시 */ }
  }
  for (const p of photos) {
    if (overrides.exclude.includes(p.id)) {
      p.excludedReason = "운영자 제외(검토 결과)";
      p.reviewNeeded = false;
    } else if (overrides.approve.includes(p.id) && !p.excludedReason) {
      p.reviewNeeded = false;
      if (p._flags.length) p._flags.push("운영자 승인");
    }
  }

  // ── 최종 판정 ──
  for (const p of photos) {
    p.approved = !p.excludedReason && !p.reviewNeeded;
    p.updatedAt = new Date().toISOString();
  }
  const approved = photos.filter((p) => p.approved);
  const excluded = photos.filter((p) => p.excludedReason);
  const review = photos.filter((p) => p.reviewNeeded && !p.excludedReason);

  // ── 4) 공개 디렉터리 동기화(승인분만) ──
  if (!REPORT_ONLY) fs.mkdirSync(PUBLIC_THUMB, { recursive: true });
  const wanted = new Set();
  let published = 0;
  for (const p of approved) {
    if (REPORT_ONLY) {
      if (p.publicPath && fs.existsSync(path.join(ROOT, "public", p.publicPath.replace(/^\//, "")))) published++;
      continue;
    }
    const main = path.join(DERIVED, `${p.id}.webp`);
    const thumb = path.join(DERIVED, `${p.id}.thumb.webp`);
    if (!fs.existsSync(main) || !fs.existsSync(thumb)) { p.approved = false; p.excludedReason = "파생본 없음"; continue; }
    fs.copyFileSync(main, path.join(PUBLIC_DIR, `${p.id}.webp`));
    fs.copyFileSync(thumb, path.join(PUBLIC_THUMB, `${p.id}.webp`));
    wanted.add(`${p.id}.webp`);
    p.publicPath = `/images/work/${p.id}.webp`;
    p.thumbnailPath = `/images/work/thumb/${p.id}.webp`;
    published++;
  }
  // 승인 목록에 없는 파일은 public 에서 제거
  if (!REPORT_ONLY) {
    for (const dir of [PUBLIC_DIR, PUBLIC_THUMB]) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".webp") && !wanted.has(f)) fs.rmSync(path.join(dir, f));
      }
    }
  }

  // ── 5) 공개용 manifest(드라이브 ID 제외) ──
  const pub = {
    // poolVersion 은 정보용 — 이미지 선택 해시에 넣지 않는다(넣으면 풀 변경마다 전 페이지 재배치).
    poolVersion: new Date().toISOString().slice(0, 10),
    count: approved.filter((p) => p.publicPath).length,
    photos: approved
      .filter((p) => p.publicPath)
      .map((p) => ({
        id: p.id,
        src: p.publicPath,
        thumb: p.thumbnailPath,
        width: p.derived.main.width,
        height: p.derived.main.height,
        thumbWidth: p.derived.thumb.width,
        thumbHeight: p.derived.thumb.height,
      })),
  };
  if (!REPORT_ONLY) fs.writeFileSync(DATA_OUT, JSON.stringify(pub, null, 2), "utf8");

  // ── 6) 리포트 ──
  const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, "'")}"`).join(",")).join("\n");
  const auditCsv = "﻿" + csv([
    ["id", "originalFilename", "status", "reason_or_flags", "width", "height", "luma", "sharpness", "origKB", "webpKB"],
    ...photos.map((p) => [
      p.id, p.originalFilename,
      p.excludedReason ? "excluded" : p.reviewNeeded ? "reviewNeeded" : "approved",
      p.excludedReason || p._flags.join(" · "),
      p.original.width, p.original.height, p.metrics.meanLuma, p.metrics.laplacianVar,
      Math.round(p.original.bytes / 1024), Math.round((p.derived?.main?.bytes || 0) / 1024),
    ]),
  ]);
  const duplicatesCsv = "﻿" + csv([["id", "filename", "type", "kept_id"], ...dupRows]);
  const reviewCsv = "﻿" + csv([
    ["id", "filename", "flags"], ...review.map((p) => [p.id, p.originalFilename, p._flags.join(" · ")]),
  ]);
  for (const [name, value] of [
    ["photo-audit.csv", auditCsv], ["phase06-photo-audit.csv", auditCsv],
    ["photo-duplicates.csv", duplicatesCsv], ["phase06-photo-duplicates.csv", duplicatesCsv],
    ["photo-review-needed.csv", reviewCsv], ["phase06-photo-review-needed.csv", reviewCsv],
  ]) fs.writeFileSync(path.join(REPORTS, name), value, "utf8");

  // 컨택트 시트(로컬 검토용) — derived 썸네일을 상대 경로로 표시
  const sheetRow = (p, cls) => {
    const rel = path.relative(REPORTS, path.join(DERIVED, `${p.id}.thumb.webp`)).replace(/\\/g, "/");
    return `<figure class="${cls}"><img loading="lazy" src="${rel}" alt=""><figcaption>${p.id}<br>${p.originalFilename}<br>${p.excludedReason || p._flags.join("·") || "승인"}</figcaption></figure>`;
  };
  fs.writeFileSync(path.join(REPORTS, "photo-contact-sheet.html"), `<!doctype html><meta charset="utf-8">
<title>프로다 작업사진 검토 시트</title>
<style>body{font:13px/1.4 sans-serif;margin:20px}h2{margin:24px 0 8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
figure{margin:0;border:2px solid #ddd;padding:4px}figure.review{border-color:#e6a700}figure.excluded{border-color:#d33;opacity:.6}
img{width:100%;aspect-ratio:1;object-fit:cover}figcaption{font-size:11px;color:#555;word-break:break-all}</style>
<h1>작업사진 검토 시트 (${new Date().toISOString().slice(0, 10)})</h1>
<p>얼굴·차량 번호판·주소·개인정보가 보이는 사진이 있으면
<code>node scripts/photos-review.mjs --exclude &lt;id,id,...&gt;</code> 로 제외한 뒤 다시
<code>npm run photos:audit</code> 를 실행하세요. (자동 휴리스틱은 얼굴/번호판을 완벽히 탐지하지 못합니다)</p>
<h2>검토 필요 (${review.length})</h2><div class="grid">${review.map((p) => sheetRow(p, "review")).join("")}</div>
<h2>승인 (${approved.filter((p) => p.publicPath).length})</h2><div class="grid">${approved.filter((p) => p.publicPath).map((p) => sheetRow(p, "")).join("")}</div>
<h2>자동 제외 (${excluded.length})</h2><div class="grid">${excluded.map((p) => sheetRow(p, "excluded")).join("")}</div>`, "utf8");

  // manifest 저장(_flags 는 임시필드 → flags 로 보존)
  for (const p of photos) { p.flags = p._flags; delete p._flags; }
  if (!REPORT_ONLY) fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`[photos:audit]${REPORT_ONLY ? " report-only" : ""} 전체 ${photos.length} · 승인/공개 ${published} · 검토필요 ${review.length} · 제외 ${excluded.length}(중복 ${dupRows.length})`);
  console.log(`[photos:audit] ${REPORT_ONLY ? "공개 manifest 변경 없음" : "공개 manifest → src/data/work-photos.json"} (${pub.count}장)`);
  console.log(`[photos:audit] 검토 시트 → reports/photo-contact-sheet.html`);
}

main();
