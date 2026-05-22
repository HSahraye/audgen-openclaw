import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "Terms of Service — AuditGen",
  description:
    "Terms governing your access to and use of Salegen / AuditGen, the AI Sales OS for agencies.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-slate-950">
      <div className="mx-auto max-w-3xl px-6 py-14">
        {/* Back nav */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          ← Back
        </Link>

        {/* Header */}
        <div className="mt-6 border-b border-slate-200 pb-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-700">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Effective date: <time dateTime="2026-05-22">May 22, 2026</time>
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to
            and use of Salegen&nbsp;/ AuditGen (the &ldquo;Service&rdquo;),
            operated by Hamid J Sahraye (&ldquo;Presence Labs,&rdquo;
            &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), available
            at{" "}
            <a
              href="https://salegen.org"
              className="underline hover:text-slate-900"
            >
              https://salegen.org
            </a>
            . By creating an account or using the Service, you agree to these
            Terms. If you do not agree, do not use the Service.
          </p>
        </div>

        {/* Body */}
        <div className="mt-8 space-y-10 text-sm leading-7 text-slate-700">
          <Section id="1" title="1. The Service">
            <p>
              Salegen (also referred to as AuditGen) is an AI Sales OS that
              helps B2B revenue teams and agencies import and discover leads,
              score and audit prospective businesses, generate AI-assisted
              audits and outreach materials, and track follow-ups. We may add,
              change, or remove features over time.
            </p>
          </Section>

          <Section id="2" title="2. Eligibility and accounts">
            <p>
              You must be at least 18 years old and able to form a binding
              contract to use the Service. You are responsible for the accuracy
              of your account information, for safeguarding your credentials,
              and for all activity under your account. Notify us promptly of
              any unauthorized use. You may sign in using email and password or
              a supported third-party provider such as Google.
            </p>
          </Section>

          <Section id="3" title="3. Subscriptions, billing, and plans">
            <p>
              The Service is offered on subscription plans (for example,
              Starter, Pro, Scale, and Custom), each with its own price and
              usage allowances such as a monthly audit limit. Current pricing
              is shown at{" "}
              <a
                href="https://salegen.org"
                className="underline hover:text-slate-900"
              >
                https://salegen.org
              </a>
              .
            </p>
            <ul className="mt-4 list-disc space-y-3 pl-5">
              <li>
                <span className="font-semibold text-slate-900">Billing.</span>{" "}
                Paid plans are billed in advance on a recurring basis (for
                example, monthly) until cancelled. By subscribing, you
                authorize us and our payment processor to charge your payment
                method for the applicable fees.
              </li>
              <li>
                <span className="font-semibold text-slate-900">
                  Usage limits.
                </span>{" "}
                Plans include defined allowances (such as audits per month).
                Exceeding allowances may require an upgrade or incur additional
                charges as disclosed at purchase.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Changes.</span>{" "}
                We may change pricing or plan features with reasonable advance
                notice; changes apply at your next billing cycle.
              </li>
              <li>
                <span className="font-semibold text-slate-900">
                  Cancellation.
                </span>{" "}
                You may cancel at any time; cancellation takes effect at the
                end of the current billing period. Except where required by
                law, fees already paid are non-refundable.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Taxes.</span>{" "}
                Fees are exclusive of taxes, which you are responsible for
                where applicable.
              </li>
            </ul>
          </Section>

          <Section id="4" title="4. Acceptable use">
            <p>You agree not to, and not to permit others to:</p>
            <ul className="mt-4 list-disc space-y-3 pl-5">
              <li>
                use the Service for any unlawful purpose or in violation of any
                applicable law or regulation;
              </li>
              <li>
                send outreach, marketing, or communications in violation of
                anti-spam, telemarketing, or data-protection laws (including,
                where applicable, the CAN-SPAM Act, CASL, TCPA, GDPR, and
                similar laws) &mdash; you are solely responsible for the
                legality of any outreach you send;
              </li>
              <li>
                misuse, scrape, or extract data in violation of any
                third-party service&rsquo;s terms (including Google and Yelp),
                or exceed rate limits or other restrictions;
              </li>
              <li>
                attempt to breach security, access another tenant&rsquo;s or
                user&rsquo;s data, reverse engineer, or interfere with the
                Service;
              </li>
              <li>
                upload unlawful, infringing, or harmful content, or use the
                Service to harass or harm others.
              </li>
            </ul>
            <p className="mt-4">
              You are responsible for ensuring you have the right to import,
              process, and contact any lead or business data you bring into or
              generate within the Service.
            </p>
          </Section>

          <Section id="5" title="5. Your data and content">
            <p>
              As between you and us, you retain all rights to the data and
              content you import into or create within the Service (&ldquo;Your
              Content&rdquo;). You grant us a limited, non-exclusive license to
              host, process, and transmit Your Content as necessary to provide
              the Service &mdash; including transmitting relevant data to our
              AI provider to generate audits and outreach. We process personal
              information as described in our Privacy Policy.
            </p>
          </Section>

          <Section id="6" title="6. AI-generated content">
            <p>
              The Service uses AI to generate audits, recommendations, and
              outreach materials.{" "}
              <strong className="font-semibold text-slate-900">
                AI-generated content may be inaccurate, incomplete, or out of
                date, and is provided for informational purposes only. It is
                not professional, legal, financial, or business advice.
              </strong>{" "}
              You are responsible for reviewing, verifying, and editing all
              generated content before relying on or acting upon it, including
              before sending any outreach. We do not guarantee any particular
              result, response rate, or revenue outcome.
            </p>
          </Section>

          <Section id="7" title="7. Intellectual property">
            <p>
              The Service, including its software, design, and content
              (excluding Your Content), is owned by us or our licensors and is
              protected by intellectual property laws. We grant you a limited,
              non-exclusive, non-transferable, revocable license to use the
              Service in accordance with these Terms. You may not copy, modify,
              distribute, or create derivative works of the Service except as
              expressly permitted.
            </p>
          </Section>

          <Section id="8" title="8. Third-party services">
            <p>
              The Service integrates with third-party services (such as Google,
              Yelp, and our AI and infrastructure providers). Your use of those
              integrations may be subject to their terms, and we are not
              responsible for third-party services or their availability.
            </p>
          </Section>

          <Section id="9" title="9. Disclaimers">
            <p className="uppercase">
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
              AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER
              EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
              UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY CONTENT OR
              RESULTS WILL BE ACCURATE OR RELIABLE.
            </p>
          </Section>

          <Section id="10" title="10. Limitation of liability">
            <p className="uppercase">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR
              GOODWILL. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR
              RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF THE
              AMOUNTS YOU PAID US IN THE TWELVE MONTHS BEFORE THE EVENT GIVING
              RISE TO THE CLAIM, OR ONE HUNDRED U.S. DOLLARS ($100).
            </p>
          </Section>

          <Section id="11" title="11. Indemnification">
            <p>
              You agree to indemnify and hold us harmless from any claims,
              damages, liabilities, and expenses (including reasonable legal
              fees) arising out of your use of the Service, Your Content, your
              outreach activities, or your violation of these Terms or any law
              or third-party right.
            </p>
          </Section>

          <Section id="12" title="12. Termination">
            <p>
              You may stop using the Service and delete your account at any
              time. We may suspend or terminate your access if you violate
              these Terms, create risk or legal exposure, or for prolonged
              inactivity, with notice where practicable. Upon termination, your
              right to use the Service ends; sections that by their nature
              should survive (including ownership, disclaimers, limitation of
              liability, and indemnification) will survive.
            </p>
          </Section>

          <Section id="13" title="13. Changes to these Terms">
            <p>
              We may update these Terms from time to time. If we make material
              changes, we will update the effective date and, where appropriate,
              notify you. Your continued use of the Service after changes take
              effect constitutes acceptance.
            </p>
          </Section>

          <Section id="14" title="14. Governing law and disputes">
            <p>
              These Terms are governed by the laws of the State of California,
              USA, without regard to conflict-of-laws rules. The exclusive venue
              for disputes will be the state or federal courts located in
              Alameda County, California, and you consent to their jurisdiction,
              except where prohibited by applicable law.
            </p>
          </Section>

          <Section id="15" title="15. Contact us">
            <p>Questions about these Terms:</p>
            <address className="mt-4 not-italic">
              <p className="font-semibold text-slate-900">Hamid J Sahraye</p>
              <p>
                Email:{" "}
                <a
                  href="mailto:legal@salegen.org"
                  className="underline hover:text-slate-900"
                >
                  legal@salegen.org
                </a>
              </p>
              <p>
                Website:{" "}
                <a
                  href="https://salegen.org"
                  className="underline hover:text-slate-900"
                >
                  https://salegen.org
                </a>
              </p>
            </address>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-16 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-8 text-xs text-slate-500">
          <Link href="/privacy" className="underline hover:text-slate-900">
            Privacy Policy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/login" className="underline hover:text-slate-900">
            Sign in
          </Link>
          <span aria-hidden>·</span>
          <a
            href="https://salegen.org"
            className="underline hover:text-slate-900"
          >
            salegen.org
          </a>
        </div>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`section-${id}`}>
      <h2 className="text-base font-black text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
