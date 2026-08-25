"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Settings, Users } from "lucide-react";

const items = [
  { href: "/admin", label: "Prehľad", icon: LayoutDashboard },
  { href: "/admin/kampane#kampane", label: "Kampane", icon: Megaphone },
  { href: "/admin/leady", label: "Záujemcovia", icon: Users },
  { href: "/admin/nastavenia", label: "Nastavenia", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 md:flex-col md:items-stretch" aria-label="Administrácia">
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
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-[#eef6fd] font-semibold text-[var(--accent)]" : "text-[#6f6d6d] hover:text-[var(--ink)]"
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
