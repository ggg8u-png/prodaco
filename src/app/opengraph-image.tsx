import { ImageResponse } from "next/og";

// 기본 대표 이미지(카톡·SNS·검색 썸네일). 1200×630.
// ⚠ 핵심: 브랜드를 '가로 중앙'에 둔다 → 네이버가 정사각으로 center-crop 해도 "프로다"가 살아남는다.
//   (이전 버전은 'PRODA.'가 좌측 정렬이라 정사각 크롭 시 "ODA."로 잘렸다.)
// 한글은 Pretendard 를 임베드해 렌더한다. 폰트 로드 실패 시 로마자 폴백으로 안전 렌더(빌드 불파손).
export const alt = "프로다 — 수도권 바닥철거·샌딩 전문";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_URL = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Bold.otf";

async function loadKrFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null; // 폰트 실패 → 로마자 폴백(아래)
  }
}

export default async function OgImage() {
  const fontData = await loadKrFont();
  const kr = !!fontData;

  // 폰트 유무에 따라 한글/로마자 — 어느 쪽이든 중앙 정렬이라 잘려도 브랜드가 읽힌다.
  const region = kr ? "서울 · 경기 · 인천" : "SEOUL · GYEONGGI · INCHEON";
  const brand = kr ? "프로다" : "PRODA";
  const tagline = kr ? "바닥철거 · 샌딩 전문" : "FLOOR REMOVAL & SANDING";
  const footer = kr ? "10년 · 수도권 현장 전문" : "EST. 10YR · METRO AREA";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#16181D",
          fontFamily: kr ? "Pretendard" : "sans-serif",
          padding: "56px",
        }}
      >
        {/* 상단: 지역 (중앙) */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 26 }}>
          <div style={{ width: 44, height: 6, background: "#FFD400" }} />
          <div style={{ color: "#FFD400", fontSize: 30, fontWeight: 700, letterSpacing: 4 }}>{region}</div>
          <div style={{ width: 44, height: 6, background: "#FFD400" }} />
        </div>

        {/* 브랜드 (가로 중앙 — 정사각 크롭 안전영역) */}
        <div style={{ display: "flex", alignItems: "flex-end", color: "#FFFFFF", fontSize: 184, fontWeight: 900, lineHeight: 1 }}>
          {brand}
          <span style={{ color: "#FFD400" }}>.</span>
        </div>

        {/* 업종 */}
        <div style={{ display: "flex", color: "#D6D9DE", fontSize: 46, fontWeight: 700, marginTop: 26 }}>{tagline}</div>

        {/* 하단: 경력·지역 */}
        <div style={{ display: "flex", color: "#8B919B", fontSize: 28, fontWeight: 700, letterSpacing: 2, marginTop: 34 }}>{footer}</div>
      </div>
    ),
    {
      ...size,
      fonts: kr ? [{ name: "Pretendard", data: fontData as ArrayBuffer, weight: 700 as const, style: "normal" as const }] : [],
    }
  );
}
