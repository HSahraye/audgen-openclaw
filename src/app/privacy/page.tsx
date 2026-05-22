import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "Privacy Policy — AuditGen",
  description:
    "How Salegen / AuditGen collects, uses, stores, and shares information when you use the Service.",
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Effective date: <time dateTime="2026-05-22">May 22, 2026</time>
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            This Privacy Policy explains how Presence Labs (&ldquo;Salegen,&rdquo;
            &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects,
            uses, stores, and shares information when you use Salegen&nbsp;/
            AuditGen (the &ldquo;Service&rdquo;), available at{" "}
            <a
              href="https://salegen.org"
              className="underline hover:text-slate-900"
            >
              https://salegen.org
            </a>
            . By using the Service, you agree to the practices described here.
          </p>
        </div>

        {/* Body */}
        <div className="mt-8 space-y-10 text-sm leading-7 text-slate-700">
          <Section id="1" title="1. Who we are">
            <p>
              Salegen (also referred to as AuditGen) is an AI Sales OS for B2B
              revenue teams and agencies. The Service helps users import and
              discover leads, score and audit prospective businesses, prepare
              outreach, and track follow-ups. We are the data controller for
              personal information processed through the Service. Our contact
              details are in Section 13.
            </p>
          </Section>

          <Section id="2" title="2. Information we collect">
            <div className="space-y-4">
              <p>
                <span className="font-semibold text-slate-900">
                  Account information.
                </span>{" "}
                When you create an account, we collect your name, email address,
                and, if you sign in with Google, your Google account identifier
                and basic profile information (see Section&nbsp;4). If you
                register with email and password, we collect your email and a
                securely hashed password. We never store passwords in plain text.
              </p>
              <p>
                <span className="font-semibold text-slate-900">
                  Workspace and lead data.
                </span>{" "}
                The Service lets you import, discover, and store information
                about prospective businesses (&ldquo;lead data&rdquo;), such as
                business names, addresses, phone numbers, websites, categories,
                and publicly available ratings. Some lead data is provided by
                you; some is retrieved through third-party discovery connectors
                (such as the Google Places API and Yelp) on your instruction.
                This data is generally information about businesses, not
                consumers, but may incidentally include the name or contact
                details of a business owner or representative.
              </p>
              <p>
                <span className="font-semibold text-slate-900">
                  Generated content.
                </span>{" "}
                When you generate an audit or outreach material, we process the
                relevant lead data through our AI provider to produce that
                content, and we store the resulting output in your workspace.
              </p>
              <p>
                <span className="font-semibold text-slate-900">
                  Usage and technical data.
                </span>{" "}
                We collect log data, device and browser information, IP address,
                and interaction events to operate, secure, and improve the
                Service.
              </p>
              <p>
                <span className="font-semibold text-slate-900">
                  Cookies and similar technologies.
                </span>{" "}
                We use strictly necessary cookies for authentication and session
                management (for example, a secure session cookie issued by our
                authentication layer). We do not use advertising cookies. See
                Section&nbsp;9.
              </p>
            </div>
          </Section>

          <Section id="3" title="3. How we use information">
            <p>We use information to:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>create and authenticate your account and maintain your session;</li>
              <li>
                provide the core Service &mdash; lead import, discovery, scoring,
                AI audit generation, outreach preparation, and follow-up tracking;
              </li>
              <li>process payments and manage subscriptions;</li>
              <li>
                secure the Service, prevent abuse, enforce our Terms, and isolate
                each workspace&rsquo;s data from other tenants;
              </li>
              <li>
                communicate with you about your account, security, and service
                changes;
              </li>
              <li>comply with legal obligations.</li>
            </ul>
            <p className="mt-4">
              We do not sell your personal information, and we do not use Google
              user data for advertising.
            </p>
          </Section>

          <Section id="4" title="4. Google user data">
            <p>
              When you choose &ldquo;Continue with Google,&rdquo; we request
              only basic, non-sensitive scopes: your email address, basic profile
              information (name and profile image), and your OpenID identifier.
              We use this data solely to authenticate you, create or identify
              your account, and populate your profile.
            </p>
            <p className="mt-4">
              Our use and transfer of information received from Google APIs
              adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="underline hover:text-slate-900"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including its Limited Use requirements. Specifically:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>
                we use Google user data only to provide and improve the sign-in
                and account features described above;
              </li>
              <li>
                we do not transfer or sell Google user data to third parties
                except as needed to provide the Service, for security, or to
                comply with law;
              </li>
              <li>we do not use Google user data for advertising;</li>
              <li>
                we do not allow humans to read Google user data unless we have
                your consent, it is necessary for security or to comply with
                law, or the data is aggregated and anonymized.
              </li>
            </ul>
            <p className="mt-4">
              You can revoke our access at any time at{" "}
              <a
                href="https://myaccount.google.com/permissions"
                className="underline hover:text-slate-900"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://myaccount.google.com/permissions
              </a>
              .
            </p>
          </Section>

          <Section id="5" title="5. Third-party services and sub-processors">
            <p>
              We rely on the following providers to operate the Service. They
              process data only as needed to perform their function:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>
                <span className="font-semibold text-slate-900">
                  Google Cloud (OAuth, Places API)
                </span>{" "}
                &mdash; authentication and lead discovery.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Yelp</span>{" "}
                &mdash; supplementary lead discovery (where enabled).
              </li>
              <li>
                <span className="font-semibold text-slate-900">Anthropic</span>{" "}
                &mdash; AI processing of lead data to generate audits and
                outreach content via the Claude API.
              </li>
              <li>
                <span className="font-semibold text-slate-900">
                  Neon&nbsp;/ PostgreSQL
                </span>{" "}
                &mdash; database hosting for your account and workspace data.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Netlify</span>{" "}
                &mdash; application hosting and delivery.
              </li>
              <li>Our authentication layer for session and identity management.</li>
            </ul>
            <p className="mt-4">
              Lead data and the prompts used to generate audits may be
              transmitted to our AI provider to produce output. We do not
              knowingly send your account credentials or payment data to the AI
              provider.
            </p>
          </Section>

          <Section id="6" title="6. How we share information">
            <p>
              We share information only: (a)&nbsp;with the sub-processors in
              Section&nbsp;5; (b)&nbsp;when you direct us to (for example,
              exporting your data); (c)&nbsp;to comply with law, legal process,
              or enforce our Terms; (d)&nbsp;to protect the rights, safety, and
              security of users and the public; or (e)&nbsp;in connection with a
              merger, acquisition, or sale of assets, in which case we will
              notify you. We do not sell personal information.
            </p>
          </Section>

          <Section id="7" title="7. Data retention">
            <p>
              We retain account and workspace data for as long as your account
              is active and as needed to provide the Service. When you delete
              your account or specific data, we delete or anonymize it within a
              commercially reasonable period, except where retention is required
              for legal, security, or legitimate business purposes (such as
              billing records).
            </p>
          </Section>

          <Section id="8" title="8. Security">
            <p>
              We protect data with measures including encryption in transit,
              hashed credentials, tenant isolation so each workspace&rsquo;s
              data is scoped to its members, and access controls. No method of
              transmission or storage is completely secure, but we work to
              protect your information and to promptly address vulnerabilities.
            </p>
          </Section>

          <Section id="9" title="9. Cookies">
            <p>
              We use only cookies that are necessary to run the Service,
              primarily for authentication and to keep you signed in. Because
              these cookies are essential, the Service may not function correctly
              if they are disabled. We do not run third-party advertising or
              cross-site tracking cookies.
            </p>
          </Section>

          <Section id="10" title="10. Your rights and choices">
            <p>
              Depending on where you live, you may have rights to access,
              correct, delete, or export your personal information, and to
              object to or restrict certain processing. California residents have
              rights under the CCPA/CPRA, including the right to know, delete,
              and opt out of &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; &mdash;
              note that we do not sell or share personal information as those
              terms are defined. To exercise any right, contact us at the
              address in Section&nbsp;13. You may also revoke Google access as
              described in Section&nbsp;4.
            </p>
          </Section>

          <Section id="11" title="11. Children&rsquo;s privacy">
            <p>
              The Service is intended for businesses and is not directed to
              children. We do not knowingly collect personal information from
              anyone under 18. If you believe a minor has provided us
              information, contact us and we will delete it.
            </p>
          </Section>

          <Section id="12" title="12. Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. If we make
              material changes, we will update the effective date above and,
              where appropriate, notify you. Your continued use of the Service
              after changes take effect constitutes acceptance.
            </p>
          </Section>

          <Section id="13" title="13. Contact us">
            <p>
              Questions or requests regarding this Privacy Policy or your data:
            </p>
            <address className="mt-4 not-italic">
              <p className="font-semibold text-slate-900">Hamid J Sahraye</p>
              <p>
                Email:{" "}
                <a
                  href="mailto:privacy@salegen.org"
                  className="underline hover:text-slate-900"
                >
                  privacy@salegen.org
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
          <Link href="/terms" className="underline hover:text-slate-900">
            Terms of Service
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
