// 콘텐츠 프로파일 — 페이지마다 '문서 구조 자체'를 다르게 만든다.
//
// 동의어만 바꾸는 다양화는 금방 들통난다. 지역명만 바뀌고 나머지가 같은 페이지를
// 실제로 막으려면 섹션의 **구성과 순서**가 달라져야 한다. 여기서 그 배치를 정의한다.
//
// 선택은 슬러그 기반 결정적 배정이다 — 같은 페이지는 언제 빌드해도 같은 프로파일이라
// 빌드마다 문서가 흔들리지 않는다(그 자체가 품질 신호를 해친다).
//
// 섹션 키는 lib/content.ts 의 섹션 빌더와 1:1로 대응한다.

export type SectionKey =
  | "itemCore" // 품목 핵심(가장 품목색이 강한 블록)
  | "definition" // 이 작업이 무엇인가
  | "process" // 작업 순서
  | "checklist" // 견적·작업 전 확인사항
  | "costFactors" // 비용이 갈리는 요소
  | "modifier" // 검색 수식어(비용·방법·업체 등) 대응 블록
  | "value" // 우리 작업 기준
  | "regionOps" // 지역 운영 안내
  | "aftercare" // 작업 후 정리
  | "faq" // 자주 묻는 질문
  | "related" // 관련 작업
  | "extra"; // 보조 안내(풀에서 시드로 선택)

export interface ContentProfile {
  id: string;
  /** 본문 섹션 배치 순서. 앞에서부터 이 순서로 렌더된다. */
  order: SectionKey[];
  /** extra 풀에서 몇 개를 섞어 넣을지. */
  extraCount: number;
}

// 6종 — 도입부 다음의 전개가 서로 다르다.
// (비용을 먼저 말하는 구성 / 작업 순서를 먼저 보여주는 구성 / 체크리스트로 시작하는 구성 …)
export const CONTENT_PROFILES: ContentProfile[] = [
  {
    id: "A", // 작업 이해 → 비용 → 검증
    order: ["itemCore", "definition", "process", "costFactors", "modifier", "value", "faq", "regionOps", "related", "extra", "aftercare"],
    extraCount: 3,
  },
  {
    id: "B", // 견적 준비부터 — 상담 직전 검색 의도에 맞춘 구성
    order: ["itemCore", "checklist", "costFactors", "process", "modifier", "faq", "value", "regionOps", "aftercare", "extra", "related"],
    extraCount: 3,
  },
  {
    id: "C", // 작업 특성 중심 — 무엇이 다른지부터
    order: ["definition", "itemCore", "process", "checklist", "modifier", "regionOps", "costFactors", "faq", "related", "extra", "aftercare"],
    extraCount: 4,
  },
  {
    id: "D", // 비용 질문형 — 비용 요소를 앞에 두고 근거를 뒤에 붙인다
    order: ["itemCore", "costFactors", "modifier", "definition", "checklist", "process", "faq", "aftercare", "value", "regionOps", "extra"],
    extraCount: 3,
  },
  {
    id: "E", // 절차 안내형 — 순서를 먼저 보여주고 확인사항으로 마무리
    order: ["itemCore", "process", "aftercare", "checklist", "modifier", "costFactors", "regionOps", "faq", "extra", "value", "related"],
    extraCount: 4,
  },
  {
    id: "F", // 지역 서비스 안내형 — 지역 운영 안내를 앞쪽에 배치
    order: ["itemCore", "regionOps", "definition", "checklist", "process", "modifier", "costFactors", "faq", "related", "aftercare", "extra"],
    extraCount: 3,
  },
];

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 이 슬러그가 쓸 콘텐츠 프로파일(결정적). */
export function profileForSlug(slug: string): ContentProfile {
  return CONTENT_PROFILES[seedOf(slug) % CONTENT_PROFILES.length];
}
