"use client";

import dynamic from "next/dynamic";
import type { AccountIndicatorProps } from "./account-indicator-client";

/**
 * Thin client wrapper that loads the real AccountIndicatorClient via
 * `next/dynamic` with `ssr: false`. This is the fix for a `/_global-error`
 * prerender crash:
 *
 *     TypeError: Cannot read properties of null (reading 'useContext')
 *       at useRouter (next/navigation)
 *
 * Root cause: AccountIndicatorClient calls `useRouter()` and
 * `usePathname()` from `next/navigation`. During Next.js's prerender of
 * `/_global-error`, the AppRouterContext.Provider is intentionally
 * absent — that page is the synthesised crash-state shell. The hook
 * tries to read `dispatcher.useContext`, finds null, and throws,
 * failing the build with a useless stack inside React internals.
 *
 * `dynamic({ ssr: false, loading: () => null })` defers the entire
 * module load (and therefore every hook call) to the browser. During
 * SSR / prerender the wrapper renders the loading fallback (null), so
 * no router hook ever fires while the AppRouterContext is missing.
 *
 * Once hydration completes on the client, the dynamic chunk loads,
 * AccountIndicatorClient mounts with all hooks intact, and the pill
 * appears. Behaviour is otherwise identical to importing the component
 * directly.
 */
const Inner = dynamic(
  () =>
    import("./account-indicator-client").then((mod) => ({
      default: mod.AccountIndicatorClient,
    })),
  { ssr: false, loading: () => null },
);

export function AccountIndicatorClientMount(props: AccountIndicatorProps) {
  return <Inner {...props} />;
}
