"use client";
import { useState } from "react";
import { company } from "@/data/company";
import { materialOptions, regionOptions, consultPrep, ctaConfig } from "@/data/landing";
import { FLOOR_COSTS, costKeyOf } from "@/data/costs";
import { PhoneIcon, KakaoIcon } from "@/components/icons";
import { trackEvent, onCtaClick } from "@/lib/analytics";
import { useEffect, useRef } from "react";
import ui from "../../content/ui.json";

// 견적 상담 체크리스트 + 참고 비용 범위 계산.
//
// 계산에 쓰는 평당 단가는 전부 content/costs.json(운영자가 CMS 에서 관리하는 참고가)에서
// 온다 — 여기서 숫자를 만들지 않는다. 단가가 없는 품목은 계산 자체를 하지 않고
// '현장 별도 산정' 으로 남긴다.
//
// 바닥재 선택지 라벨 하나가 여러 단가 행에 걸치는 경우("강마루·강화마루")에는 각 항목을
// 따로 조회해 범위를 합집합으로 넓힌다. 좁은 쪽만 보여주면 실제 견적이 그보다 높게
// 나왔을 때 고객이 속았다고 느끼게 된다 — 과소 표기가 과대 표기보다 위험하다.
function perPyeongRangeFor(materialLabel: string): [number, number] | null {
  const ranges = materialLabel
    .split("·")
    .map((token) => FLOOR_COSTS.find((r) => r.key === costKeyOf(token))?.perPyeong)
    .filter((r): r is [number, number] => Array.isArray(r));
  if (!ranges.length) return null;
  return [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))];
}

