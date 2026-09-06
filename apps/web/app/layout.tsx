import type { Metadata } from 'next';
import './globals.css';

/**
 * The chrome header.ejs and footer.ejs wrapped every page in: a black bar with the Nexus
 * logo, the content column, and a copyright line with the logo again.
 *
 * One difference worth stating: the logo is a file rather than an inline <symbol> sprite
 * repeated in every response. It was 8KB of path data in the markup of all eight pages.
 *
 * THE FONT IS STILL A THIRD-PARTY REQUEST, and it should not be by the end of step 7.
 *
 * The right answer is next/font - it fetches the font once at build time and self-hosts
 * it, which is what nexusmods.com does (its theme layer names "Inter Fallback", a family
 * name next/font generates). It is not used here because the font is fetched *during the
 * build*, and the build environment this was written in cannot reach fonts.googleapis.com
 * - so the choice was between code that could not be built and verified here, and a
 * <link> that behaves exactly as the Express views already do.
 *
 * This is one of the two reasons the CSP exemption exists, and step 7 is where the plan
 * puts "turn CSP on properly rather than carry the exemption forward". Turning it on
 * means self-hosting this first: switch to `next/font/google` in an environment that can
 * reach Google, or commit the woff2 and use `next/font/local`. Until then the page pulls
 * a stylesheet from fonts.googleapis.com and a font file from fonts.gstatic.com, the same
 * two hosts the Express views already need.
 */
const INTER_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap';

const NEXUS_FAVICONS = 'https://images.nexusmods.com/favicons/ReskinOrange';

export const metadata: Metadata = {
    title: {
        default: 'Discord Bot - Nexus Mods',
        template: '%s - Discord Bot - Nexus Mods',
    },
    description: 'The official Discord bot for NexusMods.com',
    // Carried over deliberately. These pages are the tail of an OAuth flow and a
    // per-guild tracking summary; none of them is a landing page and none should be
    // indexed.
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link rel="stylesheet" href={INTER_HREF} />
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
