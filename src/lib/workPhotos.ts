// =============================================================================
// 작업 현장 사진 — URL별 결정적(고정) 선택.
//
// 원칙(운영 정책):
//   · 사진 풀은 구글드라이브 "3.사진_작업현장"을 photos:scan→sync→optimize→audit 로
//     승인·최적화한 자체 호스팅 WebP(src/data/work-photos.json, 커밋됨)만 사용한다.
//     드라이브 원본 URL 은 페이지에 노출하지 않는다.
//   · 같은 URL 은 언제나 같은 사진 조합(결정적) — 재빌드·재크롤 시 HTML 이 흔들리지 않는다.
//   · 렌데부(최고점수) 해싱: 페이지×사진 쌍 점수 상위 n장을 고른다. 풀에 사진이
//     추가/삭제되어도 기존 페이지 전체가 재배치되지 않고, 새 사진이 해당 페이지의
//     상위 n에 드는 페이지만 1장씩 교체된다. (poolVersion 을 해시에 섞지 않는 이유)
//   · 사진은 지역·공정을 특정하지 않는 참고 자료로만 쓴다 — alt/문구에 확인되지 않은
//     지역명·공정명을 넣지 않는다(섹션 제목도 "프로다 작업 현장 사진"류 중립 명칭).
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import workPhotosData from "@/data/work-photos.json";

export interface WorkPhoto {
  id: string;
  src: string;        // /images/work/{id}.webp (1600w)
  thumb: string;      // /images/work/thumb/{id}.webp (640w)
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
}

interface WorkPhotoPool {
  poolVersion: string;
  count: number;
  photos: WorkPhoto[];
}

const pool = workPhotosData as WorkPhotoPool;

// ── 운영자 증언 기반 지역 그룹(content/photos/region-attestation.json) ─────────
// 운영자가 "이 사진들은 강남·서초·송파 현장 촬영"이라고 확인한 사진 ID 집합.
// confirmed:true 일 때만 활성 — 해당 지역 페이지에서 이 풀을 우선 선택하고
// 섹션 라벨을 그룹 단위 사실("강남·서초·송파 현장")로 표기한다.
// 개별 사진의 세부 구(區)·공정은 여전히 미확인이므로 사진 단위 단정은 하지 않는다.
interface RegionAttestation {
  regions: string[];
  label: string;
  confirmed: boolean;
  photoIds: string[];
}
function loadAttestation(): RegionAttestation | null {
  try {
    const p = path.join(process.cwd(), "content", "photos", "region-attestation.json");
    const a = JSON.parse(fs.readFileSync(p, "utf8")) as RegionAttestation;
    if (a && a.confirmed === true && Array.isArray(a.photoIds) && a.photoIds.length > 0) return a;
  } catch {
    /* 파일 없음/파싱 실패 → 비활성 */
  }
  return null;
}
const attestation = loadAttestation();
const attestedSet = new Set(attestation?.photoIds ?? []);

/** 이 지역 페이지에 운영자 확인 지역 그룹 라벨을 쓸 수 있는가(활성 시에만). */
export function attestedRegionLabel(region?: string): string | null {
  if (!attestation || !region) return null;
  return attestation.regions.includes(region) ? attestation.label : null;
}

// FNV-1a 32bit — [slug]/content.ts 의 slugSeed 와 동일 계열(의존 없이 자체 보유).
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 사용 가능한 승인 사진 수(0이면 섹션 미노출). */
export function workPhotoCount(): number {
  return pool.photos.length;
}

/**
 * URL(라우트 키)별 고정 사진 n장 — 렌데부 해싱.
 * 같은 routeKey 는 항상 같은 결과, 한 페이지 안에서 중복 없음.
 * 인접 페이지는 서로 독립된 순열이라 조합이 자연스럽게 달라진다.
 *
 * opts.region: 운영자 확인 지역 그룹이 활성이고 region 이 그 그룹에 속하면
 * 확인된 사진 풀 안에서만 선택한다(전량 확보 가능할 때만 — 혼합 표기 방지).
 */
export function selectWorkPhotos(routeKey: string, count: number, opts?: { region?: string }): WorkPhoto[] {
  if (pool.photos.length === 0 || count <= 0) return [];
  let candidates = pool.photos;
  if (opts?.region && attestedRegionLabel(opts.region)) {
    const attested = pool.photos.filter((p) => attestedSet.has(p.id));
    // 확인 풀만으로 요청 장수를 채울 수 있을 때만 제한 — 미확인 사진이 지역 라벨
    // 아래 섞여 들어가는 것을 구조적으로 차단한다.
    if (attested.length >= count) candidates = attested;
  }
  const scored = candidates.map((p) => ({
    p,
    score: fnv1a(`${routeKey}|${p.id}`),
  }));
  scored.sort((a, b) => b.score - a.score || (a.p.id < b.p.id ? -1 : 1));
  return scored.slice(0, Math.min(count, scored.length)).map((s) => s.p);
}

/** 선택 결과가 전부 운영자 확인 풀에서 나왔는지(라벨 표기 가능 여부 최종 판정). */
export function allAttested(photos: WorkPhoto[]): boolean {
  return photos.length > 0 && photos.every((p) => attestedSet.has(p.id));
}

// 중립 alt 변형 — 지역·공정 단정 없음. 페이지×사진별로 회전해 동일 alt 반복을 피하되
// 키워드 삽입식 무작위 반복은 하지 않는다(모두 사실 서술).
const ALT_VARIANTS = [
  "프로다 바닥철거 작업 현장 참고 사진",
  "바닥재 철거와 잔여물 정리 작업 현장",
  "프로다 작업 장비와 현장 기록 사진",
  "바닥 철거·샌딩 작업 참고 이미지",
  "프로다 현장 작업 기록 사진",
  "바닥재 제거 작업이 진행 중인 현장",
] as const;

/** 페이지×사진별 안전 alt — 확인되지 않은 지역·공정명을 만들지 않는다. */
export function workPhotoAlt(routeKey: string, photoId: string): string {
  return ALT_VARIANTS[fnv1a(`alt|${routeKey}|${photoId}`) % ALT_VARIANTS.length];
}

// 섹션 하단 팀 소개 문구 변형(모두 동일 사실의 서술 변형 — 허위 지역·실적 없음).
const FOOTNOTE_VARIANTS = [
  "철거부터 본드·잔여물 정리까지 한 팀이 끝까지 진행합니다.",
  "걷어내는 데서 끝내지 않고 샌딩·잔여물 정리까지 마무리합니다.",
  "철거와 정리 작업을 나누지 않고 같은 팀이 책임지고 끝냅니다.",
] as const;

/** 고지 문구 — 고정 안내(지역·공정 오인 방지) + 페이지별 서술 변형. */
export function workPhotoFootnote(routeKey: string): string {
  const variant = FOOTNOTE_VARIANTS[fnv1a(`fn|${routeKey}`) % FOOTNOTE_VARIANTS.length];
  return `프로다가 진행한 다양한 작업 현장 사진입니다. 현재 페이지의 지역이나 공정과 동일한 현장이 아닐 수 있습니다. ${variant}`;
}
