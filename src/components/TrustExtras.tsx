// 확장 가격 정보 + 보증 조건 — 운영자가 CMS 에 입력한 값이 있을 때만 렌더된다.
//
// 값이 없으면 이 컴포넌트 전체가 null 이다. "0원"이나 "미정" 같은 빈 자리를 만들지 않고,
// 있지도 않은 보증을 문구로 지어내지도 않는다. 값이 들어오는 즉시 코드 수정 없이 나타난다.
import { pricingExtras, hasPricingExtras } from "@/data/costs";
import { company } from "@/data/company";

export default function TrustExtras() {
  const w = company.warranty;
  if (!hasPricingExtras() && !w) return null;

  return (
    <section className="px-5 py-10">
      <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
        {hasPricingExtras() && (
          <div className="border border-gray-200 bg-white p-5">
            <h2 className="font-mono-pd mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9A8A2E]">
              비용 안내
            </h2>
            <dl className="space-y-2 text-[14px]">
              {pricingExtras.minimumPrice && (
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-bold text-[#16181D]">최소 시공비</dt>
                  <dd className="text-gray-600">{pricingExtras.minimumPrice}</dd>
                </div>
              )}
              {pricingExtras.wasteFee && (
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 font-bold text-[#16181D]">폐기물 처리비</dt>
                  <dd className="text-gray-600">{pricingExtras.wasteFee}</dd>
                </div>
              )}
            </dl>
            {pricingExtras.wasteFeeDescription && (
              <p className="mt-3 text-[13px] leading-relaxed text-gray-600">{pricingExtras.wasteFeeDescription}</p>
            )}
            {pricingExtras.additionalCostConditions.length > 0 && (
              <div className="mt-3">
                <p className="text-[13px] font-bold text-[#16181D]">추가 비용이 생길 수 있는 경우</p>
                <ul className="mt-1 space-y-1 text-[13px] text-gray-600">
                  {pricingExtras.additionalCostConditions.map((c) => (
                    <li key={c}>· {c}</li>
                  ))}
                </ul>
              </div>
            )}
            {pricingExtras.quoteRequiredNote && (
              <p className="mt-3 border-t border-gray-100 pt-3 text-[13px] leading-relaxed text-gray-600">
                {pricingExtras.quoteRequiredNote}
              </p>
            )}
          </div>
        )}

        {w && (
          <div className="border border-gray-200 bg-white p-5">
            <h2 className="font-mono-pd mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9A8A2E]">
              {w.title || "보증 안내"}
            </h2>
            {w.description && <p className="text-[14px] leading-relaxed text-gray-700">{w.description}</p>}
            {w.conditions.length > 0 && (
              <ul className="mt-3 space-y-1 text-[13px] text-gray-600">
                {w.conditions.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
            )}
            {w.exclusions.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-[13px] font-bold text-[#16181D]">보증 제외</p>
                <ul className="mt-1 space-y-1 text-[13px] text-gray-600">
                  {w.exclusions.map((c) => (
                    <li key={c}>· {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
