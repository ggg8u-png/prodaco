import Link from "next/link";
import { company } from "@/data/company";
import ui from "../../content/ui.json";

export default function Footer() {
  return (
    <footer className="bg-[#0F1115] px-4 pb-[100px] pt-11 text-[#8B919B] sm:px-6 lg:px-10 lg:pt-16">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-7 border-b border-white/[0.07] pb-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
        <div className="sm:col-span-2 lg:col-span-2 max-w-[340px]">
          <p className="text-2xl font-black tracking-[-0.03em] text-white">프로다<span className="text-[#FFD400]">.</span></p>
          <p className="mt-3 text-[13px] leading-[1.7]">
            {ui.footer.bio.replace("{experience}", company.experience).split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
          <a href={company.phoneLink} className="mt-4 inline-block text-lg font-extrabold text-white transition-colors hover:text-[#FFD400]">
            {company.phone}
          </a>
        </div>

        <div>
          <p className="mb-3.5 font-mono-pd text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">{ui.footer.serviceLabel}</p>
          <ul className="flex flex-col gap-2">
            {company.services.map((s) => (
              <li key={s.id} className="text-[13px]">
                <Link href="/services" className="transition-colors hover:text-white">{s.name}</Link>
              </li>
            ))}
            <li className="text-[13px]">
              <Link href="/services" className="font-semibold text-[#B8BEC8] transition-colors hover:text-white">지역·품목 전체 안내 →</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3.5 font-mono-pd text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">{ui.footer.quickLinksLabel}</p>
          <ul className="flex flex-col gap-2">
            {ui.footer.links.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-[13px] transition-colors hover:text-white">{label}</Link>
              </li>
            ))}
            <li>
              <a href={company.phoneLink} className="text-[13px] transition-colors hover:text-white">{ui.footer.phoneLabel} {company.phone}</a>
            </li>
            <li>
              <a href={company.kakaoUrl} target="_blank" rel="noopener" className="text-[13px] transition-colors hover:text-white">{ui.footer.kakaoLabel}</a>
            </li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-[1200px] text-xs text-[#5A606B]">
        © {new Date().getFullYear()} {company.name} (PRODA). {ui.footer.copyrightSuffix}
      </p>
    </footer>
  );
}
