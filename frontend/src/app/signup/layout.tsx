import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Sign Up for SolUpi',
    description: 'Create your SolUpi account to start buying USDC on Solana with UPI payments. Quick and easy registration.',
    openGraph: {
        title: 'Sign Up for SolUpi',
        description: 'Create your SolUpi account to start buying USDC on Solana with UPI payments.',
        url: '/signup',
        type: 'website',
    },
    twitter: {
        card: 'summary',
        title: 'Sign Up for SolUpi',
        description: 'Create your SolUpi account to start buying USDC on Solana with UPI payments.',
    },
    alternates: {
        canonical: '/signup',
    },
    robots: {
        index: false, // Don't index signup page
        follow: true,
    },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
