import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: {
        // Every page but the home page appends to this, which is how the Express views
        // already behave - they each pass their own `pageTitle`.
        default: 'Nexus Mods Discord Bot',
        template: '%s · Nexus Mods Discord Bot',
    },
    description: 'Link your Nexus Mods account to Discord, and track mods and games from your server.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className="min-h-dvh font-sans antialiased">{children}</body>
        </html>
    );
}
