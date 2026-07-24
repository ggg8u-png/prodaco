import type { KeywordEntry } from "@/data/taxonomy";
import { josa, josaEnd } from "@/lib/josa";
import { clusterLabelOf } from "@/data/regions";
import { applyReplacements } from "@/lib/replacements";

// 랜딩 상단(H1 아래) "빠른 답변" 데이터 — 질문 + 40~80자 핵심답변(결론 먼저) + 보충설명.
// 가격은 참고가/현장별 상이/실측 정산으로만 표현하고, 과장 표현은 쓰지 않는다.
//
// FAQPage 관계: 이 파일은 JSON-LD를 만들지 않는다. 콤보/지역 페이지가 answer만 기존 FAQPage
// mainEntity 맨 앞에 1건 병합한다(supplement은 스키마 제외).

export interface KeyAnswer {
  question: string;
  answer: string;
  supplement: string;
}

// (export: 감사 스크립트가 제목·본문 품목 일치를 검증할 때 사용)
export function familyLabel(item: string): string {
  if (/(샌딩|면갈이|마루재생|마루코팅)/.test(item)) return "샌딩(면갈이)";
  if (/(에폭시|우레탄)/.test(item)) return "코팅 철거";
  // 데코타일·디럭스타일·륨은 비닐계 — '타일'보다 먼저 판별해야
  // 데코타일철거 페이지 답변이 '타일 철거'로 잘못 안내되지 않는다(제목·본문 품목 일치).
  if (/(데코|디럭스|륨|장판)/.test(item)) return "비닐계 철거";
  if (/타일/.test(item)) return "타일 철거";
  if (/마루/.test(item)) return "마루 철거";
  return "바닥재 철거";
}

