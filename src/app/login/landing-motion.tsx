"use client";

/**
 * Client-side motion primitives for the marketing landing.
 *
 * Design rules (non-negotiable, see SAFETY in the landing-motion task):
 *  - Every primitive respects prefers-reduced-motion. When reduced, we
 *    skip the animation and render the final state immediately.
 *  - Animations only touch transform/opacity. No width/height/top reflow.
 *  - In-view animations use `once: true` so they never re-fire on scroll up.
 *  - Hero text uses a tiny entrance (8px lift, <250ms per item) so the
 *    LCP candidate (the H1) is visible essentially on first frame.
 *  - No infinite JS loops; the only continuous animation is a CSS pulse
 *    on the "LIVE" badge (cheap, GPU-only) which is disabled by
 *    media (prefers-reduced-motion).
 */

import {
  motion,
  useInView,
  useReducedMotion,
  useMotionValue,
  useTransform,
  animate,
  useMotionTemplate,
  type MotionValue,
  type Transition,
} from "motion/react";
import {
  createElement,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Shared transitions
// ---------------------------------------------------------------------------

const EASE_OUT: Transition["ease"] = [0.16, 1, 0.3, 1];

// ---------------------------------------------------------------------------
// Reveal — generic scroll-in fade+lift.
// Reduced-motion fallback: no transition, renders at the final state.
// ---------------------------------------------------------------------------

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Vertical offset in px to animate from. Default 14. */
  y?: number;
  /** Delay in seconds before this element starts animating. */
  delay?: number;
  /** Duration in seconds. Default 0.5. */
  duration?: number;
  /** Element tag. Default "div". */
  as?: "div" | "section" | "article" | "li" | "p" | "h2" | "h3";
};

export function Reveal({
  children,
  className,
  y = 14,
  delay = 0,
  duration = 0.5,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return createElement(as, { className }, children);
  }
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// HeroIntro — staggers eyebrow → headline → subline → CTAs.
// Runs on mount (not on scroll) so the hero animates immediately above the
// fold. Total budget ≈ 380ms; per-item lift is 6px so the H1 LCP candidate
// is visible essentially on first frame.
// ---------------------------------------------------------------------------

export function HeroIntro({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.07, delayChildren: 0.05 },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

const HERO_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT },
  },
};

export function HeroItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "p" | "h1" | "h2" | "ul" | "li";
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return createElement(as, { className }, children);
  }
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag className={className} variants={HERO_ITEM_VARIANTS}>
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// HeroAurora — gentle animated gradient wash behind the hero.
// Pure CSS keyframe (set in <style jsx global>) for cheap GPU transform;
// reduced-motion disables the animation via @media.
// ---------------------------------------------------------------------------

