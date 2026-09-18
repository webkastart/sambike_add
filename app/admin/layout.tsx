import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { Logo } from "@/components/logo";
import { logoutAdmin } from "@/app/auth-actions";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <aside className="fixed inset-x-0 top-0 z-30 border-b border-[var(--line)] bg-[rgba(251,251,250,.96)] backdrop-blur md:inset-y-0 md:right-auto md:w-56 md:border-b-0 md:border-r">
        <div className="flex h-24 items-center px-5 md:h-auto md:px-6 md:pt-7">
          <Logo />
        </div>
        <div className="border-t border-[var(--line)] md:mt-10 md:border-t-0 md:px-3"><AdminNav /></div>
        <form action={logoutAdmin} className="absolute right-4 top-10 md:static md:px-6">
          <button className="text-xs text-[#7c867e] hover:text-[var(--ink)] md:mt-8" type="submit">Odhlásiť sa</button>
        </form>
      </aside>
      <main className="px-4 pb-16 pt-44 sm:px-6 md:ml-56 md:px-10 md:pt-10 lg:px-16">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
