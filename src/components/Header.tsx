"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { company } from "@/data/company";
import { PhoneIcon } from "@/components/icons";
import ui from "../../content/ui.json";

const navItems = ui.header.nav;

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-[60] border-b-[3px] border-[#FFD400] bg-[#16181D]">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="whitespace-nowrap text-[22px] font-black leading-none tracking-[-0.03em] text-white">
          프로다<span className="text-[#FFD400]">.</span>
        </Link>

        <nav className="hidden items-center gap-7 font-mono-pd text-[13px] font-medium text-[#A8AEB8] lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <span className="hidden font-mono-pd text-[11px] uppercase tracking-[0.14em] text-[#7B818C] sm:inline">
            {ui.header.badge}
          </span>
          <a
            href={company.phoneLink}
            aria-label={`전화 상담 ${company.phone}`}
            className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-sm bg-[#FFD400] px-[15px] py-[9px] text-sm font-extrabold text-[#16181D] transition-colors hover:bg-[#FFE34D]"
          >
            <PhoneIcon className="h-[15px] w-[15px]" />
            <span>{ui.header.phoneCta}</span>
            <span className="hidden font-mono-pd font-bold sm:inline">{company.phone}</span>
          </a>
          <button className="p-1 text-white lg:hidden" onClick={() => setOpen(!open)} aria-label={ui.header.menuLabel}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-4 border-t border-white/10 bg-[#16181D] px-5 py-5 lg:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono-pd text-sm font-medium text-[#E6E8EC]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={company.kakaoUrl}
            target="_blank"
            rel="noopener"
            className="mt-1 flex items-center justify-center rounded-sm border border-white/25 py-3 text-sm font-extrabold text-white"
          >
            {ui.header.kakaoCta}
          </a>
        </div>
      )}
    </header>
  );
}
