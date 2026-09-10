// IndexNow 제출기 — CMS가 기록한 "새 발행·실질 수정·삭제" 대기열만 보낸다.
//
// 사용법:
//   npm run seo:indexnow -- --dry       # payload/대상만 확인, 파일·네트워크 변경 없음
//   npm run seo:indexnow                # pending 항목만 제출하고 submitted로 기록
//   npm run seo:indexnow -- --retry-failed
//
// content/indexnow-queue.json 은 Decap CMS의 "⑧ IndexNow 제출 대기열"에서 관리한다.
// sitemap/lastmod/사진 manifest 변경은 이 파일을 바꾸지 않으므로 제출 대상이 될 수 없다.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const HOST = "prodaco.kr";
const SITE = `https://${HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_QUEUE = "content/indexnow-queue.json";
const MAX_BATCH = 100;
const EVENTS = new Set(["publish", "content_update", "delete"]);
const PENDING = "pending";
const RETRYABLE = new Set(["pending", "failed"]);
const REQUEST_TIMEOUT_MS = 30 * 1000;

function findKey() {
  const pub = path.join(process.cwd(), "public");
  const f = fs.readdirSync(pub).find((n) => /^[a-f0-9]{8,128}\.txt$/i.test(n));
  return f ? { key: f.replace(/\.txt$/i, ""), keyLocation: `${SITE}/${f}` } : null;
}

function optionValue(argv, option) {
  const i = argv.indexOf(option);
  return i >= 0 ? argv[i + 1] : undefined;
}

function readQueue(file) {
  if (!fs.existsSync(file)) throw new Error(`대기열 파일을 찾지 못했습니다: ${file}`);
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(raw.entries)) throw new Error("대기열 entries는 배열이어야 합니다.");
  return raw;
}

export function validUrl(url) {
  if (typeof url !== "string" || !url.trim() || url !== url.trim()) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.host !== HOST || parsed.username || parsed.password) return false;
    if (parsed.search || parsed.hash || /%2f|%5c/i.test(parsed.pathname)) return false;
    const decoded = decodeURIComponent(parsed.pathname);
    if (decoded.includes("\\") || decoded.split("/").includes("..")) return false;
    return parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}

function eligibleEntries(entries, retryFailed) {
  const eligible = [];
  const invalid = [];
  const seen = new Set();
  for (const entry of entries) {
    const statusAllowed = retryFailed ? RETRYABLE.has(entry.status) : entry.status === PENDING;
    if (!statusAllowed) continue;
    if (!EVENTS.has(entry.event) || !validUrl(entry.url)) {
      invalid.push(entry);
      continue;
    }
    // 같은 URL이 여러 번 대기 중이어도 이번 제출은 하나만. 각 항목의 상태는 함께 갱신한다.
    if (!seen.has(entry.url)) {
      seen.add(entry.url);
      eligible.push(entry);
    }
  }
  return { eligible, invalid };
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

function entrySignature(entry) {
  return JSON.stringify([
    entry.url,
    entry.event,
    entry.publishedAt || "",
    entry.sourceCommit || "",
    entry.semanticHash || "",
  ]);
}

function selectionFor(entries, urls) {
  const set = new Set(urls);
  const selected = entries.filter((entry) =>
    set.has(entry.url) && (entry.status === PENDING || entry.status === "failed")
  );
  return {
    ids: new Set(selected.map((entry) => entry.id).filter((id) => typeof id === "string" && id)),
    legacy: new Set(selected.filter((entry) => !entry.id).map(entrySignature)),
  };
}

function mark(entries, selection, status, extras = {}) {
  for (const entry of entries) {
    const selected = entry.id ? selection.ids.has(entry.id) : selection.legacy.has(entrySignature(entry));
    if (selected && (entry.status === PENDING || entry.status === "failed")) {
      entry.status = status;
      Object.assign(entry, extras);
      if (status === "submitted") delete entry.lastError;
    }
  }
}

function acquireQueueLock(file) {
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
      throw new Error(`대기열이 다른 프로세스에서 갱신 중입니다. 실행 중인 제출기가 없다면 남은 lock을 확인하세요: ${lockFile}`);
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
  return release;
}

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry");
  const retryFailed = argv.includes("--retry-failed");
  const customQueue = optionValue(argv, "--queue");
  if (argv.some((a) => a === "--file" || /^https?:\/\//.test(a))) {
    throw new Error("직접 URL/--file 제출은 막혀 있습니다. CMS IndexNow 제출 대기열을 사용하세요.");
  }

  const queueFile = path.resolve(process.cwd(), customQueue || DEFAULT_QUEUE);
  // 실제 제출은 선택→POST→상태 기록 전체를 단일 writer lock으로 감싼다.
  // 따라서 동시 실행한 제출기나 후보 생성기가 같은 pending을 중복 전송하거나
  // 네트워크 대기 중 추가된 항목을 stale snapshot으로 덮어쓸 수 없다.
  const releaseQueueLock = dry ? null : acquireQueueLock(queueFile);
  try {
  const queue = readQueue(queueFile);
  const { eligible, invalid } = eligibleEntries(queue.entries, retryFailed);
  if (invalid.length) {
    throw new Error(`대기열에 잘못된 pending 항목 ${invalid.length}건이 있습니다(이벤트·https://prodaco.kr URL 확인).`);
  }
  if (eligible.length > MAX_BATCH) {
    throw new Error(`대기열 ${eligible.length}건 — 한 번에 ${MAX_BATCH}건을 초과할 수 없습니다. 대량 전체 제출은 금지됩니다.`);
  }
  if (!eligible.length) {
    console.log("[indexnow] 제출할 pending URL이 없습니다. sitemap/lastmod/사진 변경만으로는 제출하지 않습니다.");
    return;
  }

  const urls = eligible.map((entry) => entry.url);
  const selection = selectionFor(queue.entries, urls);
  const keyInfo = findKey();
  const payload = keyInfo
    ? { host: HOST, key: keyInfo.key, keyLocation: keyInfo.keyLocation, urlList: urls }
    : { host: HOST, key: "<public key file required>", keyLocation: "<public/<key>.txt required>", urlList: urls };
  if (dry) {
    console.log(`[indexnow] --dry: ${urls.length}건. 전송·상태 변경 없음.`);
    console.log(JSON.stringify({ payload, events: eligible.map((e) => ({ url: e.url, event: e.event, publishedAt: e.publishedAt })) }, null, 2));
    return;
  }
  if (!keyInfo) throw new Error("public/<key>.txt IndexNow 키 파일을 찾지 못했습니다.");

  const attemptedAt = new Date().toISOString();
  let res;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    mark(queue.entries, selection, "failed", { lastAttemptAt: attemptedAt, lastError: String(error?.message || error) });
    writeQueueAtomic(queueFile, queue);
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    mark(queue.entries, selection, "failed", { lastAttemptAt: attemptedAt, lastError: `HTTP ${res.status} ${res.statusText}` });
    writeQueueAtomic(queueFile, queue);
    throw new Error(`IndexNow HTTP ${res.status} ${res.statusText}`);
  }

  // submitted는 API 접수 성공일 뿐 검색엔진 색인 완료가 아니다.
  mark(queue.entries, selection, "submitted", { submittedToIndexNowAt: attemptedAt });
  writeQueueAtomic(queueFile, queue);
  console.log(`[indexnow] ${urls.length}건 제출 기록 완료 (HTTP ${res.status}). 검색 색인 여부는 별도 확인이 필요합니다.`);
  } finally {
    releaseQueueLock?.();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`[indexnow] 오류: ${error?.message || error}`);
    process.exit(1);
  });
}
