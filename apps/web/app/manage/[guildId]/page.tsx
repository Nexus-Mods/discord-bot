import type { Metadata } from 'next';
import { TrackedPanel } from '@/components/TrackedPanel';

/**
 * The bare guild path shows the tracked items rather than redirecting to them.
 *
 * A redirect made /manage/<id> a URL that never stayed in the address bar, which is a
 * poor thing to hand someone - and it cost a round trip before anything rendered. The
 * tab is still addressable at /tracked; both render the same panel.
 */
export const metadata: Metadata = { title: 'Tracked Items' };

export default async function GuildIndex({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    return <TrackedPanel guildId={guildId} />;
}
