// 지역×품목 페이지 본문용 FAQ 풀.
//
// 왜 풀인가: 전 페이지가 같은 FAQ 3~4개를 쓰면 그 자체가 "지역명만 바꾼 페이지" 신호다.
// 주제(비용·기간·폐기물·소음·분진·본드·샌딩·견적방법·현장확인)별로 후보를 두고,
// 슬러그 시드로 결정적으로 골라 페이지마다 조합이 달라지게 한다.
//
// 두 가지를 지킨다:
//   · 품목에 맞지 않는 질문은 후보에서 제외한다(샌딩 페이지에 "타일 방수층" 질문 금지).
//   · 답변에 숫자를 넣지 않는다. 실제 단가는 content/costs.json(운영자 관리값)에서만 나온다.
import type { KeywordEntry } from "@/data/taxonomy";
import { familyOf, type Family } from "@/lib/contentFamily";
import { itemKnowledgeFor } from "@/data/itemKnowledge";
import { josa } from "@/lib/josa";

export interface FaqSeed {
  topic: string;
  q: (item: string, region: string) => string;
  a: (item: string, region: string) => string;
  /** 적용 품목군. 비우면 전 품목. */
  families?: Family[];
}

const POOL: FaqSeed[] = [
  {
    topic: "비용",
    q: (item, region) => `${region} ${item} 비용은 어떻게 정해지나요?`,
    a: (item) =>
      `면적, 기존 바닥재의 부착 방식, 잔여 접착제 제거 범위, 폐자재 양과 반출 동선에 따라 달라집니다. 사진과 대략적인 면적을 알려주시면 1차 안내를 드리고, 최종 금액은 실측 면적을 기준으로 정산합니다.`,
  },
  {
    topic: "견적방법",
    q: (item) => `사진만 보내도 ${item} 견적이 되나요?`,
    a: () =>
      `바닥이 보이는 사진 두세 장과 대략적인 면적이면 1차 안내가 가능합니다. 현장 조건이 특수하거나 면적이 큰 경우에는 방문 확인 후 안내드립니다.`,
  },
  {
    topic: "기간",
    q: (item) => `${item} 작업은 얼마나 걸리나요?`,
    a: () =>
      `면적과 부착 방식, 반출 동선에 따라 달라집니다. 일정이 정해져 있으시면 미리 알려주세요. 후속 공정 날짜에 맞춰 작업 범위를 조율합니다.`,
  },
  {
    topic: "폐기물",
    q: () => `철거하고 나온 폐자재도 함께 처리해 주시나요?`,
    a: () =>
      `걷어낸 자재를 분리해 현장 지정 위치로 반출합니다. 양과 건물 규정에 따라 처리 방법이 달라질 수 있어, 상담 때 반출 동선을 함께 확인합니다.`,
  },
  {
    topic: "본드",
    q: (item) => `${item} 후에 바닥에 남는 접착제도 제거되나요?`,
    a: () =>
      `마감재를 걷어내는 것과 접착제를 정리하는 것은 별개의 작업량입니다. 어느 수준까지 정리할지 미리 정해두면 견적과 결과가 어긋나지 않습니다.`,
    families: ["maru", "vinyl", "bond", "generic"],
  },
  {
    topic: "샌딩",
    q: () => `철거 후 샌딩까지 이어서 가능한가요?`,
    a: () =>
      `가능합니다. 다음에 올라갈 마감재에 따라 필요한 평탄도가 달라지므로, 어떤 마감을 계획 중이신지 알려주시면 그 기준에 맞춰 진행합니다.`,
    families: ["maru", "vinyl", "bond", "tile", "generic"],
  },
  {
    topic: "소음",
    q: () => `작업 중 소음은 어느 정도인가요?`,
    a: () =>
      `장비를 쓰는 구간에서는 소음이 발생합니다. 공동주택이나 상가는 관리 규정에 따라 가능한 시간대가 정해져 있는 경우가 많아, 미리 확인해 일정에 반영합니다.`,
  },
  {
    topic: "분진",
    q: () => `분진은 어떻게 관리하나요?`,
    a: () =>
      `연삭·절단 구간에서 분진이 발생합니다. 인접 공간으로 퍼지지 않도록 구획하고 집진하며, 작업 후 정리까지 포함해 진행합니다.`,
    families: ["tile", "coating", "sanding", "bond", "generic"],
  },
  {
    topic: "현장확인",
    q: (region) => `방문 확인 없이 바로 작업 가능한가요?`,
    a: () =>
      `사진으로 판단이 되는 현장은 바로 일정 잡고 진행합니다. 부착 방식이 불분명하거나 면적이 큰 경우에는 방문 확인 후 진행하는 편이 서로 안전합니다.`,
  },
  {
    topic: "철거후상태",
    q: (item) => `${item} 후 바닥은 어떤 상태가 되나요?`,
    a: (item) => itemKnowledgeFor(item).aftercare,
  },
  {
    topic: "난방배관",
    q: () => `난방 배관이 손상될 위험은 없나요?`,
    a: () =>
      `배관이 지나는 바닥은 철거 깊이를 제한해 진행합니다. 배관 위치와 매립 깊이를 먼저 확인하고, 속도보다 손상 최소화를 기준으로 작업합니다.`,
    families: ["maru"],
  },
  {
    topic: "방수층",
    q: () => `욕실·발코니는 방수층을 살릴 수 있나요?`,
    a: () =>
      `방수층을 보존해야 하는 구간은 철거 깊이를 조절해 진행합니다. 다만 기존 방수 상태에 따라 재시공이 필요할 수 있어, 확인 후 안내드립니다.`,
    families: ["tile"],
  },
  {
    topic: "도막",
    q: () => `도막이 두꺼운데 완전히 제거되나요?`,
    a: () =>
      `연삭 장비와 디스크를 도막 두께에 맞춰 선정합니다. 하지 상태에 따라 갈아낼 수 있는 깊이가 정해지므로, 요구되는 표면 상태를 먼저 확인합니다.`,
    families: ["coating"],
  },
  {
    topic: "평탄도",
    q: () => `평탄도는 어느 수준까지 맞출 수 있나요?`,
    a: () =>
      `다음에 올라갈 마감재가 요구하는 기준에 맞춥니다. 마감재마다 허용 단차가 다르기 때문에, 계획 중인 마감을 알려주시면 그에 맞춰 진행합니다.`,
    families: ["sanding", "bond"],
  },
  {
    topic: "가구",
    q: () => `가구나 집기가 있어도 작업이 되나요?`,
    a: () =>
      `이동 가능한 물건만 미리 빼주시면 나머지는 정리한 뒤 진행합니다. 고정된 집기가 있으면 상담 때 알려주세요.`,
  },
  {
    topic: "지역",
    q: (item, region) => `${region}도 방문 가능한가요?`,
    a: (item, region) =>
      `${josa(region, "을를")} 포함한 서울·경기·인천 수도권 전역에서 진행합니다. 위치와 층수, 엘리베이터 유무를 알려주시면 반출 동선까지 함께 확인해 안내드립니다.`,
  },
];

