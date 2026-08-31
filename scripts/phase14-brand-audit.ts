// PHASE 14 — 브랜드·브레드크럼·상세 페이지 검색 신호 회귀 검사.
// 실행: npm run seo:brand
// 검색결과 UI는 검색엔진이 결정하므로, 여기서는 사이트가 일관된 신호를 내는지만 확인한다.
import fs from "node:fs";
import path from "node:path";
import { company } from "@/data/company";
import { posts } from "@/data/posts";
import { casePageItems } from "@/lib/caseDoc";
import { postFeaturedImage, caseFeaturedImage } from "@/lib/featuredImage";
import { generateMetadata as blogMetadata } from "@/app/blog/[id]/page";
import { generateMetadata as caseMetadata } from "@/app/gallery/[id]/page";

const root = process.cwd();
const errors: string[] = [];
let passed = 0;
function ok(condition: boolean, label: string) {
  if (condition) { passed++; return; }
  errors.push(label);
}
function firstOgImage(metadata: Awaited<ReturnType<typeof blogMetadata>>): string {
  const images = metadata.openGraph?.images;
  const first = Array.isArray(images) ? images[0] : images;
  if (!first) return "";
  return typeof first === "string" || first instanceof URL ? String(first) : String(first.url || "");
}

const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
const breadcrumbPages = [
  "src/app/faq/page.tsx",
  "src/app/reviews/page.tsx",
  "src/app/blog/page.tsx",
  "src/app/blog/[id]/page.tsx",
  "src/app/gallery/page.tsx",
  "src/app/gallery/[id]/page.tsx",
  "src/app/[slug]/page.tsx",
  "src/app/services/[region]/page.tsx",
];

ok(company.brand.name === "프로다", "브랜드명은 프로다");
ok(company.brand.alternateNames.includes("PRODA"), "영문 보조 브랜드명(PRODA)");
ok(company.brand.url === "https://prodaco.kr", "대표 URL은 prodaco.kr");
ok(company.brand.phone === company.phone && /^\d{2,3}-\d{3,4}-\d{4}$/.test(company.brand.phone), "전화번호는 실제 설정 단일 출처");
ok(company.brand.serviceArea.length > 0, "서비스 지역 단일 출처");
ok(layout.includes("applicationName: company.brand.name"), "applicationName 일관성");
ok(layout.includes("siteName: company.brand.name"), "og:site_name 일관성");
ok(!layout.includes('"@type": "BreadcrumbList"'), "루트 레이아웃은 BreadcrumbList를 출력하지 않음");

for (const file of breadcrumbPages) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  ok((source.match(/"@type": "BreadcrumbList"/g) || []).length === 1, `${file}: 페이지별 BreadcrumbList 하나`);
}

async function main() {
  const post = posts[0];
  const postMeta = await blogMetadata({ params: Promise.resolve({ id: post.id }) });
  ok(postMeta.title === post.title, "블로그 상세 title은 글 제목");
  ok(firstOgImage(postMeta) === `${company.siteUrl}${postFeaturedImage(post).src}`, "블로그 OG 대표 이미지 일관성");

  const item = casePageItems()[0];
  const caseMeta = await caseMetadata({ params: Promise.resolve({ id: item.id }) });
  ok(caseMeta.title === item.title, "시공사례 상세 title은 게시물 제목");
  ok(firstOgImage(caseMeta) === `${company.siteUrl}${caseFeaturedImage(item).src}`, "시공사례 OG 대표 이미지 일관성");

  if (errors.length) {
    console.error(`[phase14] ${errors.length}건 실패`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[phase14] 브랜드·브레드크럼·상세 메타데이터 검사 통과 (${passed}건)`);
}

void main();
