// 페이지별 OG 이미지 렌더러 — 지역 × 품목 × 전화번호 세 줄이 전부다.
//
// 왜 전역 이미지 하나로는 안 되나: 검색결과·카톡·SNS 미리보기에서 모든 페이지가 같은
// 썸네일을 쓰면 어느 페이지인지 구분이 안 되고, 지역·품목이라는 이 사이트의 핵심 정보가
// 미리보기 단계에서 통째로 사라진다.
//
// 폰트: 외부 CDN 을 쓰지 않는다. 예전에 jsdelivr 폰트 로드가 실패하면서 빌드가 통째로
// 깨진 적이 있다(next/og 는 fonts:[] 를 받으면 "No fonts are loaded" 로 던진다).
// 여기서는 fonts 키 자체를 넘기지 않고 next/og 내장 폰트로 렌더한다 — 네트워크 의존 0.
import { ImageResponse } from "next/og";
import { company } from "@/data/company";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** 글자 수에 따라 자동으로 줄어드는 폰트 크기 — 긴 지역명·품목명도 잘리지 않게. */
function fitSize(text: string, max: number, min: number, fitChars: number): number {
  if (text.length <= fitChars) return max;
  const scaled = Math.floor((max * fitChars) / text.length);
  return Math.max(min, scaled);
}

export interface OgProps {
  /** 첫 줄 — 지역명(없으면 서비스 지역 표기). */
  region: string;
  /** 둘째 줄 — 서비스·품목명. */
  service: string;
  /** 셋째 줄 보조 라벨(선택) — 없으면 표시하지 않는다. */
  eyebrow?: string;
}

/**
 * 1200×630 OG 이미지.
 * 배치 우선순위: ① 지역 ② 서비스/품목 ③ 전화번호.
 * 전화번호는 company.phoneDigits 단일 출처에서 온다(하드코딩하지 않는다).
 */
export function renderOgImage({ region, service, eyebrow }: OgProps): ImageResponse {
  const phone = company.phoneDigits;
  const regionSize = fitSize(region, 92, 52, 8);
  const serviceSize = fitSize(service, 108, 58, 9);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#16181D",
          padding: "64px 72px",
        }}
      >
        {/* 상단 — 보조 라벨 + 노란 규칙선(브랜드 인지) */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 10, background: "#FFD400" }} />
          {eyebrow ? (
            <div style={{ display: "flex", color: "#FFD400", fontSize: 30, fontWeight: 700, letterSpacing: 3 }}>
              {eyebrow}
            </div>
          ) : null}
        </div>

        {/* 본문 — ① 지역 ② 서비스/품목 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              display: "flex",
              color: "#FFD400",
              fontSize: regionSize,
              fontWeight: 800,
              lineHeight: 1.15,
            }}
          >
            {region}
          </div>
          <div
            style={{
              display: "flex",
              color: "#FFFFFF",
              fontSize: serviceSize,
              fontWeight: 900,
              lineHeight: 1.12,
            }}
          >
            {service}
          </div>
        </div>

        {/* 하단 — ③ 전화번호. 노란 바 위에 검정 글씨라 배경에 묻히지 않는다. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#FFD400",
              color: "#16181D",
              fontSize: 56,
              fontWeight: 900,
              padding: "14px 30px",
              letterSpacing: 2,
            }}
          >
            {phone}
          </div>
          <div style={{ display: "flex", color: "#8B919B", fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>
            {company.brandName}
          </div>
        </div>
      </div>
    ),
    // fonts 키를 넘기지 않는다 — 내장 폰트로 렌더되어 외부 네트워크에 의존하지 않는다.
    { ...OG_SIZE }
  );
}
