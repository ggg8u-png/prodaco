// 단계 추가 — staging 풀에서 키워드를 배치 단위로 승급(live keywords.json 으로 이동).
//
// 왜: 약속된 2만여 키워드를 한 번에 올리면 도어웨이/대량생성 스팸으로 색인 거부·
//     순위 하락 위험이 큽니다. 그래서 우선순위(고전환·핵심 지역) 높은 순으로 정렬된
//     src/data/keywords-staging.json 에서 N개씩 꺼내 live 로 옮겨, 점진적으로 색인되게 합니다.
//
// 사용:
//   node scripts/promote-keywords.mjs --count 1000      # 상위 1000개 승급
//   node scripts/promote-keywords.mjs 1000              # 동일(위치 인자)
//   node scripts/promote-keywords.mjs --count 1000 --dry # 미리보기(파일 변경 없음)
//
// 동작:
//   - staging 상위 N개를 꺼내 keywords.json 에 추가(slug 중복 자동 제거).
//   - 승급분은 staging 에서 제거하고 두 파일을 다시 씁니다(2-space JSON, 빌드 포맷 유지).
//   - 같은 배치를 두 번 돌려도 중복이 생기지 않습니다.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LIVE = path.join(ROOT, "src", "data", "keywords.json");
const STAGING = path.join(ROOT, "src", "data", "keywords-staging.json");

// ── 인자 파싱 ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const dry = argv.includes("--dry");
let count = 1000;
const ci = argv.indexOf("--count");
if (ci >= 0 && argv[ci + 1]) count = parseInt(argv[ci + 1], 10);
else {
  const pos = argv.find((a) => /^\d+$/.test(a));
  if (pos) count = parseInt(pos, 10);
}
if (!Number.isFinite(count) || count <= 0) {
  console.error("[promote] --count 는 1 이상의 정수여야 합니다.");
  process.exit(1);
}

// ── 로드 ───────────────────────────────────────────────────────────────────────
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
const live = readJson(LIVE);
let staging;
try {
  staging = readJson(STAGING);
} catch {
  console.error(`[promote] staging 파일을 읽을 수 없습니다: ${STAGING}`);
  process.exit(1);
}
const pending = Array.isArray(staging) ? staging : staging.items || [];
const stagingMeta = Array.isArray(staging) ? null : staging.meta || null;

if (pending.length === 0) {
  console.log("[promote] staging 이 비어 있습니다. 더 추가할 키워드가 없습니다.");
  process.exit(0);
}

// ── 승급 대상 선정(slug 중복 제거) ─────────────────────────────────────────────
const liveSlugs = new Set(live.map((k) => k.slug));
const promote = [];
const remaining = [];
for (const k of pending) {
  if (promote.length < count && !liveSlugs.has(k.slug)) {
    promote.push(k);
    liveSlugs.add(k.slug);
  } else {
    remaining.push(k);
  }
}

console.log(`[promote] 요청 ${count}개 → 승급 ${promote.length}개 | live ${live.length} → ${live.length + promote.length} | staging ${pending.length} → ${remaining.length}`);
if (promote.length > 0) {
  console.log("[promote] 승급 예시:", promote.slice(0, 5).map((k) => k.keyword).join(" | "));
}
if (dry) {
  console.log("[promote] --dry 모드: 파일을 변경하지 않았습니다.");
  process.exit(0);
}
if (promote.length === 0) {
  console.log("[promote] 승급할 항목이 없습니다(모두 이미 live 이거나 staging 소진).");
  process.exit(0);
}

// ── 저장 ───────────────────────────────────────────────────────────────────────
const nextLive = [...live, ...promote];
const nextStaging = Array.isArray(staging)
  ? remaining
  : { meta: { ...stagingMeta, pending: remaining.length }, items: remaining };

fs.writeFileSync(LIVE, JSON.stringify(nextLive, null, 2) + "\n");
fs.writeFileSync(STAGING, JSON.stringify(nextStaging, null, 2) + "\n");
console.log(`[promote] 완료. keywords.json=${nextLive.length}, staging 남음=${remaining.length}`);
