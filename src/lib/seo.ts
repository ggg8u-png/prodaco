import type { KeywordEntry } from "@/data/taxonomy";
import type { FAQ } from "@/types";
import { faqs } from "@/data/faq";
import { clusterLabelOf } from "@/data/regions";
import { FLOOR_COSTS, costKeyOf, perPyeongText } from "@/data/costs";
import { familyKeyOf, itemFactsFor } from "@/data/itemFacts";
import { applyReplacements } from "@/lib/replacements";
import { familyOf, type Family } from "@/lib/contentFamily";

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

// ─── 품목-FAQ 일치 ──────────────────────────────────────────────────────────────
// FAQ 의 services(content/faq.json)가 페이지 품목군과 맞아야만 노출 후보가 된다.
// 마루철거 페이지에 데코타일 본드 FAQ·타일 방수층 FAQ 가 섞여 나오던 문제의 단일 차단점.
// services 누락 FAQ 는 범용("all")으로 간주 — 새 FAQ 를 CMS 에서 추가해도 깨지지 않는다.
export function faqMatchesItem(f: FAQ, item: string | undefined): boolean {
  const services = f.services && f.services.length ? f.services : ["all"];
  if (services.includes("all")) return true;
  if (!item) return false; // 품목 없는 페이지에는 품목 특화 FAQ 를 내보내지 않는다
  return services.includes(familyKeyOf(item));
}

// 페이지별로 관련성 높은 FAQ n개를 고른다 — 품목 일치 풀 안에서 모디파이어 적합
// 절반 + 시드 변형 절반. 같은 4개가 전 페이지에 반복되던 중복 신호를 제거하면서,
// 현재 품목과 무관한 FAQ(예: 마루 페이지의 타일 방수층)는 후보에서 원천 제외한다.
export function pickFaqs(k: KeywordEntry, n = 4): FAQ[] {
  const seed = seedOf(k.slug);
  const allowed = faqs.filter((f) => faqMatchesItem(f, k.item));
  const prefs = preferredCategories(k);
  const preferred = rotate(
    allowed.filter((f) => prefs.includes(f.category)),
    seed
  );
  const chosen: FAQ[] = [];
  const half = Math.max(1, Math.floor(n / 2));
  for (const f of preferred) {
    if (chosen.length >= half) break;
    chosen.push(f);
  }
  const pool = shuffle(seed, allowed.filter((f) => !chosen.includes(f)));
  for (const f of pool) {
    if (chosen.length >= n) break;
    chosen.push(f);
  }
  return chosen;
}

// ─── 고유 메타 설명 (description) ───────────────────────────────────────────────
// 품목·지역·실제 비용·권역을 엮어 페이지마다 다른 설명을 만든다(중복 description 방지).
export function uniqueDescription(k: KeywordEntry, phone: string): string {
  const item = k.item || "바닥재 철거";
  const reg = k.region;
  const cluster = reg && reg !== "수도권" ? clusterLabelOf(reg) : "수도권";
  const row = FLOOR_COSTS.find((r) => r.key === costKeyOf(item));
  const costPhrase = row && row.perPyeong ? `참고가 ${perPyeongText(row)}. ` : "";
  const facts = itemFactsFor(item);

  // 페이지 내용에서 설명을 만든다. 예전에는 판매 문구 3종을 시드로 회전시켜,
  // 지역·품목만 바뀌고 실제 정보는 같은 설명이 1,170개 깔렸다. 지금은
  // itemFacts(그 자재의 실제 철거 특징)를 앞세워 페이지마다 내용이 실제로 다르다.
  //
  // 문구 정책: '당일 상담' 은 뺐다 — settings.responseTimeText 가 "영업시간 내
  // 빠르게 답변드립니다" 라 당일을 보장하지 않는다. 없는 약속을 스니펫에 쓰지 않는다.
  const lead = k.keyword;
  const detail = trimSentence(facts.removal, 60) || trimSentence(facts.attach, 60);
  const where = reg ? `${cluster} 방문 작업. ` : "수도권 방문 작업. ";
  return applyReplacements(`${lead} 안내. ${detail} ${costPhrase}${where}사진으로 가견적, 작업 후 실측 면적 정산 ☎ ${phone}`);
}

/** 문장 하나만 잘라 쓴다(문장 중간에서 끊기지 않게). */
function trimSentence(text: string, max: number): string {
  if (!text) return "";
  const first = text.split(/(?<=\.)\s/)[0] || text;
  return first.length <= max ? first : "";
}


// ─── 고유 타이틀 ───────────────────────────────────────────────────────────────
// 접미(suffix)는 '그 페이지가 답하는 질문'에서 나온다. 시드 회전으로 홍보 문구를
// 돌려 쓰지 않는다 — 그렇게 하면 폐기물처리 페이지에 "평당 참고가 안내"가 붙는
// 식으로 검색 의도와 어긋난다(실측: 정보성 34개 중 10개가 그 상태였다).
//
// 표현 근거:
//   · "10년" 은 content/settings.json 의 experience 값(운영자 입력).
//   · "당일 상담" 은 제거했다. settings.responseTimeText 의 실제 문구는
//     "영업시간 내 빠르게 답변드립니다" 로, 당일을 보장하지 않는다.
//   · 그 밖에 최저가·1위·무료 같은 근거 없는 우월성 표현은 쓰지 않는다.

