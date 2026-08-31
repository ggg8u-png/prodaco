import fs from "node:fs";
import path from "node:path";
import type { BlogPost } from "@/types";
import { markdownToPlainText } from "@/lib/markdownText";

// 블로그 글은 CMS(/admin)가 편집하는 content/blog/*.json (글당 1파일)에서 불러온다.
// 이 모듈은 서버(빌드) 전용으로만 import 된다(블로그/홈/사이트맵 — 모두 서버 컴포넌트).
const BLOG_DIR = path.join(process.cwd(), "content", "blog");

// CMS 는 "제목"만 받고 나머지는 자동으로 채운다. 파일에 값이 없어도 빌드가 깨지지 않게
// 여기서 한 번에 보정한다.
//   id      : 파일명(= CMS 가 제목에서 만든 슬러그). 옛 글은 JSON 안의 id 를 그대로 존중.
//   excerpt : 비어 있으면 본문 첫 문단에서 자동 생성.
//   date    : 비어 있으면 파일 수정일.
//   tags    : 없으면 빈 배열.
function normalize(raw: Record<string, unknown>, file: string, mtime: Date): BlogPost | null {
  const fromFile = file.replace(/\.json$/, "");
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : fromFile;
  const content = typeof raw.content === "string" ? raw.content : "";
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : id;
  if (!id || !title) return null;

  let excerpt = typeof raw.excerpt === "string" ? raw.excerpt.trim() : "";
  if (!excerpt) {
    const plain = markdownToPlainText(content);
    excerpt = plain.length > 155 ? `${plain.slice(0, 152).trimEnd()}…` : plain;
  }

  const rawDate = typeof raw.publishedAt === "string" && raw.publishedAt
    ? raw.publishedAt.slice(0, 10)
    : typeof raw.date === "string" ? raw.date.slice(0, 10) : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : mtime.toISOString().slice(0, 10);

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "")
    : [];

  return {
    id,
    title,
    ...(raw.status === "draft" || raw.status === "published" ? { status: raw.status } : {}),
    ...(typeof raw.publishedAt === "string" && raw.publishedAt
      ? { publishedAt: raw.publishedAt.slice(0, 10) }
      : {}),
    ...(raw.indexStatus === "unknown" || raw.indexStatus === "confirmed" ? { indexStatus: raw.indexStatus } : {}),
    excerpt,
    content,
    date,
    ...(typeof raw.updatedAt === "string" && raw.updatedAt ? { updatedAt: raw.updatedAt.slice(0, 10) } : {}),
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "정보",
    tags,
    // 대표 썸네일(선택) — 비면 src/lib/featuredImage.ts 가 본문 첫 사진 → 기본 사진 순으로
    // 폴백한다. 여기서 가짜 값을 채우지 않는다(기존 글은 이 키가 아예 없다).
    ...(typeof raw.featuredImage === "string" && raw.featuredImage.trim()
      ? { featuredImage: raw.featuredImage.trim() }
      : {}),
    ...(typeof raw.featuredImageAlt === "string" && raw.featuredImageAlt.trim()
      ? { featuredImageAlt: raw.featuredImageAlt.trim() }
      : {}),
  };
}

function loadPosts(): BlogPost[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const list: BlogPost[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    try {
      const full = path.join(BLOG_DIR, f);
      const raw = JSON.parse(fs.readFileSync(full, "utf8")) as Record<string, unknown>;
      const post = normalize(raw, f, fs.statSync(full).mtime);
      // id 중복(같은 주소 두 글)은 뒤 글을 버린다 — 사이트맵 중복·정적 경로 충돌 방지.
      if (post && post.status !== "draft" && !seen.has(post.id)) {
        seen.add(post.id);
        list.push(post);
      }
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
