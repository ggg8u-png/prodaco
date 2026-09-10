import fs from "node:fs";
import path from "node:path";
import { galleryItems } from "@/data/gallery";
import {
  caseMetaDescription,
  casePageItems,
  casePath,
  caseUrl,
  indexableCases,
  isCaseIndexable,
  siblingCases,
} from "@/lib/caseDoc";
import { caseFeaturedImage, SITE_OG_IMAGE } from "@/lib/featuredImage";
import { entriesForGroup, siteUrl } from "@/lib/sitemap";
import { CASE_PAGE_SIZE, paginate } from "@/lib/pagination";
import { relatedGuidesForCase } from "@/lib/relatedGuides";
import { posts } from "@/data/posts";
import type { GalleryItem } from "@/types";

const failures: string[] = [];
let passed = 0;
const ok = (value: unknown, label: string, detail = "") => {
  if (value) passed++;
  else failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

const fixture: GalleryItem = {
  id: "fixture-published",
  title: "수원 아파트 강마루 철거 현장",
  status: "published",
  region: "수원",
  item: "강마루철거",
  beforeImage: "/before.jpg",
  afterImage: "/after.jpg",
  description: "수원 아파트에서 강마루를 철거하고 남은 접착제를 정리한 뒤 바닥 샌딩까지 진행한 실제 작업 기록입니다.",
  verified: true,
};

// 원본 CMS 파일을 조용히 버리는 회귀를 막는다. 모든 비초안 JSON은 런타임에
// 정확히 한 번 존재하고, 초안은 런타임에서 빠져야 한다.
const galleryDir = path.join(process.cwd(), "content", "gallery");
const runtimeIds = new Set(galleryItems.map((item) => item.id));
const sourceIds = new Set<string>();
for (const file of fs.readdirSync(galleryDir).filter((name) => name.endsWith(".json"))) {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(galleryDir, file), "utf8"));
  } catch (error) {
    ok(false, `${file}: gallery JSON parse`, String((error as Error)?.message || error));
    continue;
  }
  const fileId = file.replace(/\.json$/, "");
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : fileId;
  ok(!sourceIds.has(id), `${file}: gallery id 중복 없음`, id);
  sourceIds.add(id);
  ok(!raw.id || raw.id === fileId, `${file}: id와 파일명 일치`, String(raw.id || ""));
  ok(!raw.status || raw.status === "draft" || raw.status === "published", `${file}: status 유효`);
  ok(raw.status === "draft" ? !runtimeIds.has(id) : runtimeIds.has(id), `${file}: publish/draft 런타임 정합`);
}

// 공개/초안 판정과 사이트맵이 같은 단일 규칙을 사용한다.
ok(isCaseIndexable(fixture), "published fixture는 색인 가능");
ok(!isCaseIndexable({ ...fixture, status: "draft" }), "draft fixture는 색인 제외");
const sitemapCases = new Set(entriesForGroup("cases").map((entry) => entry.loc));
ok(indexableCases().every((item) => sitemapCases.has(caseUrl(siteUrl, item.id))), "published 색인 사례 전부 sitemap 포함");
ok(galleryItems.every((item) => item.status !== "draft"), "공개 galleryItems에 draft 없음");

// 실제 전체 사례의 title/H1 원천·description·canonical이 서로 독립적이다.
const items = casePageItems();
const unique = (values: string[]) => new Set(values).size === values.length;
ok(unique(items.map((item) => item.title)), "gallery title 전체 고유", `${items.length}건`);
ok(unique(items.map((item) => caseMetaDescription(item))), "gallery meta description 전체 고유", `${items.length}건`);
ok(unique(items.map((item) => caseUrl(siteUrl, item.id))), "gallery canonical 전체 고유", `${items.length}건`);
ok(items.every((item) => item.description.trim().length >= 40), "SSR 본문 원천 설명 40자 이상");

const sameRegionPair = items
  .map((item) => [item, items.find((other) => other.id !== item.id && other.region === item.region)] as const)
  .find(([, other]) => Boolean(other));
ok(Boolean(sameRegionPair), "같은 지역의 서로 다른 사례 fixture 존재");
if (sameRegionPair?.[1]) {
  ok(
    caseUrl(siteUrl, sameRegionPair[0].id) !== caseUrl(siteUrl, sameRegionPair[1].id),
    "같은 지역 사례가 canonical을 공유하지 않음"
  );
}

for (const item of items) {
  const sameRegion = items.filter((other) => other.id !== item.id && other.region === item.region && isCaseIndexable(other));
  if (sameRegion.length) {
    ok(siblingCases(item, 3).some((other) => other.region === item.region), `${item.id}: 같은 지역 사례 내부링크 유지`);
  }
}

// 대표 이미지 전체 폴백 순서.
ok(caseFeaturedImage({ ...fixture, featuredImage: "/custom.jpg" }).src === "/custom.jpg", "featuredImage custom 우선");
ok(caseFeaturedImage({ ...fixture, thumbnailChoice: "before" }).src === "/before.jpg", "thumbnailChoice before");
ok(caseFeaturedImage({ ...fixture, thumbnailChoice: "after" }).src === "/after.jpg", "thumbnailChoice after");
ok(caseFeaturedImage(fixture).src === "/after.jpg", "기본 afterImage 폴백");
ok(caseFeaturedImage({ ...fixture, afterImage: "" }).src === "/before.jpg", "beforeImage 폴백");
ok(
  caseFeaturedImage({ ...fixture, afterImage: "", beforeImage: "", photos: [{ src: "/extra.jpg" }] }).src === "/extra.jpg",
  "추가 사진 폴백"
);
ok(
  caseFeaturedImage({ ...fixture, afterImage: "", beforeImage: "", photos: [] }).src === SITE_OG_IMAGE,
  "사이트 OG 최종 폴백"
);

// 페이지네이션 데이터 합집합이 모든 공개 상세 URL과 정확히 일치한다.
const pages = Math.max(1, Math.ceil(items.length / CASE_PAGE_SIZE));
const listed = new Set<string>();
for (let page = 1; page <= pages; page++) {
  for (const item of paginate(items, "/gallery", CASE_PAGE_SIZE, page).items) listed.add(casePath(item.id));
}
ok(listed.size === items.length && items.every((item) => listed.has(casePath(item.id))), "gallery 전체 페이지가 모든 상세 href 후보 포함");

// 관련 글은 실제 게시 블로그만 사용하고, 홈 카드도 상세 경로를 사용한다.
const postIds = new Set(posts.map((post) => post.id));
ok(items.every((item) => relatedGuidesForCase(item.item).every((guide) => postIds.has(guide.id))), "사례 관련 가이드는 실제 게시 글만 참조");
const homeSource = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
ok(homeSource.includes("href={casePath(item.id)}"), "홈 최신 사례 카드가 상세 href 사용");
const detailSource = fs.readFileSync(path.join(process.cwd(), "src", "app", "gallery", "[id]", "page.tsx"), "utf8");
ok(!/^\s*["']use client["']/m.test(detailSource), "gallery 상세는 서버 컴포넌트");
ok(detailSource.includes("{g.description}"), "gallery 상세 SSR 마크업에 설명 포함");
ok(detailSource.includes("{g.title}</span>"), "보이는 breadcrumb 마지막 항목이 게시물 제목");
ok((detailSource.match(/"@type": "BreadcrumbList"/g) || []).length === 1, "BreadcrumbList 선언 1개");

if (failures.length) {
  console.error(`[test:gallery] 실패 ${failures.length} · 통과 ${passed}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`[test:gallery] 전체 통과 — ${passed}개 검증 · 사례 ${items.length}건`);
