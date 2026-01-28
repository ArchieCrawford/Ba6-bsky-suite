import nextra from "nextra";

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
  latex: false
});

export default withNextra({
  reactStrictMode: true,
  swcMinify: true
});
