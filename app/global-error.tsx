"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="sk">
      <body>
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 text-center">
          <h1 className="text-3xl font-semibold">Niečo sa nepodarilo</h1>
          <p className="mt-3 text-[#6f6d6d]">Skúste stránku načítať znova. Ak problém pretrváva, kontaktujte správcu.</p>
          <button type="button" onClick={reset} className="mx-auto mt-7 rounded-lg bg-[#26372a] px-5 py-3 font-semibold text-white">Skúsiť znova</button>
        </main>
      </body>
    </html>
  );
}
