import fs from "node:fs";
import path from "node:path";
import type { BlogPost } from "@/types";

// 블로그 글은 CMS(/admin)가 편집하는 content/blog/*.json (글당 1파일)에서 불러온다.
// 이 모듈은 서버(빌드) 전용으로만 import 된다(블로그/홈/사이트맵 — 모두 서버 컴포넌트).
const BLOG_DIR = path.join(process.cwd(), "content", "blog");

function loadPosts(): BlogPost[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const list: BlogPost[] = [];
  for (const f of files) {
    try {
      list.push(JSON.parse(fs.readFileSync(path.join(BLOG_DIR, f), "utf8")) as BlogPost);
    } catch {
      /* 잘못된 파일은 건너뜀 — 빌드는 깨지지 않음 */
    }
  }
  // 최신 글 먼저 (date 내림차순, 동일하면 id 순)
  return list.sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1
  );
}

export const posts: BlogPost[] = loadPosts();
