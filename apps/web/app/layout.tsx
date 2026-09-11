import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';

/**
 * The chrome header.ejs and footer.ejs wrapped every page in. The logo is a file rather
 * than the 8KB inline sprite repeated in every response.
 *
 * THE FONT IS STILL A THIRD-PARTY REQUEST. next/font would self-host it, but it fetches at
 * build time and the build environment cannot reach fonts.googleapis.com. Self-hosting it
 * is what the CSP exemption for fonts.googleapis.com and fonts.gstatic.com is waiting on.
 */

const INTER_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap';

const NEXUS_FAVICONS = 'https://images.nexusmods.com/favicons/ReskinOrange';

export const metadata: Metadata = {
    title: {
        default: 'Discord Bot - Nexus Mods',
        template: '%s - Discord Bot - Nexus Mods',
    },
    description: 'The official Discord bot for NexusMods.com',
    // None of these is a landing page; none should be indexed.
    robots: { index: false, follow: false },
    metadataBase: new URL('https://discordbot.nexusmods.com'),
    openGraph: {
        title: 'Discord Bot - Nexus Mods',
        siteName: 'Nexus Mods',
        locale: 'en_GB',
        type: 'website',
        url: 'https://discordbot.nexusmods.com',
        description: 'The official Discord bot for NexusMods.com',
        images: [{
            url: 'https://images.nexusmods.com/oauth/applications/api_app_logo_1598554289_php9fzf1a.png',
            alt: 'A Nexus Mods logo, a green arrow and a Discord logo symbolising the link between the two services.',
        }],
    },
    twitter: { card: 'summary' },
    icons: {
        icon: [
            { url: `${NEXUS_FAVICONS}/favicon.ico` },
            { url: `${NEXUS_FAVICONS}/favicon-32x32.png`, sizes: '32x32' },
            { url: `${NEXUS_FAVICONS}/favicon-16x16.png`, sizes: '16x16' },
        ],
        apple: [
            { url: `${NEXUS_FAVICONS}/apple-touch-icon.png`, sizes: '144x144' },
            { url: `${NEXUS_FAVICONS}/apple-touch-icon-120x120.png`, sizes: '120x120' },
        ],
    },
    other: { 'theme-color': '#ff8904' },
};

function Logo({ className }: { className?: string }) {
    return <img src="/nexus-logo.svg" width={135} height={30} alt="Nexus Mods" className={className} />;
}

/**
 * The nonce proxy.ts minted for this request; Next puts it on the scripts it emits. Reading
 * a header also opts every page out of static generation, which is the price of the CSP.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const nonce = (await headers()).get('x-nonce') ?? undefined;

    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link rel="stylesheet" href={INTER_HREF} nonce={nonce} />
            </head>
            <body className="flex min-h-dvh flex-col font-sans antialiased">
                <header className="flex h-14 flex-none items-center justify-center bg-neutral-950">
                    <Logo />
                </header>
                <main className="mx-auto w-full grow px-4 pt-5 md:px-12 md:pt-10">
                    {children}
                </main>
                <footer className="flex flex-none flex-col items-center gap-4 pb-10 pt-18 text-body-sm text-neutral-400">
                    <Logo className="opacity-60" />
                    <p>Copyright © 2026 Black Tree Gaming Ltd. All rights reserved.</p>
                </footer>
            </body>
        </html>
    );
}