// 꼬리말(modifier) → 그 페이지가 답하는 질문. 모든 실제 modifier 를 덮는다.
const MODIFIER_SUFFIX: Array<[RegExp, string]> = [
  [/(비용|가격|평당)/, "평당 참고가·실측 정산"],
  [/견적/, "사진 한 장 가견적"],
  [/(방법|순서)/, "작업 순서·체크포인트"],
  [/주의사항/, "미리 확인할 점"],
  [/기간/, "작업 소요 기간 안내"],
  [/폐기물/, "폐자재 반출·처리"],
  [/원상복구/, "인계 기준까지 정리"],
  [/후기/, "실제 상담·작업 기록"],
  [/(업체추천|잘하는곳|전문업체)/, "업체 선택 기준"],
  [/(당일|긴급|빠른)/, "일정 조율 안내"],
  [/저렴/, "비용을 줄이는 조건"],
  [/소량/, "소규모 현장 안내"],
];

// 품목 → 자재/시공 방식 구분. itemFacts.ts 의 BY_ITEM 오버라이드가 뒷받침하는
// 품목만 넣는다(4차에서 확정한 실제 차이). 근거가 없는 품목은 여기 없고,
// 그 경우 접미 없이 담백한 제목을 쓴다 — 억지 수식어를 만들지 않는다.
const ITEM_TITLE_HOOK: Record<string, string> = {
  강마루철거: "접착식·본드 제거까지",
  강화마루철거: "조립(클릭) 구조 분리",
  온돌마루철거: "난방 배관 손상 없이",
  마루철거: "종류별 철거 방식 확인",
  데코타일철거: "조각형·잔여 본드 정리",
  디럭스타일철거: "두꺼운 조각형 철거",
  데코륨철거: "시트형·밑면 잔여 정리",
  륨장판철거: "롤형·밑면 종이까지",
  폴리싱타일철거: "대형 광택 타일 철거",
  에폭시철거: "두꺼운 코팅 연마 철거",
  우레탄철거: "얇은 코팅 연마 철거",
  바닥샌딩: "뜯지 않고 표면 재생",
  면갈이: "철거 후 바닥 평탄화",
  바닥타일철거: "압착 타일 깨내기",
};

export function uniqueTitle(k: KeywordEntry): string {
  if (k.tail) return applyReplacements(`${k.keyword} · ${k.tail}`);
  const m = k.modifier || "";
  // ① 꼬리말이 있으면 그 질문에 맞는 접미가 최우선이다.
  const byModifier = m ? MODIFIER_SUFFIX.find(([re]) => re.test(m))?.[1] : undefined;
  // ② 꼬리말이 없으면(지역×품목 등) 그 자재가 왜 다른지를 접미로 쓴다.
  //    4차에서 본문 핵심 질문을 자재별로 나눴는데, 검색결과에서는 그 차이가 보이지
  //    않아 형제 페이지가 SERP 에서 구분되지 않았다.
  const byItem = k.item ? ITEM_TITLE_HOOK[k.item] : undefined;
  // ③ 위 둘 다 없으면(바닥재철거·바닥철거·장판철거 같은 범용 품목) 접미가 비어
  //    "서울 바닥재철거" 처럼 8자짜리 제목이 나왔다. 검색결과에서 클릭할 이유가 보이지
  //    않고 형제 페이지와도 구분되지 않는다. 품목군과 슬러그로 결정적 접미를 만든다.
  //    (임의 난수가 아니라 슬러그 시드 → 같은 페이지는 언제 빌드해도 같은 제목이다.)
  const byFamily = !byModifier && !byItem ? familyTitleHook(k) : undefined;
  const suffix = byModifier || byItem || byFamily;
  // 레이아웃 title 템플릿(%s | 프로다)이 끝에 ' | 프로다'를 붙이므로 여기선 생략.
  return applyReplacements(suffix ? `${k.keyword} | ${suffix}` : k.keyword);
}

// 품목군별 접미 후보 — 전부 '작업 내용'을 말하는 문구다(과장·보장 표현 없음).
// 같은 품목군 안에서도 슬러그로 갈라져 형제 페이지의 제목이 서로 달라진다.
const FAMILY_TITLE_HOOKS: Record<Family, string[]> = {
  maru: ["종류별 철거와 본드 정리", "하지 손상 없이 철거", "철거 후 바닥 정리까지"],
  vinyl: ["걷어내고 접착제까지 정리", "덧시공 확인 후 철거", "본드 자국 정리 포함"],
  tile: ["몰탈층까지 정리", "타일·하부 몰탈 철거", "철거 후 바닥 높이 확인"],
  coating: ["도막 연삭 제거", "코팅 갈아내고 표면 정리", "재도장 가능 상태까지"],
  sanding: ["표면 평탄화 작업", "잔여 접착제 정리", "다음 마감 전 면 정리"],
  bond: ["남은 접착제 정리", "본드 제거와 표면 정리"],
  generic: ["작업 범위와 비용 기준", "현장 확인부터 정리까지", "철거 후 상태까지 확인"],
};

function titleSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function familyTitleHook(k: KeywordEntry): string {
  const pool = FAMILY_TITLE_HOOKS[familyOf(k.item || "")] ?? FAMILY_TITLE_HOOKS.generic;
  return pool[titleSeed(k.slug) % pool.length];
}

