import React from 'react'

interface StructuredDataProps {
    data: Record<string, any>
}

export function StructuredData({ data }: StructuredDataProps) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    )
}

// Organization Schema
export const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SolUpi',
    description: 'The fastest and most affordable way to buy USDC on Solana using UPI.',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://solupi.com',
    logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://solupi.com'}/favicon.png`,
    sameAs: [
        // Add social media links when available
    ],
    contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Customer Support',
        availableLanguage: ['English', 'Hindi'],
    },
}

// WebApplication Schema
export const webApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'SolUpi Swap',
    description: 'Buy USDC on Solana instantly with UPI payments',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://solupi.com'}/swap`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web Browser',
    offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
    },
    featureList: [
        'Instant USDC purchase',
        'UPI payment integration',
        'Solana blockchain',
        'Secure transactions',
        'Real-time exchange rates',
    ],
}

// FAQ Schema
export const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'What is SolUpi?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'SolUpi is the fastest and most affordable way to buy USDC on Solana using UPI. It connects Indian UPI payments to Solana\'s lightning-fast blockchain, enabling instant, trusted, and fully transparent USDC purchases without middlemen or inflated fees.',
            },
        },
        {
            '@type': 'Question',
            name: 'How do I buy USDC using SolUpi?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'To buy USDC, simply enter the amount you want to purchase, provide your Solana wallet address, and complete the payment using UPI. The USDC will be sent to your wallet within minutes.',
            },
        },
        {
            '@type': 'Question',
            name: 'Is SolUpi secure?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes, SolUpi uses secure blockchain technology and encrypted payment processing to ensure your transactions are safe and transparent.',
            },
        },
    ],
}

// BreadcrumbList Schema Generator
export const generateBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
    })),
})
