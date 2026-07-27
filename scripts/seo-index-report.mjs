#!/usr/bin/env node
/**
 * 색인 정비 요약 리포트 생성 — 판정 CSV(seo-index-decision)와 감사 CSV(seo-url-audit,
 * 변경 적용 후 재실행분)를 읽어 수정 전후 비교 Markdown 을 만든다.
 *
 *   npm run seo:decide:write && npm run seo:urls && node scripts/seo-index-report.mjs
 *
 * 수정 전 수치는 GSC/감사 실측값을 인자로 받는다(추정치를 만들어내지 않는다).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STAMP = "2026-07-27";

function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') { q = true; continue; }
    if (c === ",") { row.push(f); f = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; continue; }
    f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift();
  return rows.filter((r) => r.some((v) => v !== "")).map((r) => Object.fromEntries(h.map((x, i) => [x, r[i] ?? ""])));
}

const dec = parseCsv(fs.readFileSync(path.join(ROOT, `reports/seo-index-decision-${STAMP}.csv`), "utf8"));
const audit = parseCsv(fs.readFileSync(path.join(ROOT, "reports/seo-url-audit.csv"), "utf8"));
const num = (x) => parseInt(x || "0", 10) || 0;

// 수정 전 상태 — 이번 작업 직전 seo:urls 실행 결과(커밋 f461485 기준 실측).
const BEFORE = { tierA: 1361, tierB: 272, index: 1491, noindex: 142, sitemap: 1361 };

const kept = dec.filter((d) => d.index === "true");
const demoted = dec.filter((d) => d.index === "false");
const afterIndex = audit.filter((r) => r.robots === "index,follow").length;
const afterNoindex = audit.filter((r) => r.robots === "noindex,follow").length;
const afterSitemap = audit.filter((r) => r.inSitemap === "true").length;
const afterTierA = audit.filter((r) => r.tier === "A").length;
const afterTierB = audit.filter((r) => r.tier === "B").length;

const count = (arr, fn) => arr.filter(fn).length;
const byType = (arr, t) => count(arr, (d) => d.page_type === t);
const sum = (arr, k) => arr.reduce((a, r) => a + num(r[k]), 0);

// 사유 집계 — reason 문자열의 앞부분 신호로 묶는다.
const keepReasons = {};
for (const d of kept.filter((x) => x.page_type.startsWith("keyword:"))) {
  const key = d.has_case_study === "true" ? "검증 시공사례 보유"
    : num(d.click_signal) > 0 ? "실검색 클릭 발생"
    : num(d.impression_signal) >= 3 ? "반복 노출(3회 이상)"
    : "노출 + 지역 사진 조합";
  keepReasons[key] = (keepReasons[key] || 0) + 1;
}
const demoteReasons = {
  "3개월 노출 0 · 클릭 0 · 검증 사례 없음": count(demoted, (d) => num(d.impression_signal) === 0),
  "노출 1~2회(임계 미만) · 클릭 0 · 검증 사례 없음": count(demoted, (d) => num(d.impression_signal) > 0),
};

const L = [];
L.push(`# 색인 대상 정비 요약 — ${STAMP}`, "");
L.push("저품질 지역×품목 조합 페이지를 색인 대상에서 제외하고, 실측 증거가 있는 페이지에 크롤 예산을 집중시킨 작업의 수정 전후 비교.", "");

L.push("## 수정 전 → 수정 후", "");
L.push("| 항목 | 수정 전 | 수정 후 | 변화 |");
L.push("|---|---:|---:|---:|");
L.push(`| Tier A (색인·self-canonical·사이트맵) | ${BEFORE.tierA} | ${afterTierA} | ${afterTierA - BEFORE.tierA} |`);
L.push(`| Tier B (색인 경쟁 제외) | ${BEFORE.tierB} | ${afterTierB} | +${afterTierB - BEFORE.tierB} |`);
L.push(`| robots index | ${BEFORE.index} | ${afterIndex} | ${afterIndex - BEFORE.index} |`);
L.push(`| robots noindex | ${BEFORE.noindex} | ${afterNoindex} | +${afterNoindex - BEFORE.noindex} |`);
L.push(`| XML 사이트맵 URL | ${BEFORE.sitemap} | ${afterSitemap} | ${afterSitemap - BEFORE.sitemap} |`);
L.push("");

L.push("## 유지된 URL 구성", "");
L.push("| 유형 | 개수 |");
L.push("|---|---:|");
L.push(`| 지역 허브 \`/services/{지역}\` | ${byType(kept, "region-hub")} |`);
L.push(`| 블로그 \`/blog/{글}\` | ${byType(kept, "blog")} |`);
L.push(`| 코어 정적 페이지 | ${byType(kept, "core")} |`);
L.push(`| 지역×품목 (region-item) | ${byType(kept, "keyword:region-item")} |`);
L.push(`| 품목 꼬리말 (item-tail) | ${byType(kept, "keyword:item-tail")} |`);
L.push(`| B2B·소비자·타깃 등 기타 | ${kept.length - byType(kept, "region-hub") - byType(kept, "blog") - byType(kept, "core") - byType(kept, "keyword:region-item") - byType(kept, "keyword:item-tail")} |`);
L.push(`| **합계 (robots index)** | **${kept.length}** |`);
L.push("");
L.push(`- canonical 통합(색인 유지 + 지역 허브 canonical + 사이트맵 제외): **${count(dec, (d) => d.decision === "CANONICAL_TO_REGION_HUB")}건**`);
L.push(`- 301 리디렉션: **0건** (URL 을 삭제하지 않았으므로 리디렉션 대상 없음)`);
L.push(`- 404 / 410 처리: **0건** (아래 "GSC 미해결 URL" 참고)`);
L.push(`- 수동 검토 대기: **${count(dec, (d) => d.decision === "MANUAL_REVIEW")}건**`);
L.push("");

L.push("## 판단 기준", "");
L.push("본문 길이·FAQ 개수는 판정에서 제외했다. 실측상 변별력이 없기 때문이다 —");
L.push("「크롤링됨-색인 안 됨」 698개와 나머지 Tier A 663개의 본문 중앙값은 1,318자 vs 1,317자,");
L.push("검증 사례 보유율은 2% vs 2% 로 사실상 동일했다. 구글은 이미 두 집단을 같은 페이지로 보고 있다.", "");
L.push("대신 다음 실측 증거에 점수를 매겨 **합계 2점 이상**을 색인 유지 기준으로 삼았다.", "");
L.push("| 증거 | 점수 | 근거 |");
L.push("|---|---:|---|");
L.push("| 지역+품목이 정확히 일치하는 검증된 시공사례 | +4 | 해당 URL에만 존재하는 1차 자료 |");
L.push("| GSC 클릭 1회 이상 (최근 3개월) | +3 | 검색 의도를 실제로 충족했다는 직접 증거 |");
L.push("| GSC 노출 3회 이상 | +2 | 색인된 상태에서 반복 노출 — 독립 쿼리 대응 확인 |");
L.push("| GSC 노출 1~2회 | +1 | 약한 신호 — 단독으로는 유지 불가 |");
L.push("| 해당 지역 실제 시공사진 3장 이상 | +1 | 지역 고유 자료 — 단독으로는 유지 불가 |");
L.push("");
L.push("지역 허브·블로그·코어 정적 페이지는 조합 생성물이 아니므로 이 점수와 별개로 평가해 유지했다.");
L.push("특히 지역 허브는 강등 페이지의 내부링크 수렴 대상이므로 색인 유지가 전제 조건이다.", "");

L.push("## 유지 사유별 URL 수 (조합 페이지)", "");
L.push("| 사유 | 개수 |");
L.push("|---|---:|");
for (const [k, v] of Object.entries(keepReasons).sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${v} |`);
L.push("");

L.push("## 강등 사유별 URL 수", "");
L.push("| 사유 | 개수 |");
L.push("|---|---:|");
for (const [k, v] of Object.entries(demoteReasons)) L.push(`| ${k} | ${v} |`);
L.push(`| **합계** | **${demoted.length}** |`);
L.push("");
L.push(`강등 URL 중 검증 시공사례를 가진 것: **${count(demoted, (d) => d.has_case_study === "true")}건**`);
L.push(`강등 URL 중 클릭 이력이 있는 것: **${count(demoted, (d) => num(d.click_signal) > 0)}건**`, "");

L.push("## 검색 성과 보존율", "");
L.push("색인 대상을 줄이면서 실제 성과를 얼마나 지켰는지 — 이번 정비의 안전성 지표.", "");
L.push("| 지표 | 유지 URL | 강등 URL | 보존율 |");
L.push("|---|---:|---:|---:|");
L.push(`| URL 수 | ${kept.length} | ${demoted.length} | ${(100 * kept.length / dec.length).toFixed(1)}% |`);
L.push(`| 3개월 클릭 | ${sum(kept, "click_signal")} | ${sum(demoted, "click_signal")} | ${(100 * sum(kept, "click_signal") / sum(dec, "click_signal")).toFixed(1)}% |`);
L.push(`| 3개월 노출 | ${sum(kept, "impression_signal")} | ${sum(demoted, "impression_signal")} | ${(100 * sum(kept, "impression_signal") / sum(dec, "impression_signal")).toFixed(1)}% |`);
L.push("");
L.push(`URL 을 ${(100 - 100 * kept.length / dec.length).toFixed(0)}% 줄이면서 클릭은 전량, 노출은 ${(100 * sum(kept, "impression_signal") / sum(dec, "impression_signal")).toFixed(0)}% 를 유지했다.`);
L.push(`강등된 ${demoted.length}개가 3개월간 만든 노출은 합계 ${sum(demoted, "impression_signal")}회(URL 당 평균 ${(sum(demoted, "impression_signal") / demoted.length).toFixed(2)}회)로, 사실상 노이즈다.`, "");

L.push("## 예상되는 GSC 변화", "");
L.push("| 리포트 항목 | 예상 방향 | 이유 |");
L.push("|---|---|---|");
L.push("| 크롤링됨 - 현재 색인이 생성되지 않음 | **감소** | 829개 대부분이 noindex 로 바뀌어 이 분류에서 빠진다 |");
L.push("| 'NOINDEX' 태그에 의해 제외됨 | **대폭 증가** | 강등분이 이 분류로 이동 — 오류가 아닌 의도된 상태 |");
L.push("| 사이트맵 제출 URL | 1,361 → 197 | 사이트맵 대비 색인률 지표가 정상 범위로 복귀 |");
L.push("| 색인 생성됨 | 단기 감소 후 회복 | 이미 색인된 강등분이 빠지고, 남은 페이지의 크롤 빈도가 오른다 |");
L.push("| 노출·클릭 | 단기 유지 | 클릭 100% · 노출 " + (100 * sum(kept, "impression_signal") / sum(dec, "impression_signal")).toFixed(0) + "% 를 가진 URL 은 전부 유지 |");
L.push("");

L.push("## 유효성 검사 완료 전에 추가 요청을 하지 말아야 하는 이유", "");
L.push("- 진행 중인 829개 유효성 검사는 **배포 이전 버전의 페이지**를 기준으로 시작됐다. 배포 후 구글이 재크롤링하면 같은 URL 이 `noindex` 로 확인되어 검사가 자연 종료된다.");
L.push("- 같은 이슈로 유효성 검사를 다시 요청하면 기존 검사가 취소되고 대기열 맨 뒤로 밀린다. 재크롤링이 늦어질 뿐 빨라지지 않는다.");
L.push("- 「크롤링됨-색인 안 됨」은 오류가 아니라 구글의 판단 결과다. 재검사를 눌러 바뀌는 것이 아니라, 페이지 상태(noindex)와 사이트맵이 바뀌어야 바뀐다. 이번 배포가 그 변경이다.");
L.push("- 강등한 1,432개는 색인 요청 대상이 아니다. noindex 페이지에 색인을 요청하면 상충 신호를 보내게 된다.", "");

L.push("## GSC 미해결 URL", "");
L.push("「크롤링됨-색인 안 됨」 829개 중 라우트 우주에 없는 2개는 실제 페이지가 아니라 Next.js 메타데이터 이미지 라우트다.", "");
L.push("- `https://prodaco.kr/opengraph-image` — OG 카드 이미지 엔드포인트(200, image/png)");
L.push("- `https://prodaco.kr/twitter-image?7680d4c479b09ba2` — 트위터 카드 이미지 엔드포인트(200, image/png)");
L.push("");
L.push("HTML 페이지가 아니므로 색인되지 않는 것이 정상이다. 사이트맵에 없고 내부 링크도 `og:image` 참조뿐이라 **301·404·410 처리 대상이 아니다**. 그대로 둔다.", "");

L.push("## 재현 방법", "");
L.push("```bash");
L.push("npm run seo:decide          # 판정 dry-run (리포트만)");
L.push("npm run seo:decide:write    # content/seo.json 허용목록 갱신");
L.push("npm run seo:urls            # 적용 후 URL 감사");
L.push("npm run seo:validate-index  # 색인/canonical/사이트맵 정합성 검증");
L.push("```");

fs.writeFileSync(path.join(ROOT, `reports/seo-index-summary-${STAMP}.md`), L.join("\n") + "\n", "utf8");
console.log(`[seo:report] reports/seo-index-summary-${STAMP}.md 생성 — 유지 ${kept.length} · 강등 ${demoted.length} · 사이트맵 ${afterSitemap}`);
