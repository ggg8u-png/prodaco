"use client";
import { useState } from "react";
import { company } from "@/data/company";
import { materialOptions, regionOptions, consultPrep, ctaConfig } from "@/data/landing";
import { PhoneIcon, KakaoIcon } from "@/components/icons";

// 실제 단가 계산식이 없으므로 '계산기'가 아니라 '상담 체크리스트'.
// 입력값으로 상담 문구를 정리해 카톡/전화 문의를 쉽게 만들어 준다.
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

  return (
    <div className="rounded-[3px] border-2 border-[#16181D] bg-white">
      <div className="border-b-2 border-[#16181D] bg-[#16181D] px-5 py-4 sm:px-7">
        <p className="font-mono-pd text-[11px] font-bold uppercase tracking-[0.16em] text-[#FFD400]">Quote Checklist</p>
        <h3 className="mt-1 text-lg font-extrabold text-white sm:text-xl">견적 상담 체크리스트</h3>
        <p className="mt-1 text-[13px] text-[#A8AEB8]">
          아래만 알려주셔도 상담이 빨라집니다. 정확한 금액은 현장 상황에 따라 달라집니다.
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
            aria-label="카카오톡으로 사진 보내고 견적 문의하기"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm bg-[#FFD400] px-5 py-3.5 text-[15px] font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D]"
          >
            <KakaoIcon className="h-[17px] w-[17px]" />
            {ctaConfig.quoteCta}
          </a>
          <a
            href={company.phoneLink}
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
