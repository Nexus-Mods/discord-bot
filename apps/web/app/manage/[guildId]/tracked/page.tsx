import type { Metadata } from 'next';
import { TrackedPanel } from '@/components/TrackedPanel';

/** The addressable form of the tab the bare guild path already shows. */
export const metadata: Metadata = { title: 'Tracked Items' };

export default async function Tracked({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    return <TrackedPanel guildId={guildId} />;
}
