import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  issueSession,
  resolveRoleFromPassword,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  getFailedAuthState,
  registerFailedAuthAttempt,
  clearFailedAuthAttempts,
} from "@/lib/auth";
import {
  SIGNUP_ERROR_CODES,
  SIGNUP_ERROR_MESSAGES,
  type SignupErrorCode,
} from "@/lib/auth/signup-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { BRAND } from "@/lib/brand";
import { AuditGenLogo } from "@/components/brand/auditgen-logo";

export const dynamic = "force-dynamic";

const SIGNUP_ERROR_CODE_SET = new Set<string>(SIGNUP_ERROR_CODES);

function resolveSignupMessage(rawError: string | undefined): string | null {
  if (!rawError) return null;
  const stripped = rawError.startsWith("signup-") ? rawError.slice("signup-".length) : rawError;
  if (rawError === "invalid-signup" || stripped === "unknown") {
    return SIGNUP_ERROR_MESSAGES.unknown;
  }
  if (SIGNUP_ERROR_CODE_SET.has(stripped)) {
    return SIGNUP_ERROR_MESSAGES[stripped as SignupErrorCode];
  }
  return null;
}

async function loginAction(formData: FormData) {
  "use server";
  const mode = String(formData.get("mode") ?? "signin");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("name") ?? "").trim();
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();
  const next = String(formData.get("next") ?? "/");
  if (mode === "signup") {
    const signUp = await signUpWithEmailPassword({
      email,
      password,
      name: fullName,
      workspaceName,
    });
    if (!signUp.ok) {
      const code = signUp.code ?? "unknown";
      redirect(
        `/login?mode=signup&next=${encodeURIComponent(next || "/")}&error=signup-${encodeURIComponent(code)}`,
      );
    }
    redirect(next || "/");
  }
  if (email && password) {
    const signIn = await signInWithEmailPassword(email, password);
    if (!signIn.ok) {
      redirect(`/login?next=${encodeURIComponent(next || "/")}&error=invalid`);
    }
    redirect(next || "/");
  }

  // SECURITY: legacy shared-password fallback. This path has no per-user
  // attribution and is scheduled for removal once all real accounts are on
  // email+password. Until then:
  //   1. Hard rate-limit by client IP (10 / 15 min, then exponential lockout).
  //   2. Track failed attempts in the same throttle map as better-auth.
  //   3. Legacy sessions are explicitly disallowed from /admin (see
  //      requirePlatformAdmin in src/lib/authz.ts).
  // TODO(security): remove this fallback entirely after legacy migration.
  const headerStore = await headers();
  const clientIp =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "anonymous";
  const legacyKey = `legacy-login:${clientIp}`;
  const rate = checkRateLimit(legacyKey, 10, 15 * 60_000);
  if (!rate.ok) {
    redirect(`/login?next=${encodeURIComponent(next || "/")}&error=invalid`);
  }
  const throttle = getFailedAuthState(legacyKey);
  if (throttle.locked) {
    redirect(`/login?next=${encodeURIComponent(next || "/")}&error=invalid`);
  }
  const role = resolveRoleFromPassword(password);
  if (!role) {
    registerFailedAuthAttempt(legacyKey);
    redirect(`/login?next=${encodeURIComponent(next || "/")}&error=invalid`);
  }
  clearFailedAuthAttempts(legacyKey);
  await issueSession(role);
  redirect(next || "/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const hasError = Boolean(params.error);
  const isSignup = params.mode === "signup";
  const signupSpecificMessage = isSignup ? resolveSignupMessage(params.error) : null;
  return (
    <main className="min-h-screen bg-[#f5f7f2] p-6">
      <div className="mx-auto grid w-full max-w-5xl gap-8 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <AuditGenLogo variant="horizontal" className="h-10" />
          <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#64748B]">{BRAND.tagline}</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">
            Turn local business research into client-ready audits.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#64748B]">
            Generate audits, manage leads, and track agency outreach from one operating system.
          </p>
        </section>
        <form action={loginAction} className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#64748B]">{BRAND.productName}</p>
          <h1 className="mt-2 text-2xl font-black">Sign in</h1>
          <p className="mt-2 text-sm text-slate-500">
            {isSignup ? "Create your workspace owner account." : "Sign in with email/password. Legacy team password is still supported."}
          </p>
          <div className="mt-3 flex gap-2">
            <a href={`/login?mode=signin&next=${encodeURIComponent(params.next || "/")}`} className={`rounded-xl px-3 py-1.5 text-xs font-black ${!isSignup ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>Sign in</a>
            <a href={`/login?mode=signup&next=${encodeURIComponent(params.next || "/")}`} className={`rounded-xl px-3 py-1.5 text-xs font-black ${isSignup ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>Create account</a>
          </div>
        </div>
        <input type="hidden" name="next" value={params.next || "/"} />
        <input type="hidden" name="mode" value={isSignup ? "signup" : "signin"} />
        {isSignup ? (
          <>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Full Name
              <input name="name" type="text" required className="h-11 rounded-2xl border border-slate-200 px-3 outline-none focus:border-[#10B981]" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Workspace Name
              <input name="workspaceName" type="text" required className="h-11 rounded-2xl border border-slate-200 px-3 outline-none focus:border-[#10B981]" />
            </label>
          </>
        ) : null}
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required={isSignup}
            className="h-11 rounded-2xl border border-slate-200 px-3 outline-none focus:border-[#10B981]"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Password
          <input
            name="password"
            type="password"
            required={isSignup}
            minLength={isSignup ? 8 : undefined}
            maxLength={isSignup ? 128 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="h-11 rounded-2xl border border-slate-200 px-3 outline-none focus:border-[#10B981]"
          />
          {isSignup ? (
            <span className="text-[11px] font-medium text-slate-500">At least 8 characters.</span>
          ) : null}
        </label>
        <button className="h-11 rounded-2xl bg-[#0F172A] text-sm font-black text-white hover:bg-slate-800">
          {isSignup ? "Create workspace" : "Continue"}
        </button>
        {!isSignup ? (
          <p className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
            Legacy fallback: leave email blank and enter a shared role password.
          </p>
        ) : null}
        {hasError ? (
          <p className="text-xs font-bold text-rose-600">
            {signupSpecificMessage ?? "Authentication failed. Check inputs and retry."}
          </p>
        ) : null}
      </form>
      </div>
    </main>
  );
}
