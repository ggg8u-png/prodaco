// Git 변경에서 시공사례 상세 URL만 골라 기존 IndexNow 대기열에 넣는다.
// 이 스크립트는 네트워크 제출을 하지 않는다. 실제 제출은 scripts/indexnow.mjs가 담당한다.
//
//   npm run seo:gallery-indexnow -- --since <마지막-처리-커밋> --dry
//   npm run seo:gallery-indexnow -- --since <마지막-처리-커밋>
//   npm run seo:indexnow -- --dry
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SITE = "https://prodaco.kr";
const DEFAULT_QUEUE = "content/indexnow-queue.json";
const GALLERY_PREFIX = "content/gallery/";
const DRIVE_PROJECT_PREFIX = "content/drive-projects/";
const MAX_CANDIDATES = 20;

// 상세 HTML·metadata·구조화데이터에 실제 영향을 주는 필드만 해시한다.
// indexStatus·검색 확인 시각·목록 고정만 바뀐 커밋은 제출 후보가 아니다.
export const CONTENT_FIELDS = [
  "status",
  "verified",
  "title",
  "description",
  "region",
  "item",
  "beforeImage",
  "afterImage",
  "driveProjectId",
  "featuredImage",
  "featuredImageAlt",
  "thumbnailChoice",
  "photos",
  "publishedAt",
  "updatedAt",
  "workDate",
  "buildingType",
  "area",
  "workScope",
  "cost",
  "videoUrl",
  "videoPlatform",
  "videoThumbnail",
  "videoTitle",
];

function optionValue(argv, option) {
  const i = argv.indexOf(option);
  return i >= 0 ? argv[i + 1] : undefined;
}

function runGit(args, allowFailure = false) {
  const result = spawnSync("git", ["-c", `safe.directory=${ROOT.replace(/\\/g, "/")}`, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} 실패`).trim());
  }
  return { ok: result.status === 0, stdout: result.status === 0 ? result.stdout.trim() : "" };
}

function git(args, allowFailure = false) {
  return runGit(args, allowFailure).stdout;
}

function readQueue(file) {
  const queue = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(queue.entries)) throw new Error("IndexNow 대기열 entries는 배열이어야 합니다.");
  return queue;
}

function writeQueueAtomic(file, queue) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function withQueueLock(file, action) {
  const lockFile = `${file}.lock`;
  const token = randomUUID();
  let handle;
  const open = () => {
    const fd = fs.openSync(lockFile, "wx");
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString(), token }), "utf8");
    return fd;
  };
  try {
    handle = open();
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`대기열이 다른 프로세스에서 갱신 중입니다. 실행 중인 작업이 없다면 남은 lock을 확인하세요: ${lockFile}`);
    }
    throw error;
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    fs.closeSync(handle);
    try {
      const current = JSON.parse(fs.readFileSync(lockFile, "utf8"));
      if (current.token === token) fs.unlinkSync(lockFile);
    } catch { /* 소유권이 없거나 이미 정리된 lock은 건드리지 않는다. */ }
  };
  const onSigint = () => { release(); process.exit(130); };
  const onSigterm = () => { release(); process.exit(143); };
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  try {
    return action();
  } finally {
    release();
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stableValue(item)])
  );
}

function normalizeMeaningfulPhotos(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const photo of value) {
    if (typeof photo === "string" && photo.trim()) {
      out.push({ src: photo.trim() });
      continue;
    }
    if (!photo || typeof photo !== "object") continue;
    const src = typeof photo.src === "string" ? photo.src.trim() : "";
    if (!src) continue;
    out.push({
      src,
      ...(typeof photo.alt === "string" && photo.alt.trim() ? { alt: photo.alt.trim() } : {}),
      ...(typeof photo.caption === "string" && photo.caption.trim() ? { caption: photo.caption.trim() } : {}),
    });
  }
  return out;
}

export function meaningfulSnapshot(raw) {
  const source = raw || {};
  const normalized = {
    status: source.status === "draft" ? "draft" : "published",
    verified: source.verified !== false,
    thumbnailChoice: source.thumbnailChoice || "after",
    photos: normalizeMeaningfulPhotos(source.photos),
  };
  for (const field of CONTENT_FIELDS) {
    if (["status", "verified", "thumbnailChoice", "photos"].includes(field)) continue;
    const value = source[field];
    if (typeof value === "string") {
      if (value.trim()) normalized[field] = value.trim();
    } else if (value !== undefined && value !== null) {
      normalized[field] = value;
    }
  }
  return JSON.stringify(
    Object.fromEntries(CONTENT_FIELDS.filter((field) => Object.hasOwn(normalized, field)).map((field) => [field, stableValue(normalized[field])]))
  );
}

export function isRawCaseIndexable(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (raw.status === "draft" || raw.verified === false) return false;
  return Boolean(raw.beforeImage && raw.afterImage) && String(raw.description || "").trim().length >= 40;
}

export function isRawCaseRenderable(raw) {
  if (!raw || typeof raw !== "object" || raw.status === "draft") return false;
  return Boolean(raw.beforeImage && raw.afterImage);
}

/** 이전·현재 JSON 한 쌍에서 IndexNow 이벤트 하나만 결정한다. */
export function classifyGalleryChange(before, after) {
  const wasRenderable = isRawCaseRenderable(before);
  const isRenderable = isRawCaseRenderable(after);
  const wasIndexable = isRawCaseIndexable(before);
  const isIndexable = isRawCaseIndexable(after);
  if (!wasIndexable && isIndexable) return "publish";
  if (wasRenderable && !isRenderable) return "delete";
  // URL은 200이지만 noindex로 바뀐 경우 삭제로 거짓 기록하지 않고 재수집할 수정으로 본다.
  if (wasIndexable && !isIndexable) return "content_update";
  if (wasIndexable && isIndexable && meaningfulSnapshot(before) !== meaningfulSnapshot(after)) {
    return "content_update";
  }
  return null;
}

function readBlob(ref, file) {
  const text = git(["show", `${ref}:${file}`], true);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${ref}:${file} JSON을 읽을 수 없습니다.`);
  }
}

