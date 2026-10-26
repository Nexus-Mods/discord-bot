import { PageTitle } from '@/components/ui';

/**
 * Next wraps the page in a Suspense boundary with this as the fallback, so navigating
 * into /manage paints the shell and the rail immediately rather than waiting on Discord.
 */
export default function Loading() {
    return (
        <div aria-busy="true">
            <PageTitle>Manage your servers</PageTitle>
            <div className="my-8 max-w-[68ch] animate-pulse space-y-3">
                <div className="h-4 w-3/4 rounded bg-neutral-800" />
                <div className="h-4 w-1/2 rounded bg-neutral-800" />
            </div>
        </div>
    );
}
