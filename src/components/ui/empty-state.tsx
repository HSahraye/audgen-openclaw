import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

/**
 * Shared empty-state primitive. Use anywhere a list / table / queue
 * legitimately has zero items and you want to communicate "this is a
 * normal state, here's what to do next" rather than rendering an
 * awkward blank patch of UI.
 *
 * Variants:
 *  - `default` (light card on the page background, used inside dashboards)
 *  - `inline`  (no card chrome, for use inside other cards)
 *
 * The CTA is optional. If supplied as `href`, it renders as a Next Link;
 * `onClick` (client-side action) renders as a button. Keep them mutually
 * exclusive at the call site — TS allows both, but pick one.
 */
export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  variant?: "default" | "inline";
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  variant = "default",
  className,
}: EmptyStateProps) {
  const card = variant === "default";
  return (
    <div
      role="status"
      className={clsx(
        "text-center",
        card &&
          "rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8",
        !card && "py-6",
        className,
      )}
    >
      {Icon ? (
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="text-base font-black text-slate-900">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          {description}
        </p>
      ) : null}
      {ctaLabel && (ctaHref || ctaOnClick) ? (
        <div className="mt-5">
          {ctaHref ? (
            <Link
              href={ctaHref}
              className="inline-flex h-10 items-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
            >
              {ctaLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={ctaOnClick}
              className="inline-flex h-10 items-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
            >
              {ctaLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
