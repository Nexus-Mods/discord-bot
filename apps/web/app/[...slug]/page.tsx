import { redirect } from 'next/navigation';

/**
 * Anything matching no other route redirects to the front page, as Express did. A real 404
 * would be better; deleting this file and adding app/not-found.tsx is the whole change.
 *
 * Static segments beat a catch-all in Next's matcher, and public/ is served before app
 * routes, so every real route still wins.
 */
export default async function CatchAll() {
    redirect('/');
}
