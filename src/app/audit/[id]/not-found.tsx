import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { BRAND } from "@/lib/brand";

/**
 * Public audit 404. This page is customer-facing — keep the tone friendly,
 * never expose internals, and never imply the prospect did something wrong.
 */
export default function AuditNotFound() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-slate-500">
          <LinkIcon className="h-5 w-5" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.2em]">
            Audit unavailable
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          This audit link isn&rsquo;t active.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The link may have expired or been replaced with an updated version.
          Reach out to whoever sent it and they can share the latest one.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
          >
            Visit {BRAND.productName}
          </Link>
        </div>
      </div>
    </main>
  );
}
