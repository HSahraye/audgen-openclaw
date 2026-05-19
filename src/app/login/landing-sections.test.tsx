import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  HOW_IT_WORKS_CARDS,
  PRICING_TIERS,
  HERO_HEADLINE,
  HERO_SUBHEAD,
  SOCIAL_PROOF,
  DEMO_EMAIL,
  HeroSection,
  HowItWorksSection,
  PricingSection,
  SocialProofSection,
  LandingFooter,
  LandingNav,
} from "./landing-sections";

// ---------------------------------------------------------------------------
// Minimal React-element tree walker (no jsdom required)
// ---------------------------------------------------------------------------

function findString(node: unknown, needle: string): boolean {
  if (typeof node === "string") return node.includes(needle);
  if (typeof node === "number") return String(node).includes(needle);
  if (Array.isArray(node)) return node.some((c) => findString(c, needle));
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props: { children?: unknown; [k: string]: unknown } }).props;
    if (findString(props.children, needle)) return true;
    // also scan href / value props
    for (const v of Object.values(props)) {
      if (typeof v === "string" && v.includes(needle)) return true;
    }
  }
  return false;
}

function findAllHrefs(node: unknown, acc: string[] = []): string[] {
  if (!node || typeof node !== "object") return acc;
  if (Array.isArray(node)) {
    for (const c of node) findAllHrefs(c, acc);
    return acc;
  }
  const obj = node as { props?: { href?: unknown; children?: unknown; [k: string]: unknown } };
  if (obj.props) {
    if (typeof obj.props.href === "string") acc.push(obj.props.href);
    findAllHrefs(obj.props.children, acc);
    for (const [k, v] of Object.entries(obj.props)) {
      if (k !== "children" && k !== "href") findAllHrefs(v, acc);
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe("landing-sections constants", () => {
  it("HERO_HEADLINE is non-empty and mentions local-services", () => {
    expect(HERO_HEADLINE.length).toBeGreaterThan(20);
    expect(HERO_HEADLINE.toLowerCase()).toContain("local-services");
  });

  it("HERO_SUBHEAD mentions AuditGen", () => {
    expect(HERO_SUBHEAD).toContain("AuditGen");
  });

  it("HOW_IT_WORKS_CARDS has exactly 3 cards with the right titles", () => {
    expect(HOW_IT_WORKS_CARDS).toHaveLength(3);
    const titles = HOW_IT_WORKS_CARDS.map((c) => c.title);
    expect(titles).toContain("Discover");
    expect(titles).toContain("Audit");
    expect(titles).toContain("Pitch");
  });

  it("PRICING_TIERS has exactly 4 tiers", () => {
    expect(PRICING_TIERS).toHaveLength(4);
  });

  it("PRICING_TIERS includes Starter, Pro, Scale, Custom", () => {
    const names = PRICING_TIERS.map((t) => t.name);
    expect(names).toContain("Starter");
    expect(names).toContain("Pro");
    expect(names).toContain("Scale");
    expect(names).toContain("Custom");
  });

  it("SOCIAL_PROOF mentions agencies", () => {
    expect(SOCIAL_PROOF.toLowerCase()).toContain("agenc");
  });
});

// ---------------------------------------------------------------------------
// Component render checks
// ---------------------------------------------------------------------------

describe("HowItWorksSection render", () => {
  it("renders all three card titles", () => {
    const tree = HowItWorksSection();
    expect(findString(tree, "Discover")).toBe(true);
    expect(findString(tree, "Audit")).toBe(true);
    expect(findString(tree, "Pitch")).toBe(true);
  });

  it("renders step numbers 01, 02, 03", () => {
    const tree = HowItWorksSection();
    expect(findString(tree, "01")).toBe(true);
    expect(findString(tree, "02")).toBe(true);
    expect(findString(tree, "03")).toBe(true);
  });
});

describe("PricingSection render", () => {
  it("renders all four tier names", () => {
    const tree = PricingSection();
    expect(findString(tree, "Starter")).toBe(true);
    expect(findString(tree, "Pro")).toBe(true);
    expect(findString(tree, "Scale")).toBe(true);
    expect(findString(tree, "Custom")).toBe(true);
  });

  it("renders pricing amounts", () => {
    const tree = PricingSection();
    expect(findString(tree, "$99")).toBe(true);
    expect(findString(tree, "$199")).toBe(true);
    expect(findString(tree, "$399")).toBe(true);
  });

  it("all tier CTAs link to #signin", () => {
    const tree = PricingSection();
    const hrefs = findAllHrefs(tree);
    const signinHrefs = hrefs.filter((h) => h === "#signin");
    // 4 tiers, each with a CTA → 4 links
    expect(signinHrefs.length).toBeGreaterThanOrEqual(4);
  });
});

describe("HeroSection render", () => {
  it("renders the headline", () => {
    const tree = HeroSection();
    expect(findString(tree, "local-services")).toBe(true);
  });

  it("Sign in CTA links to #signin", () => {
    const tree = HeroSection();
    const hrefs = findAllHrefs(tree);
    expect(hrefs).toContain("#signin");
  });

  it("Book a demo CTA links to demo email", () => {
    const tree = HeroSection();
    const hrefs = findAllHrefs(tree);
    expect(hrefs.some((h) => h.startsWith("mailto:"))).toBe(true);
  });
});

describe("LandingNav render", () => {
  it("Sign in anchor points to #signin", () => {
    const tree = LandingNav({ next: undefined });
    const hrefs = findAllHrefs(tree);
    expect(hrefs.some((h) => h.includes("#signin"))).toBe(true);
  });

  it("demo link points to demo email", () => {
    const tree = LandingNav({});
    const hrefs = findAllHrefs(tree);
    expect(hrefs.some((h) => h === `mailto:${DEMO_EMAIL}`)).toBe(true);
  });
});

describe("SocialProofSection render", () => {
  it("renders the social proof text", () => {
    const tree = SocialProofSection();
    expect(findString(tree, "agency")).toBe(true);
  });
});

describe("LandingFooter render", () => {
  it("renders AuditGen brand name", () => {
    const tree = LandingFooter();
    expect(findString(tree, "AuditGen")).toBe(true);
  });

  it("does not render Presence Labs", () => {
    const tree = LandingFooter();
    expect(findString(tree, "Presence Labs")).toBe(false);
  });

  it("renders contact email", () => {
    const tree = LandingFooter();
    expect(findString(tree, DEMO_EMAIL)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No Presence Labs in rendered surfaces
// ---------------------------------------------------------------------------

describe("brand-clean: no Presence Labs in landing page source", () => {
  const pageSrc = readFileSync(
    path.resolve(__dirname, "page.tsx"),
    "utf8",
  );
  const sectionsSrc = readFileSync(
    path.resolve(__dirname, "landing-sections.tsx"),
    "utf8",
  );

  it("page.tsx does not mention Presence Labs", () => {
    expect(pageSrc).not.toContain("Presence Labs");
  });

  it("landing-sections.tsx does not mention Presence Labs", () => {
    expect(sectionsSrc).not.toContain("Presence Labs");
  });
});
