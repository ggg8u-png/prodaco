import type { KeywordEntry } from "@/data/taxonomy";
import type { FAQ } from "@/types";
import { faqs } from "@/data/faq";
import { clusterLabelOf } from "@/data/regions";
import { FLOOR_COSTS, costKeyOf, perPyeongText } from "@/data/costs";
import { applyReplacements } from "@/lib/replacements";

// ─── 시드 유틸 (페이지별 결정적 변형) ──────────────────────────────────────────
function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function shuffle<T>(seed: number, arr: T[]): T[] {
  const a = arr.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function rotate<T>(arr: T[], seed: number): T[] {
  if (arr.length <= 1) return arr;
  const start = seed % arr.length;
  return [...arr.slice(start), ...arr.slice(0, start)];
}

// ─── 모디파이어/타입 → 선호 FAQ 카테고리 ───────────────────────────────────────
function preferredCategories(k: KeywordEntry): string[] {
  const m = k.modifier || "";
  const item = k.item || "";
  if (String(k.type) === "b2b") return ["B2B", "정산", "일정"];
  if (/(비용|가격|평당)/.test(m)) return ["비용", "정산", "견적"];
  if (m === "견적") return ["견적", "상담", "비용"];
  if (/(추천|잘하는곳|전문업체)/.test(m)) return ["상담", "작업방법", "정산"];
  if (/(방법|순서)/.test(m)) return ["작업방법", "소요시간"];
  if (m === "주의사항") return ["작업방법", "소음"];
  if (m === "기간") return ["소요시간", "일정"];
  if (m === "원상복구") return ["원상복구", "정산"];
  if (/폐기물/.test(m)) return ["폐기물", "작업방법"];
  if (/(당일|긴급|빠른)/.test(m)) return ["일정", "상담"];
  if (/(샌딩|면갈이|마루재생|마루코팅)/.test(item)) return ["샌딩", "작업방법"];
  return ["상담", "비용", "작업방법"];
}

// 페이지별로 관련성 높은 FAQ n개를 고른다 — 모디파이어 적합 2개 + 시드 변형 2개.
// 같은 4개가 전 페이지에 반복되던 중복 신호를 제거한다.
export function pickFaqs(k: KeywordEntry, n = 4): FAQ[] {
  const seed = seedOf(k.slug);
  const prefs = preferredCategories(k);
  const preferred = rotate(
    faqs.filter((f) => prefs.includes(f.category)),
    seed
  );
  const chosen: FAQ[] = [];
  const half = Math.max(1, Math.floor(n / 2));
  for (const f of preferred) {
    if (chosen.length >= half) break;
    chosen.push(f);
  }
  const pool = shuffle(seed, faqs.filter((f) => !chosen.includes(f)));
  for (const f of pool) {
    if (chosen.length >= n) break;
    chosen.push(f);
  }
  return chosen;
}

// ─── 고유 메타 설명 (description) ───────────────────────────────────────────────
// 품목·지역·실제 비용·권역을 엮어 페이지마다 다른 설명을 만든다(중복 description 방지).
export function uniqueDescription(k: KeywordEntry, phone: string): string {
  const seed = seedOf(k.slug);
  const item = k.item || "바닥재 철거";
  const reg = k.region;
  const where = reg ? `${reg} ` : "";
  const cluster = reg && reg !== "수도권" ? clusterLabelOf(reg) : "수도권";
  const ckey = costKeyOf(item);
  const row = FLOOR_COSTS.find((r) => r.key === ckey);
  const costPhrase = row && row.perPyeong ? `참고가 ${perPyeongText(row)}. ` : "";

  // k.keyword 는 페이지마다 유일하므로 앞에 두어 description 중복을 방지한다.
  const kw = k.keyword;
  const variants = [
    `${kw} 전문 업체. ${costPhrase}${where}본드·잔여물까지 정밀 정리해 다음 공정 바로 가능. 실측 면적 정산, 당일 상담. ${cluster} 방문 ☎ ${phone}`,
    `${kw} 어디 맡길지 고민이라면 — ${item} 10년 전문 업체. ${costPhrase}하지 손상 없이 철거하고 실측으로만 정산합니다. ${cluster} 출장 ☎ ${phone}`,
    `${kw} 견적·작업 안내. ${costPhrase}뜯고 끝이 아니라 본드 제거·평탄도까지. 사진 한 장이면 가견적, 실측 정산. ${cluster} ☎ ${phone}`,
  ];
  return applyReplacements(variants[seed % variants.length]);
}

// ─── 고유 타이틀 ───────────────────────────────────────────────────────────────
// 지역+품목(모디파이어 없음) 기본 접미 후보 — 형제 지역 페이지끼리 title 이 겹치지 않도록
// 슬러그 시드로 혜택형 문구를 회전 선택한다. (이전에는 1,170개 region-item 이 모두
// "수도권 바닥재 철거 전문" 한 줄을 공유해 near-duplicate title 신호 + 낮은 CTR 을 유발했다.)
const REGION_ITEM_HOOKS = [
  "실측 정산·당일 상담",
  "본드·잔여물까지 정리",
  "10년 수도권 전문",
  "하지 손상 없이 철거",
  "다음 공정 바로 가능",
  "사진 한 장 가견적",
  "평당 참고가 안내",
];

export function uniqueTitle(k: KeywordEntry): string {
  if (k.tail) return applyReplacements(`${k.keyword} · ${k.tail}`);
  const m = k.modifier || "";
  // 기본(모디파이어 없음)은 시드 회전 훅으로 페이지마다 다른 접미를 준다.
  let suffix = REGION_ITEM_HOOKS[seedOf(k.slug) % REGION_ITEM_HOOKS.length];
  if (/(비용|가격|평당)/.test(m)) suffix = "평당 참고가·실측 정산";
  else if (m === "견적") suffix = "사진 한 장 가견적";
  else if (/(추천|잘하는곳|전문업체)/.test(m)) suffix = "10년 전문 비교 안내";
  else if (/(방법|순서|주의사항)/.test(m)) suffix = "작업 순서·체크포인트";
  else if (/(샌딩|면갈이)/.test(k.item || "")) suffix = "면갈이·정밀 샌딩 전문";
  // 레이아웃 title 템플릿(%s | 프로다)이 끝에 ' | 프로다'를 붙이므로 여기선 생략.
  return applyReplacements(`${k.keyword} | ${suffix}`);
}
