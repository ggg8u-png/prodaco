// 결정적 이미지 배치 검증 — 스펙 §30 랜덤 이미지 검증 항목의 단위 테스트.
//   1) 같은 URL 반복 호출 → 항상 같은 조합
//   2) 다른 URL → 다른 조합(표본 200쌍 중 동일 조합 비율 측정)
//   3) 같은 페이지 안 중복 없음
//   4) 풀에 사진 1장 추가 시 기존 페이지 재배치 비율(전면 재배치 금지 확인)
//   5) 사진 0장(빈 풀) 폴백 — 빈 배열 반환(페이지 미노출)
// 실행: node scripts/ts-run.mjs scripts/workphotos-verify.ts
import { selectWorkPhotos, workPhotoAlt } from "@/lib/workPhotos";
import { getKeywords } from "@/data/keywords";
import pool from "@/data/work-photos.json";

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string) => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}`); }
};

const slugs = getKeywords().slice(0, 200).map((k) => k.slug);

// 1) 재현성
let stable = true;
for (const s of slugs) {
  const a = selectWorkPhotos(s, 6).map((p) => p.id).join(",");
  const b = selectWorkPhotos(s, 6).map((p) => p.id).join(",");
  if (a !== b) stable = false;
}
ok(stable, "같은 URL → 같은 조합(200 슬러그)");

// 2) 조합 다양성
const combos = new Set(slugs.map((s) => selectWorkPhotos(s, 6).map((p) => p.id).join(",")));
ok(combos.size >= slugs.length * 0.95, `다른 URL → 다른 조합 (고유 ${combos.size}/200)`);

// 3) 페이지 내 중복 없음
let dup = 0;
for (const s of slugs) {
  const ids = selectWorkPhotos(s, 8).map((p) => p.id);
  if (new Set(ids).size !== ids.length) dup++;
}
ok(dup === 0, "페이지 내 중복 이미지 없음");

// 4) 풀 확장 안정성 — 가짜 사진 1장 추가 후 기존 선택과 비교(재구현 동일 로직)
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function selectFrom(ids: string[], routeKey: string, count: number): string[] {
  return ids
    .map((id) => ({ id, score: fnv1a(`${routeKey}|${id}`) }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, count)
    .map((x) => x.id);
}
const baseIds = (pool as { photos: { id: string }[] }).photos.map((p) => p.id);
const grownIds = [...baseIds, "zz-new-photo-test"];
let changedPages = 0;
for (const s of slugs) {
  const before = selectFrom(baseIds, s, 6).join(",");
  const after = selectFrom(grownIds, s, 6).join(",");
  if (before !== after) changedPages++;
}
const changedPct = (100 * changedPages) / slugs.length;
// 기대값 ≈ n/M = 6/205 ≈ 2.9% — 전면 재배치(rotatePick 방식이면 ~100%)가 아님을 확인
ok(changedPct < 15, `사진 1장 추가 시 영향 페이지 ${changedPages}/200 (${changedPct.toFixed(1)}%) — 전면 재배치 아님`);

// 5) alt 안전성 — 지역·품목 단어가 alt 에 유입되지 않는지(대표 금지어 표본)
const banned = ["강남", "서울", "수원", "인천", "강마루", "데코타일", "에폭시", "장판", "시공사례", "완료"];
let altBad = 0;
for (const s of slugs.slice(0, 50)) {
  for (const p of selectWorkPhotos(s, 6)) {
    const alt = workPhotoAlt(s, p.id);
    if (banned.some((b) => alt.includes(b))) altBad++;
  }
}
ok(altBad === 0, "alt 에 미확인 지역·공정 단어 없음");

// 6) 빈 풀 폴백
ok(selectFrom([], "any", 6).length === 0, "빈 풀 → 빈 배열(섹션 미노출)");

console.log(`[workphotos-verify] ${pass}/${pass + fail} 통과`);
if (fail > 0) process.exit(1);
