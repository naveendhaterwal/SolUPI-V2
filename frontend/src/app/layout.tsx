import "../styles/globals.css";
import { Navbar } from "@/components/navbar/header";
import type { Metadata } from "next";
import { SmoothScroll } from "@/components/smooth-scroll";
import { ToastProvider } from "@/components/ui/toast";
import { Preloader } from "@/components/ui/preloader";
import { StructuredData, organizationSchema } from "@/components/seo/structured-data";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://solupi.com'),
  title: {
    default: "SolUpi - Buy USDC on Solana with UPI",
    template: "%s | SolUpi"
  },
  description: "The fastest and most affordable way to buy USDC on Solana using UPI. Instant, secure, and transparent cryptocurrency purchases with no middlemen or inflated fees.",
  keywords: [
    'SolUpi',
    'USDC',
    'Solana',
    'UPI',
    'cryptocurrency',
    'crypto trading',
    'buy USDC',
    'Solana blockchain',
    'India UPI',
    'instant crypto purchase',
    'decentralized finance',
    'DeFi',
    'crypto exchange',
    'stablecoin',
  ],
  authors: [{ name: 'SolUpi Team' }],
  creator: 'SolUpi',
  publisher: 'SolUpi',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/',
    siteName: 'SolUpi',
    title: 'SolUpi - Buy USDC on Solana with UPI',
    description: 'The fastest and most affordable way to buy USDC on Solana using UPI. Instant, secure, and transparent cryptocurrency purchases.',
    images: [
      {
        url: '/ff.png',
        width: 1200,
        height: 630,
        alt: 'SolUpi - Buy USDC on Solana with UPI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SolUpi - Buy USDC on Solana with UPI',
    description: 'The fastest and most affordable way to buy USDC on Solana using UPI. Instant, secure, and transparent.',
    images: ['/ff.png'],
    creator: '@SolUpi',
  },
  verification: {
    // Add verification tokens when you set up search console
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <StructuredData data={organizationSchema} />
      </head>
      <body className="font-sans antialiased overflow-x-hidden bg-[#0a0a0a]" suppressHydrationWarning={true}>
        <SmoothScroll />
        <Preloader />

        <div style={{ position: "relative", zIndex: 10, pointerEvents: "auto" }}>
          <ToastProvider>
            <Navbar />
            {children}
          </ToastProvider>
        </div>
      </body>
    </html>
  );
}
