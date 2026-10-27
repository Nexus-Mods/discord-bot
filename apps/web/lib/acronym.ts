/**
 * Discord's fallback for a server with no icon: the initials.
 *
 * Its own module because both a server component (the guild header) and a client one (the
 * rail tiles) need it, and a client component importing from a server one drags the
 * server module into the browser bundle.
 */
export function acronym(name: string): string {
    return name.split(/\s+/).filter(Boolean).map((word) => [...word][0]).slice(0, 3).join('');
}
