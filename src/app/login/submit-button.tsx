"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export const SUBMIT_LABEL_SIGNIN = "Continue";
export const SUBMIT_LABEL_SIGNUP = "Create workspace";
export const SUBMIT_LABEL_SIGNING_IN = "Signing in\u2026";
export const SUBMIT_LABEL_CREATING = "Creating account\u2026";

export function SubmitButton({ isSignup }: { isSignup: boolean }) {
  const { pending } = useFormStatus();
  const label = pending
    ? isSignup
      ? SUBMIT_LABEL_CREATING
      : SUBMIT_LABEL_SIGNING_IN
    : isSignup
      ? SUBMIT_LABEL_SIGNUP
      : SUBMIT_LABEL_SIGNIN;

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F172A] text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {label}
    </button>
  );
}
