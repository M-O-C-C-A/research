import type { Metadata } from "next";
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
        className="min-h-full flex flex-col bg-zinc-950 font-sans selection:bg-[color:var(--brand-selection)]"
        suppressHydrationWarning
      >
        <ConvexClientProvider>
          <NavBar />
          <div className="flex-1 mt-16">{children}</div>
          <footer className="border-t border-zinc-800 bg-zinc-950 py-8 px-6 text-center text-sm text-zinc-500">
            © 2026 {BRAND_NAME}. {BRAND_TAGLINE}
          </footer>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
