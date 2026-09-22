import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/admin" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex w-36 shrink-0 sm:w-40" aria-label="Sambike · servis bicyklov">
      <Image
        src="/brand/sambike-service-logo.png"
        alt="Sambike · servis bicyklov"
        width={1600}
        height={435}
        loading="eager"
        className="h-auto w-full"
      />
    </Link>
  );
}
