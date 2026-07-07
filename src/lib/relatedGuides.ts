import type { KeywordEntry } from "@/data/taxonomy";
import { posts } from "@/data/posts";
import { getKeywordBySlug } from "@/data/keywords";

// 키워드 페이지 → 블로그 가이드 내부 링크 매핑.
// 품목·꼬리말에 맞는 기존 블로그 글로 연결해 두 콘텐츠 사일로를 잇고, 필러(블로그)로
// 내부 링크를 모아 크롤·색인 경로를 강화한다. 존재하는 글만 링크한다(새 글은 만들지 않음).

// 품목군 → 관련 가이드(우선순위 순). content.ts 의 familyOf 와 동일 기준.
function familyOf(item: string): "maru" | "vinyl" | "tile" | "coating" | "sanding" | "generic" {
  const s = item || "";
  if (/(샌딩|면갈이|마루재생|마루코팅)/.test(s)) return "sanding";
  if (/(에폭시|우레탄)/.test(s)) return "coating";
  if (/(폴리싱|도기|바닥타일)/.test(s)) return "tile";
  if (/타일/.test(s) && !/(데코|디럭스)/.test(s)) return "tile";
  if (/(데코|디럭스|륨|장판)/.test(s)) return "vinyl";
  if (/마루/.test(s)) return "maru";
  return "generic";
}

const FAMILY_GUIDES: Record<string, string[]> = {
  maru: ["ganmaru-removal", "maru-cost", "sanding-why-matters", "after-removal-next-steps"],
  vinyl: ["deco-tile-cost", "deco-vs-jangpan", "cost-calculation"],
  tile: ["tile-removal", "cost-calculation", "waste-handling"],
  coating: ["commercial-restoration", "after-removal-next-steps", "waste-handling"],
  sanding: ["hardwood-sanding-guide", "sanding-why-matters", "after-removal-next-steps"],
  generic: ["preparation-before-removal", "cost-calculation", "after-removal-next-steps", "waste-handling"],
};

// 꼬리말(modifier) → 관련 가이드(품목 가이드보다 우선 배치).
const MODIFIER_GUIDES: Array<[RegExp, string[]]> = [
  [/(비용|가격|평당)/, ["cost-calculation", "maru-cost", "deco-tile-cost"]],
  [/견적/, ["cost-calculation", "preparation-before-removal"]],
  [/(방법|순서)/, ["preparation-before-removal", "after-removal-next-steps"]],
  [/원상복구/, ["commercial-restoration", "moving-checklist", "sanding-why-matters"]],
  [/폐기물/, ["waste-handling", "after-removal-next-steps"]],
  [/주의사항/, ["preparation-before-removal", "deco-vs-jangpan"]],
  [/(당일|긴급|빠른)/, ["preparation-before-removal", "moving-checklist"]],
];

export interface Guide {
  id: string;
  title: string;
}

const postById = new Map(posts.map((p) => [p.id, p]));

// 키워드에 맞는 실제 가이드 n개(존재하는 글만, 중복 제거, 우선순위 순).
export function relatedGuidesFor(k: KeywordEntry, n = 3): Guide[] {
  const ids: string[] = [];
  const push = (arr: string[]) => {
    for (const id of arr) if (!ids.includes(id)) ids.push(id);
  };

  if (String(k.type) === "b2b") push(["b2b-subcontract", "commercial-restoration"]);
  if (k.modifier) for (const [re, arr] of MODIFIER_GUIDES) if (re.test(k.modifier)) push(arr);
  push(FAMILY_GUIDES[familyOf(k.item || "")]);
  push(FAMILY_GUIDES.generic); // 항상 최소 개수 채우기용 폴백

  const out: Guide[] = [];
  for (const id of ids) {
    const p = postById.get(id);
    if (p) {
      out.push({ id: p.id, title: p.title });
      if (out.length >= n) break;
    }
  }
  return out;
}

// ─── 역방향: 블로그(필러) → 서비스(키워드) 사일로 링크 ──────────────────────────
// 블로그 글에서 주제에 맞는 실제 지역+품목 페이지로 링크해 PageRank 를 서비스 사일로로
// 되돌려 흐르게 한다(허브·롱테일 크롤 경로 강화). 존재하는 슬러그만 링크한다.
const POST_ITEM: Record<string, string> = {
  "ganmaru-removal": "강마루철거",
  "maru-cost": "마루철거",
  "sanding-why-matters": "바닥샌딩",
  "hardwood-sanding-guide": "바닥샌딩",
  "deco-tile-cost": "데코타일철거",
  "deco-vs-jangpan": "데코타일철거",
  "tile-removal": "타일철거",
  "commercial-restoration": "바닥철거",
};
const MAJOR_REGIONS = ["서울", "경기", "인천"];

export interface ServiceLink {
  slug: string;
  label: string;
}

export function relatedServicesForPost(postId: string, n = 3): ServiceLink[] {
  const item = POST_ITEM[postId] || "바닥재철거";
  const out: ServiceLink[] = [];
  const collect = (it: string) => {
    for (const r of MAJOR_REGIONS) {
      if (out.length >= n) break;
      const slug = `${r}-${it}`;
      const k = getKeywordBySlug(slug);
      if (k) out.push({ slug, label: k.keyword });
    }
  };
  collect(item);
  if (out.length === 0) collect("바닥재철거"); // 폴백
  return out;
}

