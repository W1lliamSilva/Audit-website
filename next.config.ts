import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mantém o Chromium/puppeteer como pacotes externos (não empacotados pelo
  // bundler), essencial para o @sparticuz/chromium funcionar nas funções
  // serverless da Vercel.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
