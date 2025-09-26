/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        background: "var(--background)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
        },
        border: {
            default: "var(--border)",
            hover: "var(--border-hover)",
            focus: "var(--border-focus)",
        },
        card: {
          background: "var(--card-background)",
        },
        input: {
          background: "var(--input-background)",
        },
        dialog: {
          background: "var(--dialog-background)",
        },
        dropdown: {
          background: "var(--dropdown-background)",
          itemHover: "var(--dropdown-item-hover)",
        },
        sidebar: {
          background: "var(--sidebar-background)",
          itemHover: "var(--sidebar-item-hover)", 
          itemFocus: "var(--sidebar-item-focus)",
        },
        button: {
          bg: "var(--button-bg)",
          bgHover: "var(--button-bg-hover)",
          bgText: "var(--button-text)",
          border: "var(--button-border)",
          borderHover: "var(--button-border-hover)",
          secondBg: "var(--button-second-bg)",
          secondBgHover: "var(--button-second-bg-hover)",
        },
        bookmarkItem: {
          bg: "var(--bookmark-item-bg)",
          text: "var(--bookmark-item-text)",
        },
        drawer: {
          background: "var(--drawer-background)",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
