import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8faf6] px-5 text-center">
      <div>
        <Logo href="/" />
        <p className="mt-12 text-xs font-bold uppercase tracking-[.18em] text-[#7f8981]">404</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em]">Táto stránka nie je dostupná</h1>
        <p className="mx-auto mt-4 max-w-md text-[#6e7870]">Odkaz je neplatný alebo stránka už nie je aktívna.</p>
        <Link href="/admin" className="mt-8 inline-block border-b border-[#5e695f] pb-1 text-sm font-semibold">Späť do administrácie</Link>
      </div>
    </main>
  );
}
