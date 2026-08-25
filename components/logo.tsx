import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/admin", light = false }: { href?: string; light?: boolean }) {
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