export function HeroAurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="landing-aurora landing-aurora--lime" />
      <div className="landing-aurora landing-aurora--emerald" />
      <div className="landing-aurora landing-aurora--cream" />
      <style jsx global>{`
        .landing-aurora {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.55;
          will-change: transform;
          animation: landing-aurora-drift 22s ease-in-out infinite alternate;
        }
        .landing-aurora--lime {
          top: -120px;
          right: -80px;
          width: 460px;
          height: 460px;
          background: radial-gradient(closest-side, rgba(190, 242, 100, 0.45), rgba(190, 242, 100, 0));
          animation-duration: 24s;
        }
        .landing-aurora--emerald {
          bottom: -160px;
          left: -120px;
          width: 520px;
          height: 520px;
          background: radial-gradient(closest-side, rgba(110, 231, 183, 0.35), rgba(110, 231, 183, 0));
          animation-duration: 30s;
          animation-direction: alternate-reverse;
        }
        .landing-aurora--cream {
          top: 20%;
          left: 35%;
          width: 380px;
          height: 380px;
          background: radial-gradient(closest-side, rgba(245, 247, 242, 0.9), rgba(245, 247, 242, 0));
          opacity: 0.4;
          animation-duration: 28s;
        }
        @keyframes landing-aurora-drift {
          0%   { transform: translate3d(0, 0, 0) scale(1); }
          50%  { transform: translate3d(18px, -22px, 0) scale(1.05); }
          100% { transform: translate3d(-12px, 14px, 0) scale(0.98); }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-aurora { animation: none !important; }
        }
        .landing-live-pulse {
          animation: landing-live-pulse 1.8s ease-in-out infinite;
        }
        @keyframes landing-live-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-live-pulse { animation: none !important; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LivePulse — small dot before the "Live" badge text.
// Pure CSS pulse, reduced-motion safe via media query above.
// ---------------------------------------------------------------------------

export function LivePulse() {
  return (
    <span
      aria-hidden
      className="landing-live-pulse inline-block size-1.5 rounded-full bg-lime-500"
    />
  );
}

// ---------------------------------------------------------------------------
// CountUp — animates a number when scrolled into view (once).
// Renders the final value at SSR/mount so layout reserves the correct width;
// the count-up only swaps the visible text via a MotionValue subscription.
// Reduced-motion fallback: just the final value, no animation.
// ---------------------------------------------------------------------------

type CountUpProps = {
  /** Final numeric target. */
  to: number;
  /** Number of decimals to render. Default 0. */
  decimals?: number;
  /** Prefix string (e.g. "$"). */
  prefix?: string;
  /** Suffix string (e.g. "k", " / 100"). */
  suffix?: string;
  /** Animation duration seconds. Default 1.1. */
  duration?: number;
  /** Optional className for the wrapping span. */
  className?: string;
};

export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.1,
  className,
}: CountUpProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState<string>(() => formatNumber(to, decimals, prefix, suffix));

  useEffect(() => {
    if (reduce || !inView) return;
    setDisplay(formatNumber(0, decimals, prefix, suffix));
    const controls = animate(mv, to, {
      duration,
      ease: EASE_OUT,
      onUpdate: (latest) => {
        setDisplay(formatNumber(latest, decimals, prefix, suffix));
      },
    });
    return () => controls.stop();
  }, [reduce, inView, to, decimals, prefix, suffix, duration, mv]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {display}
    </span>
  );
}

function formatNumber(n: number, decimals: number, prefix: string, suffix: string) {
  const fixed = n.toFixed(decimals);
  return `${prefix}${fixed}${suffix}`;
}

// ---------------------------------------------------------------------------
// LoopConnector — animated SVG line that "draws" between loop cards on
// scroll-in. Absolute-positioned, doesn't affect layout. Hidden on mobile
// (cards are stacked) via Tailwind hidden/sm:block.
// Reduced-motion fallback: a static line at full length.
// ---------------------------------------------------------------------------

export function LoopConnector() {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <svg
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-[68px] z-0 hidden h-px lg:block"
      viewBox="0 0 1200 4"
      preserveAspectRatio="none"
      width="100%"
      height="4"
    >
      <motion.line
        x1="60"
        y1="2"
        x2="1140"
        y2="2"
        stroke="rgb(132 204 22 / 0.55)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 8"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={inView || reduce ? { pathLength: 1 } : { pathLength: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 1.1, ease: EASE_OUT, delay: 0.2 }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// HoverCard — generic scroll-in card with hover lift.
// Used by Loop stages, Feature groups, Pricing tiers.
// Reduced-motion fallback: no entrance animation, no hover lift.
// ---------------------------------------------------------------------------

type HoverCardProps = {
  children: ReactNode;
  className?: string;
  /** Stagger index for entrance. */
  index?: number;
  /** Tag — li for ordered lists, article for content blocks, div default. */
  as?: "div" | "li" | "article";
  /** Disable the hover lift (e.g. dark/emphasis cards). */
  noHover?: boolean;
};

export function HoverCard({
  children,
  className,
  index = 0,
  as = "div",
  noHover = false,
}: HoverCardProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return createElement(as, { className }, children);
  }
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: EASE_OUT }}
      whileHover={noHover ? undefined : { y: -4 }}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// SpotlightCard — feature card with a soft lime spotlight that follows
// the pointer on hover. Pointer-only (no touch); reduced-motion fallback is
// a plain card with no spotlight.
// ---------------------------------------------------------------------------

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  index?: number;
};

export function SpotlightCard({ children, className, index = 0 }: SpotlightCardProps) {
  const reduce = useReducedMotion();
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const background = useMotionTemplate`radial-gradient(180px circle at ${x}px ${y}px, rgba(190, 242, 100, 0.18), transparent 70%)`;

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left);
    y.set(event.clientY - rect.top);
  }

  function onPointerLeave() {
    x.set(-200);
    y.set(-200);
  }

  if (reduce) {
    return <article className={className}>{children}</article>;
  }

  return (
    <motion.article
      className={`group relative ${className ?? ""}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: EASE_OUT }}
      whileHover={{ y: -4 }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background }}
      />
      <span className="relative">{children}</span>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// ButtonMotion — wraps a CTA <a> with whileTap micro-feedback only.
// Hover is delegated to existing Tailwind classes so visuals stay identical.
// Reduced-motion: no whileTap.
// ---------------------------------------------------------------------------

type ButtonMotionProps = {
  children: ReactNode;
  className?: string;
  href: string;
  /** Optional anchor target/rel attributes. */
  target?: string;
  rel?: string;
  "aria-label"?: string;
};

export function ButtonMotion({
  children,
  className,
  href,
  target,
  rel,
  "aria-label": ariaLabel,
}: ButtonMotionProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <a className={className} href={href} target={target} rel={rel} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <motion.a
      className={className}
      href={href}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15, ease: EASE_OUT }}
    >
      {children}
    </motion.a>
  );
}

// Re-export Motion values used by callers (kept narrow on purpose).
export type { MotionValue };
export { useReducedMotion as useLandingReducedMotion };

// CSS escape hatch — keep style-typing happy for SSR-only callers.
export const _styleNoop: CSSProperties = {};