function imagesFromList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      return String(item.image || item.src || "").trim();
    })
    .filter(Boolean);
}

/** Gallery 로더와 같은 우선순위로 승인된 Drive 프로젝트 사진을 합친다. */
export function resolveDriveSnapshot(raw, project) {
  if (!raw || typeof raw.driveProjectId !== "string") return raw;
  const id = raw.driveProjectId.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return raw;
  if (!project || project.siteId !== id || project.approved !== true) return raw;
  const before = imagesFromList(project.before);
  const after = imagesFromList(project.after);
  const general = imagesFromList(project.general);
  const hasPair = before.length > 0 && after.length > 0;
  const drivePhotos = [...(hasPair ? [...before.slice(1), ...after.slice(1)] : [...before, ...after]), ...general]
    .map((src) => ({ src, alt: "프로다 작업 현장 사진" }));
  return {
    ...raw,
    ...(hasPair ? { beforeImage: before[0], afterImage: after[0] } : {}),
    photos: [...(Array.isArray(raw.photos) ? raw.photos : []), ...drivePhotos],
  };
}

function resolveDriveContent(ref, raw) {
  if (!raw || typeof raw.driveProjectId !== "string") return raw;
  const id = raw.driveProjectId.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return raw;
  return resolveDriveSnapshot(raw, readBlob(ref, `${DRIVE_PROJECT_PREFIX}${id}.json`));
}

function idFor(file, raw) {
  const fallback = path.posix.basename(file, ".json");
  return typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : fallback;
}

export function assertCaseIdMatchesFile(file, raw) {
  if (!raw || !Object.hasOwn(raw, "id")) return;
  const expected = path.posix.basename(file, ".json");
  if (typeof raw.id !== "string" || raw.id !== expected) {
    throw new Error(`${file}: id는 파일명과 정확히 같아야 합니다 (${String(raw.id)} != ${expected}).`);
  }
}

function candidate(file, before, after, sourceCommit) {
  assertCaseIdMatchesFile(file, before);
  assertCaseIdMatchesFile(file, after);
  const event = classifyGalleryChange(before, after);
  if (!event) return null;
  const caseId = idFor(file, after || before);
  const semanticHash = createHash("sha256").update(meaningfulSnapshot(after || before)).digest("hex");
  return {
    id: `gallery-${sourceCommit.slice(0, 12)}-${event}-${caseId}`,
    url: `${SITE}/gallery/${encodeURIComponent(caseId)}`,
    event,
    ...(after?.publishedAt || before?.publishedAt
      ? { publishedAt: String(after?.publishedAt || before?.publishedAt).slice(0, 10) }
      : {}),
    note:
      event === "publish"
        ? "Git 변경에서 감지한 신규 색인 가능 시공사례"
        : event === "delete"
          ? "Git 변경에서 감지한 삭제 또는 초안 전환 시공사례"
          : "Git 변경에서 감지한 시공사례의 의미 있는 콘텐츠·색인 신호 수정",
    status: "pending",
    sourceCommit,
    semanticHash,
  };
}

export function mergeCandidates(entries, candidates) {
  let added = 0;
  let updated = 0;
  for (const item of candidates) {
    // 같은 Git 범위를 재실행한 경우만 영구 중복으로 본다. 과거에 제출한 A 상태가
    // A→B→A로 되돌아오면 현재 검색엔진 문서는 B일 수 있으므로 새 A 후보가 필요하다.
    if (entries.some((entry) => entry.id === item.id)) {
      continue;
    }
    if (entries.some((entry) =>
      entry.url === item.url &&
      entry.event === item.event &&
      entry.semanticHash === item.semanticHash &&
      (entry.status === "pending" || entry.status === "failed")
    )) {
      continue;
    }
    const pending = entries.find((entry) => entry.url === item.url && (entry.status === "pending" || entry.status === "failed"));
    if (pending) {
      Object.assign(pending, item);
      updated++;
    } else {
      entries.push(item);
      added++;
    }
  }
  return { added, updated };
}

