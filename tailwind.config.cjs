/**
 * Tailwind CSS configuration file.
 * Supports both the main 6D‑Watch source files and the Lovable UI components.
 */
module.exports = {
  darkMode: "class", // Enable class‑based dark mode
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./Lovable/src/**/*.{js,ts,jsx,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // Add any Tailwind plugins you need here, e.g., require('tailwindcss-animate')
  ],
};
