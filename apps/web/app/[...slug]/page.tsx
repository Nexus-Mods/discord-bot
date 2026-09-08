import { redirect } from 'next/navigation';

/**
 * Anything that matches no other route: back to the front page.
 *
 * Express's, faithfully - `app.use((req, res, next) => req.method === 'GET' ? res.redirect('/') : next())`,
 * which replaced an `app.get('*')` that Express 5 stopped accepting. Next's own answer is
 * a 404 page, so this catch-all exists to keep the behaviour rather than because it is
 * better: it is not, particularly. A typo in a URL becoming a silent trip to the home page
 * is friendly to a user following a broken link and unhelpful to anyone trying to work out
 * why their link does not work.
 *
 * A real 404 page would be the better end state, and it is a decision about what visitors
 * see rather than part of moving the server - so it is left as it was. Deleting this file
 * and adding app/not-found.tsx is the whole change, if that is wanted.
 *
 * Only GET, because a page only answers GET - which is also Express's behaviour: other
 * methods fell through to its 404.
 *
 * Static segments beat a catch-all in Next's matcher, so every real route above still
 * wins, and files in public/ are served before app routes at all.
 */
export default async function CatchAll() {
    redirect('/');
}
