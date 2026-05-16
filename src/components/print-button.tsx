"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/75 transition hover:bg-white/10 print:hidden"
    >
      <Printer className="size-4" aria-hidden="true" /> Print to PDF
    </button>
  );
}
