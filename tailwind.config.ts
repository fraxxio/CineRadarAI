import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      container: {
        center: true,
        padding: "2rem",
        screens: {
          "2xl": "1400px",
        },
      },
      borderColor: {
        "border-clr": "rgba(39, 195, 233, 0.15)",
      },
      colors: {
        "primary-bg": "#0E1428",
      },
    },
  },
  plugins: [],
};
export default config;