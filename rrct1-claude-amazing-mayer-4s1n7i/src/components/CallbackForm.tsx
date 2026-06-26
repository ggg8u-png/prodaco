"use client";
import { useState } from "react";
import { materialOptions } from "@/data/landing";

// 카카오톡·전화가 부담스러운 사용자를 위한 '번호 남기기' 콜백 신청 폼.
// Netlify Forms 로 제출 → Netlify 대시보드/이메일로 수신 (백엔드 코드 불필요).
// 폼 감지는 public/__forms.html 이 담당하고, 여기서는 같은 이름으로 제출한다.
export default function CallbackForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("sending");
    try {
      const data = new FormData(form);
      data.set("form-name", "callback");
      // 파일 포함 시 multipart 로 전송(브라우저가 boundary 설정)
      const res = await fetch("/", { method: "POST", body: data });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("done");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-[3px] border-2 border-[#FFD400] bg-white px-6 py-8 text-center">
        <p className="text-lg font-black text-[#16181D]">신청이 접수되었습니다 ✓</p>
        <p className="mt-2 text-sm text-[#5A6068]">영업시간 내에 남겨주신 번호로 연락드리겠습니다.</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-[13px] font-bold text-[#9A8A2E] underline-offset-4 hover:underline"
        >
          다시 신청하기
        </button>
      </div>
    );
  }

  return (
    <form
      name="callback"
      method="POST"
      data-netlify="true"
      encType="multipart/form-data"
      onSubmit={onSubmit}
      className="rounded-[3px] border-2 border-[#16181D] bg-white"
    >
      <input type="hidden" name="form-name" value="callback" />
      {/* 스팸 방지용 허니팟 (사용자에게는 숨김) */}
      <p className="hidden">
        <label>이 칸은 비워두세요 <input name="bot-field" /></label>
      </p>

      <div className="border-b-2 border-[#16181D] bg-[#16181D] px-5 py-4 sm:px-7">
        <p className="font-mono-pd text-[11px] font-bold uppercase tracking-[0.16em] text-[#FFD400]">Call Back</p>
        <h3 className="mt-1 text-lg font-extrabold text-white sm:text-xl">번호만 남기면 연락드려요</h3>
        <p className="mt-1 text-[13px] text-[#A8AEB8]">카톡·전화가 번거로우시면 여기로. 영업시간 내 연락드립니다.</p>
      </div>

      <div className="space-y-4 px-5 py-6 sm:px-7">
        <div>
          <label htmlFor="cb-name" className="mb-1.5 block text-sm font-bold">이름 <span className="text-[#C0392B]">*</span></label>
          <input
            id="cb-name"
            name="name"
            type="text"
            required
            placeholder="성함"
            className="w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#16181D]"
          />
        </div>
        <div>
          <label htmlFor="cb-phone" className="mb-1.5 block text-sm font-bold">연락처 <span className="text-[#C0392B]">*</span></label>
          <input
            id="cb-phone"
            name="phone"
            type="tel"
            required
            inputMode="tel"
            placeholder="010-0000-0000"
            className="w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#16181D]"
          />
        </div>
        <div>
          <label htmlFor="cb-item" className="mb-1.5 block text-sm font-bold">작업 종류 <span className="text-gray-400 font-normal">(선택)</span></label>
          <select
            id="cb-item"
            name="item"
            defaultValue=""
            className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#16181D]"
          >
            <option value="" disabled>선택해 주세요</option>
            {materialOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value="기타">기타</option>
          </select>
        </div>
        <div>
          <label htmlFor="cb-message" className="mb-1.5 block text-sm font-bold">메모 <span className="text-gray-400 font-normal">(선택)</span></label>
          <textarea
            id="cb-message"
            name="message"
            rows={3}
            placeholder="지역·면적·희망일 등 알려주시면 상담이 빨라집니다"
            className="w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#16181D]"
          />
        </div>
        <div>
          <label htmlFor="cb-photo" className="mb-1.5 block text-sm font-bold">현장 사진 <span className="text-gray-400 font-normal">(선택)</span></label>
          <input
            id="cb-photo"
            name="photo"
            type="file"
            accept="image/*"
            className="w-full text-sm text-gray-600 file:mr-3 file:rounded-sm file:border-0 file:bg-[#16181D] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
          />
        </div>

        {status === "error" && (
          <p className="text-[13px] font-semibold text-[#C0392B]">전송에 실패했습니다. 잠시 후 다시 시도하시거나 전화/카톡으로 연락 주세요.</p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex w-full items-center justify-center rounded-sm bg-[#FFD400] px-5 py-3.5 text-[15px] font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D] disabled:opacity-60"
        >
          {status === "sending" ? "전송 중…" : "상담 신청하기"}
        </button>
        <p className="text-center text-[12px] text-[#7B818C]">남겨주신 정보는 상담 목적으로만 사용됩니다.</p>
      </div>
    </form>
  );
}
