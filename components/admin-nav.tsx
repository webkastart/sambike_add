"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Users } from "lucide-react";

const items = [
  { href: "/admin", label: "Prehľad", icon: LayoutDashboard, exact: true },
  { href: "/admin", label: "Kampane", icon: Megaphone, exact: false },
  { href: "/admin/leady", label: "Záujemcovia", icon: Users, exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 md:flex-col md:items-stretch" aria-label="Administrácia">
      {items.map((item, index) => {
        const active = item.label === "Kampane"
          ? pathname.startsWith("/admin/kampane")
          : item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={`${item.label}-${index}`}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-[#edf1ed] font-semibold text-[var(--ink)]" : "text-[#69736b] hover:text-[var(--ink)]"
            }`}
          >
            <Icon size={16} strokeWidth={1.8} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
