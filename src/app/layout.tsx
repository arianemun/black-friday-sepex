import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GoogleTagManagerHead, GoogleTagManagerNoScript } from "@/components/site/google-tag-manager";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const peyda = localFont({
  src: "./fonts/PeydaWebVF.woff2",
  variable: "--font-peyda",
  weight: "100 950",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.shortName,
  keywords: siteConfig.keywords,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: "/",
    siteName: siteConfig.shortName,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "بلک‌فرایدی سپکس" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={peyda.variable} suppressHydrationWarning>
      <head>
        <GoogleTagManagerHead />
      </head>
      <body className="min-h-dvh bg-black font-sans">
        <GoogleTagManagerNoScript />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