function seedIdx(seed: number, salt: number, len: number): number {
  return len ? (seed + salt * 2654435761) % len : 0;
}

/** 이 페이지에 쓸 FAQ 항목(질문·답변) — 화면과 FAQPage 스키마가 이 결과를 함께 쓴다. */
export function faqItemsFor(k: KeywordEntry, seed: number, count = 4): Array<{ q: string; a: string }> {
  const item = k.item || "바닥재 철거";
  const region = k.region || "수도권";
  const fam = familyOf(item);
  const eligible = POOL.filter((f) => !f.families || f.families.includes(fam));
  // 시드로 시작점을 정하고 순차 선택 — 형제 페이지끼리 조합이 겹치지 않게 한다.
  const start = seedIdx(seed, 13, eligible.length);
  const out: Array<{ q: string; a: string }> = [];
  for (let i = 0; i < eligible.length && out.length < count; i++) {
    const f = eligible[(start + i) % eligible.length];
    out.push({ q: f.q(item, region), a: f.a(item, region) });
  }
  return out;
}

/** 본문에 넣을 FAQ 블록(마크다운). faqItemsFor 와 같은 항목을 쓴다. */
export function pickFaqPool(k: KeywordEntry, seed: number): string {
  const items = faqItemsFor(k, seed, 4);
  if (!items.length) return "";
  const body = items.map((x) => `**Q. ${x.q}**\n\n${x.a}`).join("\n\n");
  return `## 자주 묻는 질문\n\n${body}`;
}
