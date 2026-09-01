import type { Metadata } from "next";
import Link from "next/link";
import { Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Pharma Market Intelligence`,
  description: BRAND_TAGLINE,
};

import ConvexClientProvider from "@/components/ConvexClientProvider";
import { NavBar } from "@/components/NavBar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-zinc-950 font-sans selection:bg-[color:var(--brand-selection)]"
        suppressHydrationWarning
      >
        <ConvexClientProvider>
          <NavBar />
          <div className="mt-16 flex-1">{children}</div>
          <footer className="border-t border-zinc-800 bg-zinc-950 px-4 py-8 text-sm text-zinc-500 sm:px-6">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
              <span>© 2026 {BRAND_NAME}. {BRAND_TAGLINE}</span>
              <Link href="/guide" className="font-medium text-[var(--brand-300)] transition-colors hover:text-white">
                How to use KEMEDICA
              </Link>
            </div>
          </footer>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
