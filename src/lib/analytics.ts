// GA4 이벤트 전송 헬퍼 — 클라이언트 전용.
//
// 설계 원칙:
//   · GA ID 가 없어도(=미설정 환경) 아무 일도 일어나지 않는다. throw 하지 않고 조용히 무시한다.
//     측정 코드 때문에 페이지가 깨지는 일은 없어야 한다 — 8월에 겪은 "Application error" 가
//     정확히 그런 종류의 사고였다.
//   · gtag 가 아직 로드되지 않았을 때도 안전하다(afterInteractive 로 늦게 붙는다).
//   · 이벤트 이름·파라미터를 여기 한 곳에 모아 두어 페이지마다 제각각이 되지 않게 한다.

export type CtaEvent =
  | "click_phone"
  | "click_kakao"
  | "click_sms"
  | "start_quote"
  | "submit_quote"
  | "use_cost_calculator"
  | "view_case"
  | "click_area_link"
  | "click_service_link";

export interface EventParams {
  /** 지역(지역 페이지·허브에서). */
  area?: string;
  /** 품목·서비스명. */
  service?: string;
  /** 페이지 유형(home / region-item / region-hub / case / review / blog …). */
  page_type?: string;
  /** CTA 가 놓인 위치(header / hero / floating / footer / inline …). */
  cta_position?: string;
  /** 그 외 값. */
  [key: string]: string | number | boolean | undefined;
}

type GtagFn = (command: string, eventName: string, params?: Record<string, unknown>) => void;

function gtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return typeof w.gtag === "function" ? w.gtag : null;
}

/**
 * 이벤트 1건 전송. GA 가 없으면 아무것도 하지 않는다(에러 없음).
 * 현재 경로는 자동으로 붙인다 — 어느 페이지에서 눌렀는지가 분석의 핵심이라서다.
 */
export function trackEvent(name: CtaEvent, params: EventParams = {}): void {
  const g = gtag();
  if (!g) return;
  try {
    g("event", name, {
      ...params,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  } catch {
    /* 측정 실패가 화면을 막지 않는다 */
  }
}

/**
 * onClick 핸들러 생성기 — JSX 에서 바로 쓰기 위한 것.
 *   <a onClick={onCtaClick("click_phone", { cta_position: "floating" })} …>
 * 링크 기본 동작(전화 걸기 등)을 막지 않는다.
 */
export function onCtaClick(name: CtaEvent, params: EventParams = {}) {
  return () => trackEvent(name, params);
}
