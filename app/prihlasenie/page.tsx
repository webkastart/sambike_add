import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { loginAdmin } from "@/app/auth-actions";
import { hasAdminSession, isAdminAuthenticationConfigured } from "@/lib/admin-auth";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ config?: string; error?: string; next?: string }>;
}) {
  const query = await searchParams;
  if (await hasAdminSession()) redirect("/admin");
  const configured = isAdminAuthenticationConfigured();
  const nextPath = query.next?.startsWith("/admin") ? query.next : "/admin";

  return (
    <main className="min-h-screen px-5 py-8 sm:px-10">
      <div className="mx-auto max-w-sm">
        <Logo />
        <div className="mt-24">
          <LockKeyhole size={20} className="text-[#7f8981]" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-semibold tracking-[-.035em]">Prihlásenie</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#737c75]">
            Administrácia obsahuje osobné údaje a ovládanie reklamného rozpočtu.
          </p>

          {!configured ? (
            <p className="mt-8 border-y border-[var(--line)] py-5 text-sm leading-relaxed text-[#8a4b46]">
              V hostingu nastavte premennú <code>ADMIN_PASSWORD</code> a aplikáciu reštartujte.
            </p>
          ) : (
            <form action={loginAdmin} className="mt-9">
              <input type="hidden" name="next" value={nextPath} />
              <label>
                <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Heslo</span>
                <input
                  className="admin-field"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              {query.error && <p className="mt-4 text-sm font-medium text-[#a1433e]">Heslo nie je správne.</p>}
              <button
                type="submit"
                className="mt-7 inline-flex min-h-10 items-center rounded-lg bg-[var(--accent-dark)] px-4 text-sm font-semibold text-white transition hover:bg-[#314336]"
              >
                Prihlásiť sa
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