// 키워드(품목·지역·꼬리말·유형)에 맞는 질문 + 핵심답변 + 보충설명을 만든다.
export function keyAnswerFor(k: KeywordEntry): KeyAnswer {
  const item = k.item || "바닥재 철거";
  const kw = k.keyword;
  const m = k.modifier || "";
  const type = String(k.type || "");
  const isSanding = /(샌딩|면갈이|마루재생|마루코팅)/.test(item);

  // ── 꼬리말(modifier) 우선 ──────────────────────────────────────────────────
  if (/(비용|가격|평당)/.test(m)) {
    return {
      question: `${josa(kw, "은는")} 얼마인가요?`,
      answer:
        "마루 종류·접착제·폐기물·샌딩 범위에 따라 달라지며, 작업 후 실측 면적으로 최종 정산합니다.",
      supplement:
        "사진으로 가견적을 안내한 뒤 현장 상태를 확인합니다. 본드 잔여물과 샌딩 범위에 따라 다음 공정 준비 수준이 달라질 수 있습니다. 표에 안내된 값은 참고가이며 현장별로 상이합니다.",
    };
  }
  if (m === "견적") {
    return {
      question: `${josa(kw, "은는")} 어떻게 받나요?`,
      answer:
        "바닥이 보이는 사진 2~3장과 대략 면적만 주시면 1차 가견적을 바로 안내합니다.",
      supplement:
        "면적은 대략이라도 괜찮습니다. 바닥재 종류·접착 상태·폐기물 양에 따라 참고가가 달라지며, 필요하면 방문 확인 후 확정합니다. 숨은 추가비용 없이 작업 후 실측 면적으로만 정산합니다.",
    };
  }
  if (/(방법|순서)/.test(m)) {
    return {
      question: `${josa(kw, "은는")} 어떻게 진행하나요?`,
      answer:
        "하지 손상 없이 바닥재를 떼어낸 뒤 본드·잔여물을 정리하고, 폐자재 반출·실측 정산까지 한 흐름으로 진행합니다.",
      supplement:
        "현장에선 공용부와 가구를 보호한 뒤 콘크리트·배관을 다치지 않게 작업합니다. 남은 본드와 잔여물을 정리해 다음 바닥재가 바로 올라갈 수 있게 마무리합니다. 사진을 주시면 재질·접착 상태에 맞는 순서를 안내합니다.",
    };
  }
  if (m === "원상복구") {
    return {
      question: `${josa(kw, "은는")} 어디까지 해주나요?`,
      answer:
        "바닥재 철거에 더해 잔여 본드·이물질 제거와 건물주 요구 수준의 평탄도까지 맞춰 인계 가능한 상태로 마무리합니다.",
      supplement:
        "임대 계약의 원상복구 조건을 알려주시면 그 기준에 맞춰 정리합니다. 잔여 본드와 평탄도까지 처리해 보증금 정산 시 분쟁을 줄입니다. 참고가는 현장별로 상이하며 실측 면적으로 정산합니다.",
    };
  }
  if (/폐기물/.test(m)) {
    return {
      question: `${josa(kw, "은는")} 어떻게 하나요?`,
      answer:
        "철거 후 폐자재는 건설 폐기물로 분리해 마대에 담아 지정 위치에 배출합니다.",
      supplement:
        "타일·콘크리트처럼 무거운 폐자재는 반출 조건을 미리 확인합니다. 폐기물 양과 처리 방식에 따라 비용이 달라질 수 있어, 사진으로 상황을 먼저 확인해 안내합니다. 필요하면 처리 업체 연계도 도와드립니다.",
    };
  }
  if (/(당일|긴급|빠른)/.test(m)) {
    return {
      question: `${josa(kw, "이가")} 가능한가요?`,
      answer:
        "일정에 따라 당일·긴급 작업이 가능한 경우가 있습니다. 먼저 연락해 현장 상황을 알려주세요.",
      supplement:
        "긴급 현장일수록 사진과 면적을 함께 주시면 대기 시간이 줄어듭니다. 당일을 무리하게 약속하기보다, 가능한 일정을 함께 찾아 솔직하게 조율합니다. 작업 후에는 실측 면적으로 정산합니다.",
    };
  }
  if (m === "주의사항") {
    return {
      question: `${item} 시 주의할 점은 무엇인가요?`,
      answer:
        "무리하게 뜯으면 하지(콘크리트·방수층·배관)가 상하고, 본드를 덜 제거하면 새 바닥재 시공이 어렵습니다.",
      supplement:
        "특히 온돌 배관 위 마루나 방수층 위 타일은 손상 리스크가 커 신중히 접근합니다. 공동주택은 소음 신고와 이웃 안내를 권합니다. 사진으로 현장을 먼저 확인해 안전한 방법을 정합니다.",
    };
  }
  if (m === "기간") {
    return {
      question: `${item} 작업은 얼마나 걸리나요?`,
      answer:
        "면적·재질·접착 상태에 따라 다르지만 20~40평대는 보통 당일 내외입니다.",
      supplement:
        "타일·코팅이나 대형 현장은 폐기물·분진이 많아 일정을 협의해 진행합니다. 사진으로 면적과 접착 상태를 확인하면 예상 시간을 더 정확히 안내할 수 있습니다. 후속 공정 일정이 있으면 미리 알려주세요.",
    };
  }
  if (/(추천|잘하는곳|전문업체)/.test(m)) {
    return {
      question: `${kw}, 무엇을 보고 골라야 하나요?`,
      answer:
        "바닥재 철거·샌딩 전문 여부, 실측 정산인지, 일정 준수와 사후 대응이 되는지를 확인하세요.",
      supplement:
        "도면이 아닌 실측 면적 정산이 과다청구를 막는 기준입니다. 여러 곳을 비교만 하실 분도 부담 없이 문의하세요. 사진으로 작업 범위와 참고가 기준을 솔직하게 안내합니다.",
    };
  }

  // ── 유형(type)별 ────────────────────────────────────────────────────────────
  if (type === "b2b") {
    return {
      question: `인테리어·시공팀 ${item} 하도급도 맡길 수 있나요?`,
      answer:
        "네, 다수 현장·촉박한 공정도 대응하고 세금계산서 발행이 가능합니다.",
      supplement:
        "약속한 스케줄을 지켜 후속 공정에 차질이 없도록 진행합니다. 반복 협력도 환영합니다. 현장 사진과 공정 일정을 주시면 참고가와 가능한 일정을 안내하고, 실측 면적으로 정산합니다.",
    };
  }
  if (isSanding) {
    return {
      question: `${josa(kw, "은는")} 무엇을 하는 작업인가요?`,
      answer:
        "샌딩(면갈이)은 바닥을 뜯는 게 아니라 표면을 갈아 되살려 다음 공정이 바로 가능하게 하는 작업입니다.",
      supplement:
        "닳은 표면이나 철거 후 남은 본드 면을 평탄하게 정리합니다. 마루 종류와 사용 환경(주거·상업·체육관)에 따라 연마 강도와 코팅이 달라집니다. 표면 사진을 주시면 되살릴 수 있는 상태인지 먼저 확인해 안내합니다.",
    };
  }

  // ── 기본(region-item 등) ─────────────────────────────────────────────────────
  const where = k.region ? `${k.region} ` : "수도권 ";
  return {
    question: `${kw}, 어떻게 진행되나요?`,
    answer:
      `${where}${josa(familyLabel(item), "은는")} 하지 손상 없이 철거한 뒤 본드·잔여물까지 정리해 다음 공정이 바로 가능한 상태로 마무리합니다.`,
    supplement:
      "사진으로 가견적을 안내한 뒤 현장 상태를 확인합니다. 본드 잔여물과 샌딩 범위에 따라 다음 공정 준비 수준이 달라질 수 있습니다. 참고가는 현장별로 상이하며 작업 후 실측 면적으로 정산합니다.",
  };
}

