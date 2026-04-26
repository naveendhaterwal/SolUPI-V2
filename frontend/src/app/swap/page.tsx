import { Metadata } from 'next'
import SwapInterface from './swap-interface'
import { StructuredData, webApplicationSchema } from '@/components/seo/structured-data'

export const metadata: Metadata = {
    title: 'Swap - Buy USDC Instantly',
    description: 'Buy USDC on Solana using UPI payments. Fast, secure, and transparent cryptocurrency trading with real-time exchange rates.',
    keywords: [
        'buy USDC',
        'Solana swap',
        'UPI crypto',
        'instant USDC purchase',
        'crypto exchange',
        'stablecoin trading',
    ],
    openGraph: {
        title: 'Swap USDC on Solana with UPI | SolUpi',
        description: 'Buy USDC on Solana using UPI payments. Fast, secure, and transparent.',
        url: '/swap',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Swap USDC on Solana with UPI | SolUpi',
        description: 'Buy USDC on Solana using UPI payments. Fast, secure, and transparent.',
    },
    alternates: {
        canonical: '/swap',
    },
}

export default function SwapPage() {
    return (
        <>
            <StructuredData data={webApplicationSchema} />
            <SwapInterface />
        </>
    )
}
