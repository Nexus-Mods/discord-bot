import { PageTitle, Subtext } from '@/components/ui';

/**
 * Shown when Discord could not be asked who this visitor is allowed to manage.
 *
 * Not a 404. "We could not check" and "this is not yours" are different answers, and the
 * second one sends a person looking for a permissions problem that does not exist.
 */
export function GuildUnavailable() {
    return (
        <>
            <PageTitle>Can&apos;t reach Discord right now</PageTitle>
            <Subtext>
                Your permissions could not be checked, so this server is not being shown.
                This is usually brief - reload in a moment. If it keeps happening, signing
                out and back in will issue a fresh token.
            </Subtext>
        </>
    );
}
