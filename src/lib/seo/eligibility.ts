// 색인 자격 판정 — 콘텐츠 품질 기준 단일 출처.
//
// 정책 변경(2026-08): 예전에는 "검증된 시공사례가 있는 페이지만 색인"이었다.
// 그 규칙은 실제 시공자료가 없는 지역×품목을 전부 noindex 로 묶었는데, 정보형
// 콘텐츠로도 검색 의도를 충족하는 페이지까지 함께 묶이는 부작용이 있었다.
// 이제는 **페이지가 실제로 읽을 만한가**를 기준으로 판정한다.
//
// 판정 항목(운영자 지시 기준):
//   ① title 존재       ② description 존재   ③ 본문 충분
//   ④ FAQ 존재         ⑤ 서비스 설명 존재    ⑥ 관련 내부링크 존재
//   ⑦ canonical 정상   ⑧ 중복 페이지 아님
//
// "실제 사례 없음 → 자동 noindex" 규칙은 두지 않는다. 실제 사례가 있으면 그 페이지가
// 더 강해질 뿐, 없다고 색인에서 빼지 않는다.
//
// ⑦⑧(canonical·중복)은 슬러그 구조에서 오는 판정이라 keywords.ts 쪽에서 처리하고,
// 이 모듈은 ①~⑥ 즉 '콘텐츠가 실제로 있는가'만 본다. 두 곳의 역할이 겹치지 않는다.
import type { KeywordEntry } from "@/data/taxonomy";
import { getContentForKeyword } from "@/lib/content";
import { uniqueTitle, uniqueDescription } from "@/lib/seo";
import { company } from "@/data/company";
import { itemKnowledgeFor } from "@/data/itemKnowledge";
import { faqItemsFor } from "@/data/faqPool";
import { neighborsOf } from "@/data/regions";

/** 색인 자격 최소 기준. 숫자를 바꾸면 전 페이지 판정이 함께 움직인다. */
export const QUALITY = {
  /** 본문 최소 글자수(공백 포함). 이 아래는 검색결과에 내보낼 내용이 없는 페이지다. */
  minBodyChars: 900,
  /** 본문 H2 최소 개수 — 문서 구조가 있어야 한다. */
  minHeadings: 5,
  /** FAQ 최소 개수. */
  minFaq: 3,
  /** title / description 최소 길이. */
  minTitle: 10,
  minDescription: 40,
} as const;

export interface EligibilityChecks {
  title: boolean;
  description: boolean;
  body: boolean;
  headings: boolean;
  faq: boolean;
  serviceDetail: boolean;
  internalLinks: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  checks: EligibilityChecks;
  /** 실패한 항목 이름(감사 리포트용). */
  failed: string[];
  /** 실측값(감사·테스트에서 분포를 볼 때 쓴다). */
  metrics: { bodyChars: number; headings: number; faq: number; links: number };
}

const LABEL: Record<keyof EligibilityChecks, string> = {
  title: "title",
  description: "description",
  body: "본문 분량",
  headings: "본문 구조(H2)",
  faq: "FAQ",
  serviceDetail: "서비스 설명",
  internalLinks: "관련 내부링크",
};

/**
 * 이 페이지가 색인 자격을 갖췄는가 — 콘텐츠 기준.
 * 본문을 실제로 생성해서 재는다(리포트와 배포 결과가 어긋날 수 없게).
 */
export function contentEligibilityFor(k: KeywordEntry): EligibilityResult {
  const body = getContentForKeyword(k);
  const headings = (body.match(/^## /gm) || []).length;
  const faq = faqItemsFor(k, 0, 4).length;
  const kn = itemKnowledgeFor(k.item);
  // 관련 내부링크 — 이 페이지에서 나갈 수 있는 목적지 수.
  //   · 품목 지식의 관련 작업(항상 렌더)
  //   · 지역이 있으면 인근 지역 + 지역 허브
  //   · 서비스 전체 허브(/services)는 모든 페이지에 있다
  //
  // ⚠ 불변식: 여기서는 '색인 여부에 의존하는 값'을 절대 세면 안 된다.
  //   itemGuidesFor() 처럼 indexabilityFor() 로 후보를 거르는 함수를 쓰면
  //   isIndexable → 자격판정 → indexabilityFor → isIndexable 로 무한 재귀가 된다
  //   (실제로 한 번 밟았다). 구조적으로 결정되는 수만 센다.
  const links = kn.relatedItems.length + (k.region ? neighborsOf(k.region, 5).length + 1 : 0) + 1;

  const checks: EligibilityChecks = {
    title: uniqueTitle(k).trim().length >= QUALITY.minTitle,
    description: uniqueDescription(k, company.phone).trim().length >= QUALITY.minDescription,
    body: body.length >= QUALITY.minBodyChars,
    headings: headings >= QUALITY.minHeadings,
    faq: faq >= QUALITY.minFaq,
    serviceDetail: kn.definition.trim().length > 40 && kn.process.length >= 3,
    internalLinks: links >= 2,
  };

  const failed = (Object.keys(checks) as Array<keyof EligibilityChecks>)
    .filter((key) => !checks[key])
    .map((key) => LABEL[key]);

  return {
    eligible: failed.length === 0,
    checks,
    failed,
    metrics: { bodyChars: body.length, headings, faq, links },
  };
}

/** 짧은 형태 — keywords.ts 의 색인 게이트가 쓰는 진입점. */
export function isContentEligible(k: KeywordEntry): boolean {
  return contentEligibilityFor(k).eligible;
}
