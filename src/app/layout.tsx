import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
