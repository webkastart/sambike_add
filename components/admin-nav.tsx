"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Rocket, Users } from "lucide-react";

const items = [
  { href: "/admin", label: "Prehľad", icon: LayoutDashboard },
  { href: "/admin/kampane#kampane", label: "Kampane", icon: Megaphone },
  { href: "/admin/leady", label: "Záujemcovia", mobileLabel: "Leady", icon: Users },
  { href: "/admin/spustenie", label: "Spustenie", icon: Rocket },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="grid grid-cols-4 gap-1 p-2 md:flex md:flex-col md:items-stretch md:p-0" aria-label="Administrácia">
      {items.map((item, index) => {
        const active = item.label === "Prehľad"
          ? pathname === "/admin"
          : item.label === "Kampane"
            ? pathname.startsWith("/admin/kampane")
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={`${item.label}-${index}`}
            href={item.href}
            className={`flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2.5 text-[.72rem] transition md:justify-start md:gap-2.5 md:px-3 md:py-2 md:text-sm ${
              active ? "bg-[#eef6fd] font-semibold text-[var(--accent)]" : "text-[#6f6d6d] hover:text-[var(--ink)]"
            }`}
          >
            <Icon size={16} strokeWidth={1.8} />
            <span className="md:hidden">{"mobileLabel" in item ? item.mobileLabel : item.label}</span>
            <span className="hidden md:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
