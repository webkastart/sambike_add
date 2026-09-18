import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/admin", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="inline-flex w-32 shrink-0 flex-col items-center gap-1" aria-label="Sambike · servis bicyklov">
      <Image
        src="/brand/sambike-mark.png"
        alt=""
        width={240}
        height={220}
        loading="eager"
        aria-hidden="true"
        className="h-auto w-12"
      />
      <span className={`text-[2.1rem] font-bold leading-none tracking-[-.055em] ${light ? "text-white" : "text-[var(--ink)]"}`} aria-hidden="true">
        Samb<span className="relative inline-block">ı<span className="absolute left-1/2 top-[-.02em] size-[.26em] -translate-x-1/2 rounded-full bg-[var(--accent)]" /></span>ke
      </span>
    </Link>
  );
}