// 지역 허브(/services/{region}) 용 — 지역 단위 질문 + 핵심답변 + 보충설명.
export function keyAnswerForRegion(region: string): KeyAnswer {
  const cluster = clusterLabelOf(region);
  const where = cluster && cluster !== "수도권" ? `${cluster} ` : "수도권 ";
  return normalizeKeyAnswer({
    question: `${region} 바닥재 철거는 어떻게 진행되나요?`,
    answer: `${josa(region, "을를")} 포함한 ${where}전역을 방문해 마루·데코타일·장판·타일 철거와 바닥 샌딩을 하지 손상 없이 진행합니다.`,
    supplement: `${region} 현장은 건물 유형과 주차·엘리베이터 여건을 먼저 확인해 반출 동선을 잡습니다. 참고가는 바닥재·면적별로 달라 사진 상담 후 실측 면적으로 정산합니다. 본드·잔여물까지 정리해 다음 공정이 바로 가능하게 마무리합니다.`,
  });
}

// 홈(/) 용 — 사이트 단위 대표 질문 + 핵심답변 + 보충설명.
export function keyAnswerForHome(): KeyAnswer {
  return normalizeKeyAnswer({
    question: "수도권 바닥재 철거, 프로다는 어떻게 진행하나요?",
    answer:
      "마루·데코타일·장판·타일 철거와 바닥 샌딩을 하지 손상 없이 진행하고, 본드·잔여물까지 정리해 다음 공정이 바로 가능한 상태로 마무리합니다.",
    supplement:
      "서울·경기·인천 수도권 전역을 방문합니다. 사진 2~3장이면 1차 가견적을 안내하고, 참고가는 현장별로 달라 작업 후 실측 면적으로 정산합니다. 뜯는 것으로 끝내지 않고 샌딩까지 하는 것이 저희 기준입니다.",
  });
}

// /services 용 — 디렉터리 단위 대표 질문 + 핵심답변 + 보충설명.
export function keyAnswerForServices(): KeyAnswer {
  return normalizeKeyAnswer({
    question: "어느 지역, 어떤 바닥재를 맡길 수 있나요?",
    answer:
      "서울·경기·인천 수도권 전역에서 마루·강마루·데코타일·장판·타일·에폭시·우레탄 철거와 바닥 샌딩·원상복구를 진행합니다.",
    supplement:
      "아래에서 지역이나 바닥재를 선택하면 상세 안내로 이동합니다. 사진 2~3장이면 1차 가견적이 가능하며, 참고가는 품목·면적별로 달라 사진 상담 후 실측 면적으로 정산합니다.",
  });
}

// 최종 출력에 전역 문구 치환(어드민 ⑫)을 적용해 다른 텍스트와 일관성을 맞춘다.
export function normalizeKeyAnswer(a: KeyAnswer): KeyAnswer {
  return {
    question: applyReplacements(a.question),
    answer: applyReplacements(a.answer),
    supplement: applyReplacements(a.supplement),
  };
}
