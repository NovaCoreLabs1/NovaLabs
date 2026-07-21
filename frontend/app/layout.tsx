import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/providers/Providers";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieBanner } from "@/components/ui/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "NovaLabs - Smart Hub & Workspace Management",
    template: "%s | NovaLabs",
  },
  description:
    "Smart Hub & Workspace Management System for modern teams. Streamline operations, manage resources, and boost productivity with our comprehensive management platform.",
  keywords: [
    "workspace management",
    "hub management",
    "team productivity",
    "resource management",
    "smart workspace",
    "collaboration tools",
    "project management",
  ],
  authors: [{ name: "NovaLabs Team" }],
  creator: "NovaLabs",
  publisher: "NovaLabs",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://novalabs.vercel.app",
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "NovaLabs - Smart Hub & Workspace Management",
    description:
      "Smart Hub & Workspace Management System for modern teams. Streamline operations, manage resources, and boost productivity with our comprehensive management platform.",
    siteName: "NovaLabs",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NovaLabs - Smart Hub & Workspace Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NovaLabs - Smart Hub & Workspace Management",
    description:
      "Smart Hub & Workspace Management System for modern teams. Streamline operations, manage resources, and boost productivity.",
    images: ["/og-image.png"],
    creator: "@novalabs",
    site: "@novalabs",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        url: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        url: "/favicon-16x16.png",
      },
    ],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>{children}</Providers>
          <Toaster richColors position="top-right" />
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
