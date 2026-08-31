import fs from "node:fs";
import path from "node:path";
import { posts } from "@/data/posts";
import { faqs } from "@/data/faq";
import { blogUrl } from "@/lib/blogUrl";
import { entriesForGroup, siteUrl } from "@/lib/sitemap";
import { postFeaturedImage } from "@/lib/featuredImage";

let pass = 0, fail = 0;
const checks: string[] = [];
const ok = (condition: boolean, name: string, detail = "") => {
  checks.push(`- ${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  condition ? pass++ : fail++;
};

const blogSource = fs.readFileSync(path.join(process.cwd(), "src", "app", "blog", "[id]", "page.tsx"), "utf8");
const sitemap = new Map(entriesForGroup("blog").map((entry) => [entry.loc, entry]));
const titles = new Set(posts.map((p) => p.title));
const descriptions = new Set(posts.map((p) => p.excerpt));

ok(posts.length >= 3, "블로그 표본 3개 이상", `${posts.length}개`);
ok(titles.size === posts.length, "블로그 title 고유");
ok(descriptions.size === posts.length, "블로그 description 고유");
ok(posts.every((p) => p.status !== "draft"), "초안이 공개 posts에서 제외");
ok(posts.every((p) => sitemap.has(blogUrl(siteUrl, p.id))), "발행 블로그 상세 sitemap 포함");
ok(posts.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(sitemap.get(blogUrl(siteUrl, p.id))?.lastmod ?? "")), "블로그 lastmod 형식");
ok(posts.slice(0, 3).every((p) => Boolean(postFeaturedImage(p).src)), "블로그 3개 featured image");
ok(/<h1/.test(blogSource) && /alternates:\s*\{ canonical: url \}/.test(blogSource), "독립 H1·self canonical");
ok(/"@type": "Article"/.test(blogSource) && /"@type": "BreadcrumbList"/.test(blogSource), "Article·Breadcrumb schema");
ok(/relatedServicesForPost/.test(blogSource) && /relatedPosts/.test(blogSource), "관련 서비스·글 연결");

ok(faqs.length >= 3, "FAQ 표본 3개 이상", `${faqs.length}개`);
ok(new Set(faqs.map((f) => f.id)).size === faqs.length, "FAQ ID 고유");
ok(faqs.slice(0, 3).every((f) => f.question && f.answer), "FAQ 3개 질문·답변 본문");
ok(fs.existsSync(path.join(process.cwd(), "src", "app", "faq", "page.tsx")), "FAQ 집합 페이지 존재");
ok(!fs.existsSync(path.join(process.cwd(), "src", "app", "faq", "[id]", "page.tsx")), "운영 구조 없는 Q&A 상세 URL 미생성");

fs.mkdirSync(path.join(process.cwd(), "reports"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "reports", "phase09-content-indexability.md"), [
  "# PHASE 09 콘텐츠 색인성 점검", "",
  `- 블로그: ${posts.length}개(공개 데이터는 draft 제외)`,
  `- 블로그 sitemap: ${sitemap.size}개`,
  `- FAQ: ${faqs.length}개(단일 집합 페이지, 개별 작성 구조 없음)`, "",
  "## 표본 블로그", ...posts.slice(0, 3).map((p) => `- ${p.id}: ${blogUrl(siteUrl, p.id)}`), "",
  "## 표본 FAQ", ...faqs.slice(0, 3).map((f) => `- ${f.id}: ${f.question}`), "",
  "## 검증", ...checks, "",
].join("\n"), "utf8");

console.log(`[phase09-content-verify] ${pass}/${pass + fail} 통과 · blog ${posts.length} · FAQ ${faqs.length}`);
if (fail) process.exit(1);
