import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      container: {
        center: true,
        padding: "2rem",
        screens: {
          "2xl": "1400px",
        },
      },
      colors: {
        "border-clr": "rgba(39, 195, 233, 0.15)",
        "primary-bg": "#0E1428",
        "primary-text": "#0ba6cf",
        "secondary-text": "#0C7DAD",
        "dark-bg": "#060b1c",
        "blue-darker": "#116A8D",
      },
      keyframes: {
        "letter-bounce": {
          "0%, 20%, 100%": { transform: "translateY(0)" },
          "10%": { transform: "translateY(-0.35em)" },
        },
      },
      animation: {
        "letter-bounce": "letter-bounce 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
