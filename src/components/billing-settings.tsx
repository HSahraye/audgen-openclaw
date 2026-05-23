"use client";

import { useState, useTransition } from "react";
import type { PlanTier, WorkspaceStatus } from "@prisma/client";
import {
  formatPlanPrice,
  PLAN_CUSTOMER_LABELS,
  PLAN_DISPLAY,
  SAAS_CHECKOUT_TIERS,
} from "@/lib/billing/plans";

type UsageSummary = Record<string, number>;

const SALES_CONTACT_EMAIL = "Sahrayeh@Salegen.com";

export function BillingSettings(props: {
  workspaceName: string;
  planTier: PlanTier;
  status: WorkspaceStatus;
  trialEndsAt: string | null;
  usage: UsageSummary;
  limits: UsageSummary;
  canManage: boolean;
}) {
  const [error, setError] = useState("");
  const [pendingTier, setPendingTier] = useState<PlanTier | null>(null);
  const [isPending, startTransition] = useTransition();

  const launchCheckout = (tier: PlanTier) => {
    startTransition(async () => {
      setError("");
      setPendingTier(tier);
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tier }),
        });
        const payload = (await response.json()) as { ok?: boolean; url?: string; error?: string };
        if (!payload.ok || !payload.url) {
          setError(payload.error || "Unable to start checkout.");
          return;
        }
        window.location.href = payload.url;
      } catch (checkoutError) {
        setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout.");
      } finally {
        setPendingTier(null);
      }
    });
  };

  const openPortal = () => {
    startTransition(async () => {
      setError("");
      try {
        const response = await fetch("/api/billing/portal", { method: "POST" });
        const payload = (await response.json()) as { ok?: boolean; url?: string; error?: string };
        if (!payload.ok || !payload.url) {
          setError(payload.error || "Unable to open billing portal.");
          return;
        }
        window.location.href = payload.url;
      } catch (portalError) {
        setError(portalError instanceof Error ? portalError.message : "Unable to open billing portal.");
      }
    });
  };

  const planOptions: Array<{ tier: PlanTier; label: string; price: string; selfServe: boolean; popular?: boolean }> = [
    { tier: "starter", label: PLAN_CUSTOMER_LABELS.starter, price: formatPlanPrice(PLAN_DISPLAY.starter.monthlyPriceCents), selfServe: true },
    { tier: "growth", label: PLAN_CUSTOMER_LABELS.growth, price: formatPlanPrice(PLAN_DISPLAY.growth.monthlyPriceCents), selfServe: true, popular: true },
    { tier: "agency", label: PLAN_CUSTOMER_LABELS.agency, price: formatPlanPrice(PLAN_DISPLAY.agency.monthlyPriceCents), selfServe: true },
    { tier: "enterprise", label: PLAN_CUSTOMER_LABELS.enterprise, price: "Contact sales", selfServe: false },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Workspace Billing</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">{props.workspaceName}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Current plan: <span className="font-black">{PLAN_CUSTOMER_LABELS[props.planTier]}</span> · Status: <span className="font-black uppercase">{props.status}</span>
        </p>
        {props.trialEndsAt ? (
          <p className="mt-1 text-sm text-amber-700">
            Trial ends on {new Date(props.trialEndsAt).toLocaleDateString()}
          </p>
        ) : null}
        {props.canManage ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={isPending}
            className="mt-3 h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Open billing portal
          </button>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Usage This Month</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(props.limits).map(([key, limit]) => {
            const used = props.usage[key] ?? 0;
            return (
              <div key={key} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{key.replaceAll("_", " ")}</p>
                <p className="mt-1 text-lg font-black text-slate-950">{used} / {limit}</p>
              </div>
            );
          })}
        </div>
      </div>

      {props.canManage ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Plan Comparison</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {planOptions.map((plan) => (
              <div key={plan.tier} className="rounded-2xl border border-slate-200 p-3">
                <p className="text-sm font-black">{plan.label}</p>
                {plan.popular ? (
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-lime-700">Most popular</p>
                ) : null}
                <p className="text-xs text-slate-500">{plan.price}</p>
                {plan.selfServe && SAAS_CHECKOUT_TIERS.includes(plan.tier as (typeof SAAS_CHECKOUT_TIERS)[number]) ? (
                  <button
                    type="button"
                    onClick={() => launchCheckout(plan.tier)}
                    disabled={isPending || pendingTier === plan.tier}
                    className="mt-3 h-9 w-full rounded-xl bg-slate-950 text-xs font-black text-white disabled:opacity-60"
                  >
                    {pendingTier === plan.tier ? "Opening..." : props.planTier === plan.tier ? "Current plan" : "Choose plan"}
                  </button>
                ) : (
                  <a
                    href={`mailto:${SALES_CONTACT_EMAIL}?subject=AuditGen%20Custom%20plan`}
                    className="mt-3 flex h-9 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50"
                  >
                    Contact sales
                  </a>
                )}
              </div>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm font-bold text-rose-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
