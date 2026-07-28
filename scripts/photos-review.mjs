// 운영자 검토 결정 기록 — content/photos/review-overrides.json 에 영구 저장.
// photos-audit.mjs 가 매 실행마다 이 파일을 반영한다(자동 판정보다 우선).
//
// 사용:
//   node scripts/photos-review.mjs --exclude id1,id2   # 공개 금지(개인정보 등)
//   node scripts/photos-review.mjs --approve id1,id2   # 검토필요 플래그 해제(공개 승인)
//   node scripts/photos-review.mjs --list              # 현재 결정 목록
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "content", "photos", "review-overrides.json");
const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] || "") : null; };

let data = { exclude: [], approve: [] };
if (fs.existsSync(FILE)) data = { ...data, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };

const addTo = (list, ids, other) => {
  for (const id of ids.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!list.includes(id)) list.push(id);
    const i = other.indexOf(id);
    if (i >= 0) other.splice(i, 1);
  }
};

const ex = val("--exclude"), ap = val("--approve");
if (ex) addTo(data.exclude, ex, data.approve);
if (ap) addTo(data.approve, ap, data.exclude);

if (ex || ap) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  console.log(`[photos:review] 저장 — exclude ${data.exclude.length}건 · approve ${data.approve.length}건`);
  console.log("[photos:review] 반영하려면: npm run photos:audit");
} else {
  console.log(JSON.stringify(data, null, 2));
}
