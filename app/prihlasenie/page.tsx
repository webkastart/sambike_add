import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAdmin } from "@/app/auth-actions";
import { adminAuthConfigured, isAdminAuthenticated } from "@/lib/admin-auth";
import { safeAdminReturnTo } from "@/lib/session-core";

export const metadata: Metadata = { title: "Prihlásenie", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; rate?: string; next?: string }> }) {
  const query = await searchParams;
  const next = safeAdminReturnTo(query.next);
  if (await isAdminAuthenticated()) redirect(next);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-5">
      <form action={loginAdmin} className="w-full">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">SAMBIKE</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">Prihlásenie</h1>
        <p className="mt-2 text-sm leading-6 text-[#737c75]">Interná administrácia kampaní a leadov.</p>
        <input type="hidden" name="next" value={next} />
        <label className="mt-8 block">
          <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#7c867e]">Heslo</span>
          <input className="admin-field" type="password" name="password" autoComplete="current-password" required />
        </label>
        {query.error && <p className="mt-4 text-sm text-[#9a3530]" role="alert">Heslo nie je správne.</p>}
        {query.rate && <p className="mt-4 text-sm text-[#9a3530]" role="alert">Príliš veľa pokusov. Počkajte niekoľko minút a skúste to znova.</p>}
        {!adminAuthConfigured() && process.env.NODE_ENV !== "production" && <p className="mt-4 text-sm text-[#9a6b25]">Lokálny vývoj používa heslo <code>admin</code>. Nastavte ADMIN_PASSWORD a ADMIN_SESSION_SECRET.</p>}
        <button className="mt-7 h-11 w-full rounded-lg bg-[var(--accent-dark)] px-5 text-sm font-semibold text-white" type="submit">Prihlásiť sa</button>
      </form>
    </main>
  );
}
