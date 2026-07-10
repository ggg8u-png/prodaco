// IndexNow 통보 — Bing·Naver 등 IndexNow 참여 검색엔진에 "새로 생성/실제 변경된 URL만" 알린다.
// (Google 은 IndexNow 를 쓰지 않으므로 sitemap/내부링크로 발견을 유도한다.)
//
// ⚠ 운영 원칙(스펙 준수):
//   · 기존 URL 1,546개를 매번 대량 전송하지 않는다. 새 URL 또는 본문이 실제 바뀐 URL만 넘긴다.
//   · 하루에 같은 URL을 반복 통보하지 않는다.
//
// 사용법:
//   node scripts/indexnow.mjs https://prodaco.kr/새-슬러그 https://prodaco.kr/변경된-슬러그
//   node scripts/indexnow.mjs --file reports/changed-urls.txt   (한 줄에 URL 하나)
//   (--dry 를 붙이면 전송하지 않고 payload 만 출력)
import fs from "node:fs";
import path from "node:path";

const HOST = "prodaco.kr";
const SITE = `https://${HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

// public/<key>.txt 에서 키를 자동 검출(키 파일명 == 키).
function findKey() {
  const pub = path.join(process.cwd(), "public");
  const f = fs.readdirSync(pub).find((n) => /^[a-f0-9]{8,128}\.txt$/i.test(n));
  if (!f) return null;
  return { key: f.replace(/\.txt$/i, ""), keyLocation: `${SITE}/${f}` };
}

function collectUrls(argv) {
  const urls = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") {
      const p = argv[++i];
      const txt = fs.readFileSync(p, "utf8");
      urls.push(...txt.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
    } else if (a === "--dry") {
      // handled by caller
    } else if (a.startsWith("http")) {
      urls.push(a.trim());
    }
  }
  // 자기 도메인 + 중복 제거만 허용.
  return [...new Set(urls)].filter((u) => u.startsWith(SITE));
}

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry");
  const keyInfo = findKey();
  if (!keyInfo) {
    console.error("[indexnow] public/<key>.txt 키 파일을 찾지 못했습니다. IndexNow 키를 먼저 생성하세요.");
    process.exit(1);
  }
  const urlList = collectUrls(argv);
  if (urlList.length === 0) {
    console.log("[indexnow] 통보할 URL이 없습니다. 새/변경 URL을 인자나 --file 로 전달하세요 (대량 전송 금지).");
    return;
  }
  if (urlList.length > 500) {
    console.error(`[indexnow] ${urlList.length}개 — 한 번에 너무 많습니다. 새/변경 URL만 소량 전송하세요.`);
    process.exit(1);
  }
  const payload = { host: HOST, key: keyInfo.key, keyLocation: keyInfo.keyLocation, urlList };
  if (dry) {
    console.log("[indexnow] --dry, 전송 안 함. payload:");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  console.log(`[indexnow] ${urlList.length} URL 전송 → HTTP ${res.status} ${res.statusText}`);
  if (res.status >= 400) process.exit(1);
}

main().catch((e) => {
  console.error("[indexnow] 오류:", e?.message || e);
  process.exit(1);
});
