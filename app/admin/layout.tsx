import { AdminNav } from "@/components/admin-nav";
import { Logo } from "@/components/logo";
import { logoutAdmin } from "@/app/auth-actions";
import { isAdminAuthenticationConfigured, requireAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const authenticationConfigured = isAdminAuthenticationConfigured();

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <aside className="fixed inset-x-0 top-0 z-30 border-b border-[var(--line)] bg-[rgba(251,252,250,.94)] backdrop-blur md:inset-y-0 md:right-auto md:w-56 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between px-5 md:h-auto md:block md:px-6 md:pt-7">
          <Logo />
          <div className="md:mt-12"><AdminNav /></div>
        </div>
        <div className="absolute bottom-6 left-6 hidden md:block">
          {authenticationConfigured ? (
            <form action={logoutAdmin}>
              <button className="text-xs text-[#929a94] transition hover:text-[var(--ink)]" type="submit">
                Odhlásiť sa
              </button>
            </form>
          ) : (
            <p className="text-xs leading-relaxed text-[#929a94]">Lokálny režim<br />bez hesla</p>
          )}
        </div>
      </aside>
      <main className="px-5 pb-16 pt-24 md:ml-56 md:px-10 md:pt-10 lg:px-16">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
