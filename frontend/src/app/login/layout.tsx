import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Login to SolUpi',
    description: 'Sign in to your SolUpi account to start buying USDC on Solana with UPI payments.',
    openGraph: {
        title: 'Login to SolUpi',
        description: 'Sign in to your SolUpi account to start buying USDC on Solana with UPI payments.',
        url: '/login',
        type: 'website',
    },
    twitter: {
        card: 'summary',
        title: 'Login to SolUpi',
        description: 'Sign in to your SolUpi account to start buying USDC on Solana with UPI payments.',
    },
    alternates: {
        canonical: '/login',
    },
    robots: {
        index: false, // Don't index login page
        follow: true,
    },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