function galleryFilesAt(ref) {
  return git(["ls-tree", "-r", "--name-only", ref, "--", "content/gallery"])
    .split(/\r?\n/)
    .filter((file) => file.startsWith(GALLERY_PREFIX) && file.endsWith(".json"));
}

function galleryFilesReferencing(ref, projectIds) {
  if (!projectIds.size) return [];
  return galleryFilesAt(ref).filter((file) => {
    const raw = readBlob(ref, file);
    return raw && typeof raw.driveProjectId === "string" && projectIds.has(raw.driveProjectId.trim());
  });
}

function changesBetween(base, head) {
  const lines = git(["diff", "--name-status", "--find-renames", `${base}..${head}`, "--", "content/gallery", "content/drive-projects"])
    .split(/\r?\n/)
    .filter(Boolean);
  const out = [];
  const changedProjects = new Set();
  for (const line of lines) {
    const [status, first, second] = line.split("\t");
    for (const changed of [first, second]) {
      if (changed?.startsWith(DRIVE_PROJECT_PREFIX) && changed.endsWith(".json")) {
        changedProjects.add(path.posix.basename(changed, ".json"));
      }
    }
    if (status.startsWith("R")) {
      if (first?.startsWith(GALLERY_PREFIX)) {
        const before = resolveDriveContent(base, readBlob(base, first));
        const item = candidate(first, before, null, head);
        if (item) out.push(item);
      }
      if (second?.startsWith(GALLERY_PREFIX)) {
        const after = resolveDriveContent(head, readBlob(head, second));
        const item = candidate(second, null, after, head);
        if (item) out.push(item);
      }
      continue;
    }
    const file = first;
    if (!file?.startsWith(GALLERY_PREFIX) || !file.endsWith(".json")) continue;
    const before = status === "A" ? null : resolveDriveContent(base, readBlob(base, file));
    const after = status === "D" ? null : resolveDriveContent(head, readBlob(head, file));
    const item = candidate(file, before, after, head);
    if (item) out.push(item);
  }

  // Gallery JSON이 그대로여도 연결된 승인 Drive 프로젝트의 사진 변경은 상세 HTML과
  // og:image를 바꾸므로 해당 사례만 의미 있는 수정 후보로 다시 계산한다.
  const referenced = new Set([
    ...galleryFilesReferencing(base, changedProjects),
    ...galleryFilesReferencing(head, changedProjects),
  ]);
  for (const file of referenced) {
    const before = resolveDriveContent(base, readBlob(base, file));
    const after = resolveDriveContent(head, readBlob(head, file));
    const item = candidate(file, before, after, head);
    if (item) out.push(item);
  }

  return [...new Map(out.map((item) => [`${item.id}:${item.semanticHash}`, item])).values()];
}

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry");
  const headInput = optionValue(argv, "--head") || process.env.COMMIT_REF || "HEAD";
  const head = git(["rev-parse", headInput]);
  const baseInput = optionValue(argv, "--since") || process.env.CACHED_COMMIT_REF;
  if (!baseInput) {
    throw new Error("누락 방지를 위해 기준 커밋이 필요합니다: --since <마지막 처리 커밋> (또는 CACHED_COMMIT_REF)");
  }
  const base = git(["rev-parse", baseInput]);
  if (!runGit(["merge-base", "--is-ancestor", base, head], true).ok) {
    throw new Error("--since 기준 커밋이 대상 커밋의 ancestor가 아닙니다.");
  }
  const queueFile = path.resolve(ROOT, optionValue(argv, "--queue") || DEFAULT_QUEUE);
  const candidates = changesBetween(base, head);
  if (candidates.length > MAX_CANDIDATES) {
    throw new Error(`시공사례 후보 ${candidates.length}건이 안전 상한 ${MAX_CANDIDATES}건을 초과했습니다. 범위를 좁혀 나눠 검토하세요.`);
  }
  console.log(`[gallery-indexnow] ${base.slice(0, 7)}..${head.slice(0, 7)} · 후보 ${candidates.length}건`);
  for (const item of candidates) console.log(`  ${item.event.padEnd(14)} ${item.url}`);
  if (!candidates.length) console.log("  새 발행·삭제·검색 신호·의미 있는 수정 사례가 없습니다.");

  if (dry) {
    const draft = structuredClone(readQueue(queueFile));
    const merged = mergeCandidates(draft.entries, candidates);
    console.log(`[gallery-indexnow] --dry: 대기열 변경 없음 (추가 ${merged.added}, 갱신 ${merged.updated})`);
    return;
  }
  let merged;
  withQueueLock(queueFile, () => {
    const draft = structuredClone(readQueue(queueFile));
    merged = mergeCandidates(draft.entries, candidates);
    writeQueueAtomic(queueFile, draft);
  });
  console.log(`[gallery-indexnow] 대기열 반영 완료 (추가 ${merged.added}, 갱신 ${merged.updated}). 실제 제출 전 npm run seo:indexnow -- --dry 로 확인하세요.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(`[gallery-indexnow] 오류: ${error?.message || error}`);
    process.exit(1);
  }
}
