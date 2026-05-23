import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AccountIndicator } from "@/components/account-indicator";
import { BRANDING_CONFIG } from "@/config/branding";
import { BRAND } from "@/lib/brand";
import { assertProductionEnv, getAppOrigin } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${BRANDING_CONFIG.appName} — ${BRANDING_CONFIG.metaTitleSuffix}`,
  description: BRAND.description,
  metadataBase: getAppOrigin() ? new URL(getAppOrigin()) : undefined,
  icons: {
    icon: "/brand/auditgen-icon.svg",
    apple: "/brand/auditgen-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  assertProductionEnv();
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/*
          AccountIndicator is a server component that returns null when
          there is no authenticated session, so /login and other
          unauthenticated routes render unchanged. On every authenticated
          route it overlays a top-right pill with email + workspace +
          sign-out + workspace switcher (closes the P1 session-clarity
          gap that previously caused the operator to keep creating new
          test accounts instead of signing out).
        */}
        <AccountIndicator />
        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}</Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
