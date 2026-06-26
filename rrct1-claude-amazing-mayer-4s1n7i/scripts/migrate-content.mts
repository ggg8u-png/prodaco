// 기존 posts.ts / reviews.ts 데이터를 Decap CMS가 편집할 파일로 1회 이전한다.
//   실행: node --experimental-strip-types scripts/migrate-content.mts
//   - 블로그: content/blog/{id}.json (글당 1파일 — 폴더 컬렉션, 서버에서 fs 로 로드)
//   - 후기:   content/reviews.json { items: [...] } (정적 import — 클라이언트 안전)
import fs from "node:fs";
import path from "node:path";
import { posts } from "../src/data/posts.ts";
import { reviews, sampleReviews } from "../src/data/reviews.ts";

const root = process.cwd();
const blogDir = path.join(root, "content", "blog");
const contentDir = path.join(root, "content");
fs.mkdirSync(blogDir, { recursive: true });

// 기존 blog.json(있다면) 제거 — 폴더 구조로 대체
const legacyBlogJson = path.join(contentDir, "blog.json");
if (fs.existsSync(legacyBlogJson)) fs.rmSync(legacyBlogJson);

for (const p of posts) {
  fs.writeFileSync(path.join(blogDir, `${p.id}.json`), JSON.stringify(p, null, 2) + "\n");
}

const items = [
  ...reviews.map((r) => ({ ...r, sample: false })),
  ...sampleReviews.map((r) => ({ ...r, sample: true })),
];
fs.writeFileSync(path.join(contentDir, "reviews.json"), JSON.stringify({ items }, null, 2) + "\n");

console.log(`migrated: blog files=${posts.length} reviews=${items.length}`);
