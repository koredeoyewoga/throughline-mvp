import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Throughline brand — calm enterprise healthcare
        ink: "#10202f",
        slate: {
          DEFAULT: "#44525e",
          muted: "#6c7b88",
        },
        teal: {
          DEFAULT: "#12514e",
          bright: "#1f7a73",
          soft: "#e4efee",
        },
        mist: "#eef4f3",
        amber: {
          DEFAULT: "#d9663d",
          soft: "#f6e3d9",
        },
        line: "#d6e0de",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
