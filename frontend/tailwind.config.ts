import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B0D11",
        sidebar: "#090B0F",
        card: "#12141B",
        card2: "#0E1014",
        border: "rgba(255,255,255,0.07)",
        "border-hi": "rgba(255,255,255,0.13)",
        lime: {
          DEFAULT: "#C8FF00",
          dim: "rgba(200,255,0,0.12)",
        },
        pink: "#FF4FD8",
        purple: "#9B72FF",
        blue: "#60A5FA",
        text: "#ECEEF2",
        muted: "#636B7A",
        dim: "#1D2028",
        green: "#4ADE80",
        red: "#F87171",
        amber: "#FBBF24",
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'sans-serif'],
        mono: ['var(--font-dm-sans)', 'monospace'],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
