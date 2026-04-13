import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Profile',
    description: 'Manage your SolUpi account settings and transaction history.',
    robots: {
        index: false, // Don't index profile pages
        follow: false,
    },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
