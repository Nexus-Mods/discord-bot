// Tailwind 4 is a PostCSS plugin in its own package; the v3 `tailwindcss` plugin
// entry no longer exists. There is no tailwind.config.js either - the theme is
// declared in CSS, in app/globals.css.
export default { plugins: { '@tailwindcss/postcss': {} } };
