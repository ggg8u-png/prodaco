"use client";
// 서버 컴포넌트 안에서도 GA 이벤트를 붙일 수 있게 하는 얇은 링크 래퍼.
//
// CtaBand·Footer 같은 서버 컴포넌트는 onClick 을 직접 달 수 없다. 그렇다고 그 섹션 전체를
// 클라이언트로 바꾸면 HTML 에 본문이 덜 실릴 수 있어(검색로봇이 읽는 양이 줄어든다)
// 링크 하나만 클라이언트로 감싼다. 마크업은 평범한 <a> 라 크롤에는 아무 영향이 없다.
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackEvent, type CtaEvent, type EventParams } from "@/lib/analytics";

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  event: CtaEvent;
  params?: EventParams;
  children: ReactNode;
}

export default function TrackedLink({ event, params, children, onClick, ...rest }: Props) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        // 측정은 부수효과일 뿐 — 링크 기본 동작(전화 걸기·새 창)을 막지 않는다.
        trackEvent(event, params);
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
