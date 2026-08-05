#!/usr/bin/env node
/**
 * content/lastmod.json 생성 — 사이트맵 lastmod 를 "실제 콘텐츠가 바뀐 날"에서 뽑는다.
 *
 *   node scripts/build-lastmod.mjs          # 생성(빌드 전 자동 실행)
 *   node scripts/build-lastmod.mjs --print  # 생성하지 않고 계산 결과만 출력
 *
 * 왜 필요한가:
 *   기존에는 모든 URL 이 고정 상수 SITE_LASTMOD(2026-06-23) 를 lastmod 로 내보냈다.
 *   7/24~7/31 에 콘텐츠 품질 정비·시공사례 추가·수동 색인 승인이 이어졌는데도
 *   사이트맵은 계속 "6/23 이후 바뀐 것 없음"을 알리고 있었다 — 구글 입장에서는
 *   재크롤할 이유가 없는 상태였다(GSC 색인 139 고정, 발견됨-미색인 147).
 *
 * 원칙(고정 상수를 쓴 원래 의도는 그대로 지킨다):
 *   · 빌드할 때마다 날짜가 바뀌면 안 된다 → mtime·now() 를 쓰지 않고 git 커밋 날짜를 쓴다.
 *     같은 커밋을 다시 빌드하면 항상 같은 값이 나온다(결정적).
 *   · 콘텐츠가 실제로 바뀐 페이지만 날짜가 올라간다 → 거짓 신선도 신호를 만들지 않는다.
 *   · git 을 못 쓰는 환경이면 파일을 만들지 않는다 → sitemap.ts 가 SITE_LASTMOD 로 폴백한다.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "content", "lastmod.json");
const PRINT_ONLY = process.argv.includes("--print");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 주어진 경로들을 마지막으로 건드린 커밋 날짜(YYYY-MM-DD). 없으면 "". */
function gitDate(paths) {
  const existing = paths.filter((p) => fs.existsSync(path.join(ROOT, p)));
  if (!existing.length) return "";
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", ...existing], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return DATE_RE.test(out) ? out : "";
  } catch {
    return "";
  }
}

/** 날짜 문자열 중 가장 최신(빈 값은 무시). */
function maxDate(...dates) {
  return dates.filter((d) => d && DATE_RE.test(d)).sort().pop() || "";
}

// ─── 페이지 종류별 입력 파일 ────────────────────────────────────────────────────
// "그 페이지에 실리는 내용" 을 정하는 데이터 파일만 넣는다.
// 라우트 템플릿(src/app/**)·스타일은 일부러 뺐다 — 레이아웃만 손봐도 페이지 118개가
// 통째로 "수정됨" 으로 올라가면 그게 바로 만들지 말아야 할 거짓 신선도 신호다.
const CORE_INPUTS = [
  "content/home.json",
  "content/company.json",
  "content/faq.json",
  "content/costs.json",
  "content/reviews.json",
  "content/landing.json",
  "content/ui.json",
  "content/replacements.json",
];

const KEYWORD_INPUTS = [
  "src/data/keywords.json",
  "src/data/keywords.ts",
  "src/data/taxonomy.ts",
  "src/data/comboProfiles.ts",
  "src/data/itemFacts.ts",
  "src/data/keyAnswer.ts",
  "content/seo.json",
];

const HUB_INPUTS = ["src/data/regions.ts", "content/seo.json"];

// 시공사례·작업사진 — 지역(및 지역×품목) 단위로 개별 페이지의 실제 갱신일이 된다.
const GALLERY_DIR = path.join(ROOT, "content", "gallery");
const PHOTOS_INPUTS = ["src/data/work-photos.json", "content/photos"];

function galleryDates() {
  const regions = {};
  const slugs = {};
  let files = [];
  try {
    files = fs.readdirSync(GALLERY_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return { regions, slugs };
  }
  for (const f of files) {
    const rel = path.posix.join("content", "gallery", f);
    const date = gitDate([rel]);
    if (!date) continue;
    let g;
    try {
      g = JSON.parse(fs.readFileSync(path.join(GALLERY_DIR, f), "utf8"));
    } catch {
      continue;
    }
    const region = typeof g?.region === "string" ? g.region.trim() : "";
    const item = typeof g?.item === "string" ? g.item.trim() : "";
    if (!region) continue;
    regions[region] = maxDate(regions[region], date);
    // 지역×품목 조합 페이지 슬러그(예: 구리-데코타일철거)와 정확히 대응한다.
    if (item) {
      const slug = `${region}-${item.replace(/\s+/g, "")}`;
      slugs[slug] = maxDate(slugs[slug], date);
    }
  }
  return { regions, slugs };
}

// ─── 산출 ──────────────────────────────────────────────────────────────────────
const core = gitDate(CORE_INPUTS);
const keywords = gitDate(KEYWORD_INPUTS);
const photos = gitDate(PHOTOS_INPUTS);
const { regions, slugs } = galleryDates();
// 지역 허브는 그 지역 사례·사진이 늘면 실제로 내용이 바뀐다.
const hubs = maxDate(gitDate(HUB_INPUTS), photos);

const map = {
  // 사람이 파일만 열어봐도 무엇인지 알게 적어 둔다(빌드 산출물이라 커밋되지 않음).
  _note: "scripts/build-lastmod.mjs 가 git 커밋 날짜에서 생성 — 직접 수정하지 말 것",
  core,
  keywords,
  hubs,
  regions,
  slugs,
};

const anyDate = maxDate(core, keywords, hubs, ...Object.values(regions), ...Object.values(slugs));

if (PRINT_ONLY) {
  console.log(JSON.stringify(map, null, 2));
} else if (!anyDate) {
  // git 을 못 읽는 환경 — 파일을 만들지 않고 SITE_LASTMOD 폴백에 맡긴다.
  console.log("[lastmod] git 커밋 날짜를 읽지 못했습니다 — SITE_LASTMOD 폴백을 사용합니다");
} else {
  fs.writeFileSync(OUT, JSON.stringify(map, null, 2) + "\n");
  console.log(
    `[lastmod] content/lastmod.json 생성 — core ${core || "-"} · keywords ${keywords || "-"} · hubs ${hubs || "-"} · 지역 ${Object.keys(regions).length}개 · 조합 ${Object.keys(slugs).length}개`
  );
}
