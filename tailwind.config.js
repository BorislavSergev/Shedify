module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/pages/**/*.{{js,jsx,ts,tsx}}"
  ],
  theme: {
    extend: {

      animation: {
        scroll: 'scroll 50s linear infinite',
      },
      keyframes: {
        scroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },


      colors: {
        primary: '#edfcf3',
        bgSecondary: '#111111',
        txtPrimary: '#000000',
        accent: '#1cd05e',
        accentHover: '#16a34a',
        itemsHover: '#d9fae5',
        secondary: '#6b7280', // Optional: Add a secondary neutral gray
      },
      transitionProperty: {
        'width': 'width',
      }

    },
  },
  plugins: [],
};
