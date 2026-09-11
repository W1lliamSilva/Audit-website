import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mantém o Chromium/puppeteer como pacotes externos (não empacotados pelo
  // bundler), essencial para o @sparticuz/chromium funcionar nas funções
  // serverless da Vercel.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Força a inclusão do binário do Chromium (pasta bin com os .br) nas funções
  // que usam o navegador headless — sem isso a Vercel não o traça.
  outputFileTracingIncludes: {
    "/api/images": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/screenshot": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
