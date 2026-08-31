// IndexNow 제출기 — CMS가 기록한 "새 발행·실질 수정·삭제" 대기열만 보낸다.
//
// 사용법:
//   npm run seo:indexnow -- --dry       # payload/대상만 확인, 파일·네트워크 변경 없음
//   npm run seo:indexnow                # pending 항목만 제출하고 submitted로 기록
//   npm run seo:indexnow -- --retry-failed
//
// content/indexnow-queue.json 은 Decap CMS의 "⑨ IndexNow 제출 대기열"에서 관리한다.
// sitemap/lastmod/사진 manifest 변경은 이 파일을 바꾸지 않으므로 제출 대상이 될 수 없다.
import fs from "node:fs";
import path from "node:path";

const HOST = "prodaco.kr";
const SITE = `https://${HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_QUEUE = "content/indexnow-queue.json";
const MAX_BATCH = 100;
const EVENTS = new Set(["publish", "content_update", "delete"]);
const PENDING = "pending";
const RETRYABLE = new Set(["pending", "failed"]);

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

function validUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.host === HOST;
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

function writeQueue(file, queue) {
  fs.writeFileSync(file, `${JSON.stringify(queue, null, 2)}\n`);
}

function mark(entries, urls, status, extras = {}) {
  const set = new Set(urls);
  for (const entry of entries) {
    if (set.has(entry.url) && (entry.status === PENDING || entry.status === "failed")) {
      entry.status = status;
      Object.assign(entry, extras);
      if (status === "submitted") delete entry.lastError;
    }
  }
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
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    mark(queue.entries, urls, "failed", { lastAttemptAt: attemptedAt, lastError: String(error?.message || error) });
    writeQueue(queueFile, queue);
    throw error;
  }

  if (!res.ok) {
    mark(queue.entries, urls, "failed", { lastAttemptAt: attemptedAt, lastError: `HTTP ${res.status} ${res.statusText}` });
    writeQueue(queueFile, queue);
    throw new Error(`IndexNow HTTP ${res.status} ${res.statusText}`);
  }

  // submitted는 API 접수 성공일 뿐 검색엔진 색인 완료가 아니다.
  mark(queue.entries, urls, "submitted", { submittedToIndexNowAt: attemptedAt });
  writeQueue(queueFile, queue);
  console.log(`[indexnow] ${urls.length}건 제출 기록 완료 (HTTP ${res.status}). 검색 색인 여부는 별도 확인이 필요합니다.`);
}

main().catch((error) => {
  console.error(`[indexnow] 오류: ${error?.message || error}`);
  process.exit(1);
});
