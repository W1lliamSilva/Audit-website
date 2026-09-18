// Inspeção visual (portado do "Collateral Inspector"): varre o DOM renderizado
// e extrai cores (com categoria semântica), gradientes, fontes, escala
// tipográfica e tokens (nomes tipo primary/surface/accent/danger…).
// Roda no Chromium headless via page.evaluate (função real, sem string).

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ColorUse {
  value: string;
  count: number;
  categories: string[];
  examples: string[];
}
export interface GradientUse {
  value: string;
  count: number;
  colors: string[];
  examples: string[];
}
export interface InspectResult {
  colors: ColorUse[];
  colorGroups: Record<string, ColorUse[]>;
  gradients: GradientUse[];
  fonts: { value: string; count: number }[];
  typeScale: { value: string; count: number }[];
  typeSamples: any[];
  tokens: {
    colors: Record<string, string>;
    fonts: Record<string, string>;
    radius: Record<string, string>;
    shadows: Record<string, string>;
    spacing: Record<string, string>;
  };
  scanned: number;
  pageUrl: string;
  error?: string;
}

const LOCAL_CHROME_PATHS = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].filter(Boolean) as string[];

async function resolveLaunchOptions() {
  const onVercel = !!process.env.VERCEL || !!process.env.AWS_REGION;
  if (onVercel) {
    return { args: chromium.args, executablePath: await chromium.executablePath(), headless: true as const };
  }
  const fs = await import("node:fs");
  const local = LOCAL_CHROME_PATHS.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
  return { args: ["--no-sandbox", "--disable-setuid-sandbox"], executablePath: local ?? undefined, headless: true as const };
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// Função executada DENTRO da página (browser). Autocontida.
function pageAudit() {
  function parseColorChannel(v: string) {
    const text = String(v).trim();
    if (text.endsWith("%")) return (parseFloat(text) / 100) * 255;
    return parseFloat(text);
  }
  function rgbToHex(r: number, g: number, b: number) {
    return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }
  function toHex(value: string): string {
    if (!value) return "";
    const n = String(value).trim().toLowerCase();
    if (n === "transparent") return "#00000000";
    if (/^#[a-f0-9]{8}$/i.test(n)) return n.endsWith("00") ? "#00000000" : n.slice(0, 7);
    if (/^#[a-f0-9]{6}$/i.test(n)) return n;
    if (/^#[a-f0-9]{3}$/i.test(n)) return `#${n[1]}${n[1]}${n[2]}${n[2]}${n[3]}${n[3]}`;
    const m = n.match(/rgba?\(([^)]+)\)/);
    if (!m) return value;
    const parts = m[1].split("/");
    const channels = parts[0].includes(",") ? parts[0].split(",") : parts[0].trim().split(/\s+/);
    const alpha = parseFloat(parts[1] ?? channels[3] ?? "1");
    if (alpha === 0) return "#00000000";
    const rgb = channels.slice(0, 3).map(parseColorChannel);
    if (rgb.some((c) => Number.isNaN(c))) return value;
    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  function normalizeAuditColor(value: string) {
    const c = toHex(value);
    if (!c || c === "none" || c === "normal" || c === "#00000000") return "";
    return c.toLowerCase();
  }
  function hexToRgb(hex: string) {
    const m = String(hex).match(/^#([a-f0-9]{6})$/i);
    if (!m) return null;
    const v = parseInt(m[1], 16);
    return { red: (v >> 16) & 255, green: (v >> 8) & 255, blue: v & 255 };
  }
  function relativeLuminance(rgb: { red: number; green: number; blue: number }) {
    const ch = [rgb.red, rgb.green, rgb.blue].map((value) => {
      const nrm = value / 255;
      return nrm <= 0.03928 ? nrm / 12.92 : ((nrm + 0.055) / 1.055) ** 2.4;
    });
    return ch[0] * 0.2126 + ch[1] * 0.7152 + ch[2] * 0.0722;
  }
  function rgbToHue({ red, green, blue }: { red: number; green: number; blue: number }) {
    const r = red / 255, g = green / 255, b = blue / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    if (delta === 0) return 0;
    const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return Math.round((hue * 60 + 360) % 360);
  }
  function getSelector(el: Element) {
    if (!el || !el.tagName) return "";
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${el.id}`;
    const cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean)[0];
    return cls ? `${tag}.${cls}` : tag;
  }
  function pushUnique(list: string[], value: string, limit: number) {
    if (!value || list.includes(value)) return;
    if (list.length < limit) list.push(value);
  }
  function addCount(map: Map<string, number>, value: string) {
    if (!value || value === "none" || value === "normal") return;
    map.set(value, (map.get(value) || 0) + 1);
  }
  function cleanFontFamily(value: string) {
    return String(value || "").split(",").map((p) => p.trim().replace(/^["']|["']$/g, "")).filter(Boolean).join(", ");
  }
  function extractColors(value: string) {
    const text = String(value || "");
    const results: string[] = [];
    const patterns = [/#[a-f0-9]{3,8}\b/gi, /rgba?\((?:[^()]|\([^)]*\))*\)/gi];
    for (const pattern of patterns) {
      let m = pattern.exec(text);
      while (m) {
        results.push(m[0]);
        m = pattern.exec(text);
      }
    }
    return results;
  }
  function addColorUse(map: Map<string, any>, value: string, category: string, el: Element) {
    const color = normalizeAuditColor(value);
    if (!color) return;
    const rec = map.get(color) || { value: color, count: 0, categories: new Set(), examples: [] };
    rec.count += 1;
    rec.categories.add(category);
    pushUnique(rec.examples, getSelector(el), 4);
    map.set(color, rec);
  }
  function addShadowColors(map: Map<string, any>, value: string, el: Element) {
    if (!value || value === "none") return;
    extractColors(value).forEach((c) => addColorUse(map, c, "sombra", el));
  }
  function addGradientUses(colorMap: Map<string, any>, gradientMap: Map<string, any>, value: string, el: Element) {
    if (!value || value === "none" || !value.includes("gradient(")) return;
    const gradients = value.match(/(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\([^)]*\))*\)/g) || [];
    for (const gradient of gradients) {
      const colors = extractColors(gradient).map(toHex).map(normalizeAuditColor).filter(Boolean);
      if (!colors.length) continue;
      const rec = gradientMap.get(gradient) || { value: gradient, count: 0, colors: [], examples: [] };
      rec.count += 1;
      rec.colors = [...new Set([...rec.colors, ...colors])].slice(0, 8);
      pushUnique(rec.examples, getSelector(el), 4);
      gradientMap.set(gradient, rec);
      colors.forEach((c) => addColorUse(colorMap, c, "gradiente", el));
    }
  }
  function addTypeSample(map: Map<string, any>, key: string, styles: CSSStyleDeclaration, el: Element) {
    const existing = map.get(key) || {
      value: key,
      count: 0,
      fontFamily: cleanFontFamily(styles.fontFamily),
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      lineHeight: styles.lineHeight,
      sample: "",
      selector: getSelector(el),
    };
    existing.count += 1;
    const text = el.textContent?.trim().replace(/\s+/g, " ").slice(0, 72);
    if (!existing.sample && text) existing.sample = text;
    map.set(key, existing);
  }
  function topCounts(map: Map<string, number>, limit: number) {
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ value, count }));
  }
  function topColorUses(map: Map<string, any>, limit: number): any[] {
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit).map((item) => ({
      value: item.value,
      count: item.count,
      categories: [...item.categories],
      examples: item.examples,
    }));
  }
  function topGeneric(map: Map<string, any>, limit: number) {
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  }
  function groupColorsByCategory(colors: any[]) {
    return colors.reduce((groups: Record<string, any[]>, color) => {
      color.categories.forEach((category: string) => {
        groups[category] = groups[category] || [];
        groups[category].push(color);
      });
      return groups;
    }, {});
  }
  function semanticColorName(color: any, index: number) {
    const categories = color.categories || [];
    const rgb = hexToRgb(color.value);
    const hue = rgb ? rgbToHue(rgb) : 0;
    const lum = rgb ? relativeLuminance(rgb) : 0.5;
    if (categories.includes("background") && lum > 0.86) return index === 0 ? "surface" : `surface-${index + 1}`;
    if (categories.includes("texto") && lum < 0.28) return index === 0 ? "text" : `text-${index + 1}`;
    if (hue >= 350 || hue < 18) return `danger-${index + 1}`;
    if (hue >= 25 && hue < 58) return `warning-${index + 1}`;
    if (hue >= 80 && hue < 165) return `success-${index + 1}`;
    if (lum > 0.72) return `muted-${index + 1}`;
    if (categories.includes("borda")) return `border-${index + 1}`;
    if (categories.includes("gradiente")) return `gradient-${index + 1}`;
    return index === 0 ? "primary" : index === 1 ? "accent" : `color-${String(index + 1).padStart(2, "0")}`;
  }
  function objectFromTopCounts(map: Map<string, number>, limit: number, prefix: string) {
    return topCounts(map, limit).reduce((acc: Record<string, string>, item, index) => {
      acc[`${prefix}-${String(index + 1).padStart(2, "0")}`] = item.value;
      return acc;
    }, {});
  }

  const colorMap = new Map<string, any>();
  const fontCount = new Map<string, number>();
  const typeScaleCount = new Map<string, number>();
  const typeSampleMap = new Map<string, any>();
  const gradientMap = new Map<string, any>();
  const radiusCount = new Map<string, number>();
  const shadowCount = new Map<string, number>();
  const spacingCount = new Map<string, number>();

  const elements = ([...document.querySelectorAll("body *")] as Element[]).slice(0, 4000);
  for (const el of elements) {
    const styles = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    addColorUse(colorMap, toHex(styles.color), "texto", el);
    addColorUse(colorMap, toHex(styles.backgroundColor), "background", el);
    addColorUse(colorMap, toHex(styles.borderColor), "borda", el);
    addShadowColors(colorMap, styles.boxShadow, el);
    addGradientUses(colorMap, gradientMap, styles.backgroundImage, el);
    addCount(fontCount, cleanFontFamily(styles.fontFamily));
    addCount(typeScaleCount, `${styles.fontSize} / ${styles.lineHeight} · ${styles.fontWeight}`);
    addTypeSample(typeSampleMap, `${styles.fontSize} / ${styles.lineHeight} · ${styles.fontWeight}`, styles, el);
    addCount(radiusCount, styles.borderRadius);
    addCount(shadowCount, styles.boxShadow);
    [styles.marginTop, styles.marginBottom, styles.paddingTop, styles.paddingBottom, styles.gap].forEach((v) => addCount(spacingCount, v));
  }

  const colors = topColorUses(colorMap, 28);
  const tokenColors: Record<string, string> = {};
  colors.slice(0, 12).forEach((color, index) => {
    tokenColors[semanticColorName(color, index)] = color.value;
  });

  return {
    colors,
    colorGroups: groupColorsByCategory(colors),
    gradients: topGeneric(gradientMap, 12),
    fonts: topCounts(fontCount, 12),
    typeScale: topCounts(typeScaleCount, 12),
    typeSamples: topGeneric(typeSampleMap, 18),
    tokens: {
      colors: tokenColors,
      fonts: objectFromTopCounts(fontCount, 5, "font"),
      radius: objectFromTopCounts(radiusCount, 8, "radius"),
      shadows: objectFromTopCounts(shadowCount, 8, "shadow"),
      spacing: objectFromTopCounts(spacingCount, 12, "space"),
    },
    scanned: elements.length,
  };
}

export async function inspectSite(rawUrl: string): Promise<InspectResult> {
  const url = normalizeUrl(rawUrl);
  const opts = await resolveLaunchOptions();
  let browser;
  try {
    browser = await puppeteer.launch({
      args: opts.args,
      executablePath: opts.executablePath,
      headless: opts.headless,
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    // rola para carregar conteúdo lazy
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let y = 0;
        const step = () => {
          window.scrollBy(0, 900);
          y += 900;
          if (y >= document.body.scrollHeight || y > 16000) {
            window.scrollTo(0, 0);
            resolve();
          } else setTimeout(step, 80);
        };
        step();
      });
    });
    const data = (await page.evaluate(pageAudit)) as Omit<InspectResult, "pageUrl">;
    return { ...data, pageUrl: page.url() || url };
  } catch (err) {
    const error = err instanceof Error ? `Falha na inspeção: ${err.message}` : "Falha na inspeção.";
    return {
      colors: [], colorGroups: {}, gradients: [], fonts: [], typeScale: [], typeSamples: [],
      tokens: { colors: {}, fonts: {}, radius: {}, shadows: {}, spacing: {} },
      scanned: 0, pageUrl: url, error,
    };
  } finally {
    if (browser) await browser.close();
  }
}
