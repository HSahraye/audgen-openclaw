import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { BRAND } from "@/lib/brand";

/**
 * Global 404 — rendered by Next.js for any route that calls `notFound()`
 * or matches no route entry. Public-friendly because public audit slugs
 * route through this page when a lead is missing.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-slate-500">
          <Search className="h-5 w-5" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.2em]">
            404 — not found
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          We couldn&rsquo;t find that page.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The link may be expired, mistyped, or the record was removed. If
          someone shared this with you, ask them to resend the latest link.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to {BRAND.productName}
          </Link>
          <Link
            href="/about"
            className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 hover:bg-slate-50"
          >
            Learn more
          </Link>
        </div>
      </div>
    </main>
  );
}