export default function QuoteChecklist() {
  const [area, setArea] = useState("");
  const [material, setMaterial] = useState("");
  const [region, setRegion] = useState("");

  const summary = [
    region && `지역: ${region}`,
    area && `면적: ${area}평`,
    material && `바닥재: ${material}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // 면적과 바닥재가 둘 다 있고, 그 바닥재에 참고 단가가 있을 때만 범위를 낸다.
  const pyeong = Number(area);
  const perPyeong = material ? perPyeongRangeFor(material) : null;
  const estimate =
    Number.isFinite(pyeong) && pyeong > 0 && pyeong <= 10000 && perPyeong
      ? { min: Math.round(pyeong * perPyeong[0]), max: Math.round(pyeong * perPyeong[1]), perPyeong }
      : null;
  // 단가가 없는 품목을 골랐을 때는 계산 대신 그 사실을 알린다(빈 화면·0원 표시 금지).
  const noRate = !!material && !perPyeong && material !== "잘 모르겠어요";

  // 계산 결과가 실제로 나온 순간에만 1회 보낸다(입력할 때마다 보내면 이벤트가 의미를 잃는다).
  const sentRef = useRef("");
  useEffect(() => {
    if (!estimate) return;
    const key = `${material}|${pyeong}`;
    if (sentRef.current === key) return;
    sentRef.current = key;
    trackEvent("use_cost_calculator", { service: material, area: region || undefined, page_type: "quote-checklist" });
  }, [estimate, material, pyeong, region]);

  return (
    <div className="rounded-[3px] border-2 border-[#16181D] bg-white">
      <div className="border-b-2 border-[#16181D] bg-[#16181D] px-5 py-4 sm:px-7">
        <p className="font-mono-pd text-[11px] font-bold uppercase tracking-[0.16em] text-[#FFD400]">Quote Checklist</p>
        <h3 className="mt-1 text-lg font-extrabold text-white sm:text-xl">견적 상담 체크리스트</h3>
        <p className="mt-1 text-[13px] text-[#A8AEB8]">
          면적과 바닥재를 고르면 참고 비용 범위를 바로 확인할 수 있습니다. 정확한 금액은 현장 상황에 따라 달라집니다.
        </p>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-7">
        <div>
          <label htmlFor="qc-region" className="mb-1.5 block text-sm font-bold">지역</label>
          <div id="qc-region" role="group" aria-label="지역 선택" className="flex flex-wrap gap-2">
            {regionOptions.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={region === r}
                onClick={() => setRegion(region === r ? "" : r)}
                className={`rounded-sm border px-3 py-2 text-sm font-semibold transition-colors ${
                  region === r ? "border-[#16181D] bg-[#FFD400] text-[#16181D]" : "border-gray-300 bg-white text-gray-600 hover:border-gray-500"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="qc-area" className="mb-1.5 block text-sm font-bold">면적 (평)</label>
          <input
            id="qc-area"
            type="number"
            inputMode="numeric"
            min={0}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="예: 32"
            className="w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#16181D]"
          />
        </div>

        <div>
          <label htmlFor="qc-material" className="mb-1.5 block text-sm font-bold">바닥재 종류</label>
          <div id="qc-material" role="group" aria-label="바닥재 종류 선택" className="flex flex-wrap gap-2">
            {materialOptions.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={material === m}
                onClick={() => setMaterial(material === m ? "" : m)}
                className={`rounded-sm border px-3 py-2 text-sm font-semibold transition-colors ${
                  material === m ? "border-[#16181D] bg-[#FFD400] text-[#16181D]" : "border-gray-300 bg-white text-gray-600 hover:border-gray-500"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 참고 비용 범위 — 입력이 충분할 때만 나타난다. 보장가가 아니라는 고지를
            비용표(지역 페이지)와 같은 문구로 붙여 사이트 안에서 말이 달라지지 않게 한다. */}
        {estimate && (
          <div
            aria-live="polite"
            className="rounded-sm border-2 border-[#16181D] bg-[#FFFBE6] px-4 py-4"
          >
            <p className="font-mono-pd text-[11px] font-bold uppercase tracking-[0.14em] text-[#9A8A2E]">
              참고 비용 범위
            </p>
            <p className="mt-1.5 text-[20px] font-black leading-tight text-[#16181D] sm:text-[22px]">
              약 {estimate.min.toLocaleString()}만 ~ {estimate.max.toLocaleString()}만원
            </p>
            <p className="mt-1 text-[12.5px] text-gray-600">
              {pyeong}평 × 평당 {estimate.perPyeong[0]}만~{estimate.perPyeong[1]}만원 · {material}
            </p>
            <p className="mt-2.5 border-t border-[#16181D]/15 pt-2.5 text-[12px] leading-relaxed text-gray-600">
              {ui.regionPage.pricingDisclaimer}
              <strong className="font-bold text-[#16181D]">{ui.regionPage.pricingDisclaimerStrong}</strong>
              {ui.regionPage.pricingDisclaimerSuffix}
            </p>
          </div>
        )}
        {noRate && (
          <div className="rounded-sm border border-gray-300 bg-[#F7F6F3] px-4 py-3">
            <p className="text-[13px] font-bold text-[#16181D]">이 품목은 현장 별도 산정입니다</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">
              참고 단가를 일률적으로 적용하기 어려운 품목이라 범위를 표시하지 않습니다. 사진을 보내주시면 상황을 보고 안내드립니다.
            </p>
          </div>
        )}

        <div className="rounded-sm bg-[#F7F6F3] px-4 py-3">
          <p className="text-[13px] font-bold text-[#16181D]">상담 전 사진 첨부 안내</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">
            {consultPrep.find((p) => p.id === "photo")?.hint}. 카카오톡으로 사진을 함께 보내주시면 상담이 더 빠릅니다.
          </p>
          {summary && (
            <p className="mt-2 font-mono-pd text-[12px] text-[#9A8A2E]">입력 요약 — {summary}</p>
          )}
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <a
            href={company.kakaoUrl}
            target="_blank"
            rel="noopener"
            onClick={onCtaClick("click_kakao", { cta_position: "quote-checklist", service: material || undefined, area: region || undefined })}
            aria-label="카카오톡으로 사진 보내고 견적 문의하기"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm bg-[#FFD400] px-5 py-3.5 text-[15px] font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D]"
          >
            <KakaoIcon className="h-[17px] w-[17px]" />
            {ctaConfig.quoteCta}
          </a>
          <a
            href={company.phoneLink}
            onClick={onCtaClick("click_phone", { cta_position: "quote-checklist", service: material || undefined, area: region || undefined })}
            aria-label={`전화로 상담하기 ${company.phone}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm border-2 border-[#16181D] px-5 py-3.5 text-[15px] font-extrabold text-[#16181D] transition-colors hover:bg-[#16181D] hover:text-white"
          >
            <PhoneIcon className="h-[17px] w-[17px]" />
            {ctaConfig.phonePrimary}
          </a>
        </div>
      </div>
    </div>
  );
}
