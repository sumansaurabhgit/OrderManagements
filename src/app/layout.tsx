import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { LiveUpdates } from "@/components/live-updates";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import { PendingCheckoutGuard } from "@/features/checkout/pending-checkout-client";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Larkspur Goods", template: "%s · Larkspur Goods" },
  description: "A small homeware store — storefront, stock management and order administration.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only rounded-md bg-zinc-900 px-3 py-2 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <Suspense fallback={<SiteHeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <LiveUpdates />
        <PendingCheckoutGuard />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
