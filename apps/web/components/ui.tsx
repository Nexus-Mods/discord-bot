/**
 * The vocabulary the eight ported views are built from.
 *
 * The Express views share one stylesheet of `maintenance-page__*` classes, so every page
 * looked the same because every page used the same class names. Tailwind has no class
 * names to share, so the equivalent has to be a component or the pages drift apart one
 * utility string at a time. These are those components, and nothing here is a design
 * decision that was not already made in the stylesheet being replaced.
 *
 * Two things did change, both deliberately:
 *
 *   - The typography comes from the theme tokens rather than Montserrat and Roboto over
 *     two Google Fonts <link> tags. nexusmods.com is on Inter, and the theme layer this
 *     app mirrors names Inter; carrying two more faces forward to imitate a stylesheet
 *     that is about to be deleted would be preserving an accident.
 *   - The accent is the brand orange, not the stylesheet's #d98f40. That is the same
 *     reconciliation NEXUS_ORANGE got: one orange, decided once.
 */
import type { ComponentProps, ReactNode } from 'react';

const BUTTON = [
    'inline-flex h-9 items-center gap-2.5 rounded border border-primary-400 px-4',
    'text-body-sm font-semibold uppercase tracking-wide text-neutral-50',
    'transition-colors hover:bg-neutral-800',
    'focus-visible:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2',
    'focus-visible:outline-focus-subdued',
].join(' ');

/**
 * The one button in the design, as a link.
 *
 * A plain anchor rather than next/link, on purpose. Of the eleven buttons across these
 * eight pages, four are `discord://` deep links, five are other sites, and the two that
 * are same-origin paths - /linked-role and /revoke - are Express routes this app does not
 * own and will not own until step 8. next/link would treat those two as client
 * navigations to routes that do not exist and 404 rather than reaching the server that
 * does have them. There is no internal navigation here worth prefetching.
 *
 * `newTab` is passed rather than inferred: `discord://` is neither internal nor http(s),
 * so any heuristic gets it wrong in one direction or the other.
 */
export function ActionLink(
    { href, icon, children, newTab = false }:
    { href: string; icon?: string; children: ReactNode; newTab?: boolean },
) {
    return (
        <a href={href} className={BUTTON} {...(newTab ? { target: '_blank', rel: 'noreferrer' } : {})}>
            {icon ? <img src={icon} alt="" className="w-5" /> : null}
            <span>{children}</span>
        </a>
    );
}

/** The same button, submitting a form rather than following a link. */
export function ActionButton({ icon, children, ...props }: { icon?: string } & ComponentProps<'button'>) {
    return (
        <button {...props} className={BUTTON}>
            {icon ? <img src={icon} alt="" className="w-5" /> : null}
            <span>{children}</span>
        </button>
    );
}

export function PageTitle({ children }: { children: ReactNode }) {
    return <h1 className="text-heading-lg text-balance md:text-heading-xl">{children}</h1>;
}

/** The lead paragraph. One per page, directly under the title. */
export function Subtext({ children }: { children: ReactNode }) {
    return <p className="my-8 max-w-[68ch] text-body-lg [&_a]:text-primary-400 [&_a:hover]:text-primary-strong">{children}</p>;
}

/** Body copy below the fold of the page. */
export function Text({ children }: { children: ReactNode }) {
    return <p className="my-8 text-center text-body-md [&_a]:text-primary-400 [&_a:hover]:text-primary-strong">{children}</p>;
}

/** The quiet line: versions, uptime, reassurances, error details. */
export function Supertext({ children }: { children: ReactNode }) {
    return <p className="text-body-md text-neutral-400">{children}</p>;
}

export function Centered({ children }: { children: ReactNode }) {
    return <div className="flex flex-wrap justify-center gap-2">{children}</div>;
}

/** The animated GIF each result page leads with. */
export function MainImage({ src, alt }: { src: string; alt: string }) {
    return (
        <div className="flex justify-center">
            <img src={src} alt={alt} className="w-full max-w-96.25 md:max-w-127.5 lg:max-w-214.5" />
        </div>
    );
}

/**
 * Error detail, shown to someone who is going to paste it into Discord.
 *
 * `break-words` because the strings are OAuth errors and URLs with no spaces in them,
 * and the Express version let them push the page sideways on a phone.
 */
export function ErrorDetail({ children }: { children: ReactNode }) {
    return (
        <div className="mt-8 text-body-md text-neutral-400">
            <span>Error details:</span>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap wrap-break-words rounded bg-neutral-950 p-3 font-mono text-body-sm text-neutral-300">
                {children}
            </pre>
        </div>
    );
}

/** The column every page's content sits in. */
export function Content({ children }: { children: ReactNode }) {
    return <div className="max-w-225 lg:max-w-275">{children}</div>;
}
