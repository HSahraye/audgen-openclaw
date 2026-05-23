import { Suspense } from "react";
import {
  LandingNav,
  HeroSection,
  LoopSection,
  HowItWorksSection,
  FeatureGroupsSection,
  SampleAuditSection,
  SocialProofSection,
  PricingSection,
  FaqSection,
  FinalCtaSection,
  LandingFooter,
} from "./landing-sections";
import { AuthPanelSkeleton, LoginAuthPanel } from "./login-auth-panel";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-slate-950">
      <Suspense fallback={<LandingNav />}>
        <LoginNav searchParams={searchParams} />
      </Suspense>
      <HeroSection />
      <LoopSection />
      <HowItWorksSection />
      <FeatureGroupsSection />
      <SampleAuditSection />
      <SocialProofSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />

      <Suspense fallback={<AuthPanelSkeleton />}>
        <LoginAuthPanel searchParams={searchParams} />
      </Suspense>

      <LandingFooter />
    </main>
  );
}

async function LoginNav({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  return <LandingNav next={params.next} />;
}
