import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/admin", light = false, stacked = false }: { href?: string; light?: boolean; stacked?: boolean }) {
  if (stacked) {
    return (
      <Link
        href={href}
        className="shrink-0"
        aria-label="Sambike · servis bicyklov"
        style={{ display: "inline-flex", width: "5.5rem", flexDirection: "column", alignItems: "center", gap: ".25rem" }}
      >
        <Image
          src="/brand/sambike-mark.png"
          alt=""
          width={240}
          height={220}
          loading="eager"
          aria-hidden="true"
          style={{ display: "block", width: "2.25rem", height: "auto" }}
        />
        <span className={light ? "text-white" : "text-[var(--ink)]"} aria-hidden="true" style={{ fontSize: "1.45rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-.055em" }}>
          Samb<span className="relative inline-block">ı<span className="absolute left-1/2 top-[-.02em] size-[.26em] -translate-x-1/2 rounded-full bg-[var(--accent)]" /></span>ke
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Sambike · servis bicyklov">
      <Image
        src={light ? "/brand/sambike-wordmark-white.png" : "/brand/sambike-wordmark.png"}
        alt="Sambike"
        width={610}
        height={170}
        loading="eager"
        className="h-auto w-[8.6rem] sm:w-[9.6rem]"
      />
    </Link>
  );
}
