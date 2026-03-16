/** @type {import('tailwindcss').Config} */
/*
  Tailwind CSS v4 — breakpoints and design tokens are defined in src/index.css
  via @theme {} (the v4 CSS-first configuration approach).

  Breakpoint reference (defined in index.css @theme block):
    xs / sm : 320px  — mobile (PRIMARY design target)
    md      : 768px  — tablet
    lg      : 1024px — small desktop / landscape tablet
    xl      : 1280px — large desktop
*/
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
