import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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

const defaultTitle = `${BRAND.productName} — ${BRAND.tagline}`;

export const metadata: Metadata = {
  title: {
    default: defaultTitle,
    template: `%s · ${BRAND.productName}`,
  },
  description: BRAND.description,
  metadataBase: getAppOrigin() ? new URL(getAppOrigin()) : undefined,
  icons: {
    icon: "/brand/auditgen-icon.svg",
    apple: "/brand/auditgen-icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: BRAND.productName,
    title: defaultTitle,
    description: BRAND.description,
    images: [
      {
        url: "/brand/auditgen-logo-horizontal.svg",
        alt: `${BRAND.productName} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: BRAND.description,
    images: ["/brand/auditgen-logo-horizontal.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  assertProductionEnv();
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* a11y: skip-to-main link is the first focusable element. Hidden
            visually until focused. Pages should give their primary <main>
            an id="main" for the target to scroll into view; without it the
            link is still harmless (focus moves on, no scroll). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-2xl focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:font-black focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
