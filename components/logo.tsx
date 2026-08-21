import Link from "next/link";

export function Logo({ href = "/admin", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="SAMBIKE">
      <span className="grid size-7 place-items-center rounded-full bg-[var(--accent)] text-xs font-black text-[#18231c]">
        S
      </span>
      <span className={`text-sm font-black tracking-[.16em] ${light ? "text-white" : "text-[var(--ink)]"}`}>
        SAMBIKE
      </span>
    </Link>
  );
}
