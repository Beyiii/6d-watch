// postcss.config.cjs
// NOTE: With Tailwind v4 + @tailwindcss/vite, tailwindcss is handled by the Vite plugin.
// Only autoprefixer is needed here.
module.exports = {
  plugins: {
    autoprefixer: {},
  },
};
