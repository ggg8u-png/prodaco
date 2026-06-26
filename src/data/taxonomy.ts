// Keyword taxonomy / component lists.
//
// NOTE: src/data/keywords.json is the LIVE source of truth for the generated
// keyword pages (loaded via src/data/keywords.ts). The arrays below mirror the
// spreadsheet's "구성요소(수정용)" section so future manual additions to the
// keyword set stay aligned with the owner's component vocabulary.
// `generateKeywords()` remains as a secondary helper for ad-hoc generation.

// ① 지역 (품목 앞에 붙음) — 출장 가능 지역
export const regions = [
  "서울", "경기", "인천", "수도권",
  "강남", "서초", "송파", "강동", "강서", "양천", "영등포", "구로",
  "금천", "동작", "관악", "마포", "서대문", "은평", "용산", "성동",
  "광진", "동대문", "중랑", "성북", "강북", "노원", "도봉", "중구",
  "수원", "성남", "용인", "화성", "동탄", "부천", "안산", "안양",
  "시흥", "김포", "광명", "군포", "오산", "의왕", "하남", "의정부",
  "남양주", "구리", "고양", "파주", "부평", "계양", "남동구", "서구",
  "연수구", "미추홀구", "송도", "일산", "운정", "위례", "판교", "평촌",
  "산본", "광교", "양주", "동두천", "과천",
];

// ② 품목 — 철거
export const itemsDemo = [
  "강마루철거", "강화마루철거", "데코륨철거", "데코타일철거",
  "륨장판철거", "마루철거", "바닥재철거", "바닥철거",
  "바닥타일철거", "에폭시철거", "우레탄철거", "온돌마루철거",
  "장판철거", "타일철거", "폴리싱타일철거", "디럭스타일철거",
];

// ③ 품목 — 샌딩(부가)
export const itemsSanding = [
  "바닥샌딩", "강바닥샌딩", "원목바닥샌딩", "무대바닥샌딩",
  "체육관바닥샌딩", "마루재생", "마루코팅", "면갈이", "바닥샌딩",
];

// ④ 동의어·표현 (제거 / 뜯기)
export const synonyms = [
  "마루제거", "바닥재제거", "마루뜯기", "장판제거", "마루걷어내기",
  "본드제거", "강마루제거", "에폭시제거", "우레탄제거",
];

// ⑤ 꼬리말 — 뒤에 붙음 (롱테일)
export const tailsBack = [
  "비용", "가격", "견적", "평당비용", "평당가격", "잘하는곳",
  "업체추천", "추천", "후기", "전문업체", "주의사항", "방법",
  "순서", "기간", "원상복구", "폐기물처리", "폐기물수거", "평당단가",
];

// ⑥ 수식어 — 앞에 붙음
export const tailsFront = [
  "저렴한", "당일", "소량", "긴급", "빠른",
];

export interface KeywordEntry {
  slug: string;
  keyword: string;
  type: string;
  region?: string;
  item?: string;
  modifier?: string;
  tail?: string; // 선택적 꼬리 문구 — hero 강조 + title suffix로 사용
}

function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w가-힣-]/g, "");
}

// Secondary helper for ad-hoc keyword generation from the component lists above.
// The live keyword set lives in keywords.json (see src/data/keywords.ts).
export function generateKeywords(): KeywordEntry[] {
  const entries: KeywordEntry[] = [];
  const seen = new Set<string>();

  function add(entry: KeywordEntry) {
    if (!seen.has(entry.slug)) {
      seen.add(entry.slug);
      entries.push(entry);
    }
  }

  // Base items without region
  for (const item of [...itemsDemo, ...itemsSanding]) {
    add({ slug: toSlug(item), keyword: item, type: "item", item });
  }

  // Region + item combinations
  for (const region of regions) {
    for (const item of [...itemsDemo, ...itemsSanding]) {
      const keyword = `${region} ${item}`;
      add({ slug: toSlug(keyword), keyword, type: "region-item", region, item });
    }
  }

  // Item + tail modifier
  for (const item of [...itemsDemo, ...itemsSanding]) {
    for (const tail of tailsBack) {
      const keyword = `${item} ${tail}`;
      add({ slug: toSlug(keyword), keyword, type: "item-tail", item, modifier: tail });
    }
  }

  // Front modifier + item
  for (const front of tailsFront) {
    for (const item of [...itemsDemo, ...itemsSanding]) {
      const keyword = `${front} ${item}`;
      add({ slug: toSlug(keyword), keyword, type: "item-tail", item, modifier: front });
    }
  }

  // Synonym expressions
  for (const synonym of synonyms) {
    add({ slug: toSlug(synonym), keyword: synonym, type: "synonym", item: synonym });
  }

  return entries;
}
