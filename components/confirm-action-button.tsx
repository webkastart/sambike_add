"use client";

export function ConfirmActionButton({ action, label, confirmation }: { action: () => Promise<void>; label: string; confirmation: string }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm(confirmation)) event.preventDefault(); }}><button type="submit" className="rounded-lg border border-[#b85b55] px-4 py-2 text-sm font-semibold text-[#963d37] hover:bg-[#fff5f4]">{label}</button></form>;
}
