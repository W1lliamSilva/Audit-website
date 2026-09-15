// Compressão de imagens com sharp: reduz o tamanho reamostrando (se muito
// grande) e reconvertendo para WebP (melhor compressão para a web).

import sharp from "sharp";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)";
const MAX_INPUT_BYTES = 20 * 1024 * 1024; // 20 MB

export interface CompressResult {
  ok: boolean;
  format?: string;
  originalBytes?: number;
  compressedBytes?: number;
  savedPct?: number;
  width?: number;
  height?: number;
  dataUrl?: string;
  error?: string;
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function compressImage(
  rawUrl: string,
  opts: { quality?: number; maxWidth?: number } = {}
): Promise<CompressResult> {
  const url = normalizeUrl(rawUrl);
  const quality = opts.quality ?? 78;
  const maxWidth = opts.maxWidth ?? 1600;

  let buf: Buffer;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `Não foi possível baixar a imagem (HTTP ${res.status}).` };
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("svg") || url.toLowerCase().endsWith(".svg")) {
      return { ok: false, error: "SVG é vetorial — compressão de bitmap não se aplica." };
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_INPUT_BYTES) return { ok: false, error: "Imagem muito grande para comprimir (limite 20 MB)." };
    buf = Buffer.from(ab);
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "A imagem demorou demais para baixar." : "Falha ao baixar a imagem." };
  }

  try {
    const originalBytes = buf.length;
    const img = sharp(buf, { failOn: "none" });
    const meta = await img.metadata();
    let pipeline = img.rotate(); // respeita orientação EXIF
    if (meta.width && meta.width > maxWidth) {
      pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
    }
    const out = await pipeline.webp({ quality }).toBuffer({ resolveWithObject: true });
    const compressedBytes = out.info.size;
    const savedPct = originalBytes > 0 ? Math.round((1 - compressedBytes / originalBytes) * 100) : 0;
    return {
      ok: true,
      format: "webp",
      originalBytes,
      compressedBytes,
      savedPct,
      width: out.info.width,
      height: out.info.height,
      dataUrl: `data:image/webp;base64,${out.data.toString("base64")}`,
    };
  } catch {
    return { ok: false, error: "Não foi possível processar esta imagem." };
  }
}
