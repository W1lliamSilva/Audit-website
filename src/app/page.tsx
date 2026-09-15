"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import type { AuditResult, Category, CheckStatus, LinkIssue } from "@/lib/audit";
import type { PerfResult, Strategy, Rating } from "@/lib/performance";
import type { ImageIssue, ImagesResult } from "@/lib/images";
import type { SeoResult, PageSeo } from "@/lib/seo";
import type { CompressResult } from "@/lib/compress";

function issueKey(it: LinkIssue): string {
  return `${it.kind}|${it.selector}|${it.targetUrl ?? it.href ?? ""}`;
}

function landmarkOf(location: string): string {
  return location.split(" › ")[0] || location;
}

const STATUS_META: Record<CheckStatus, { icon: string; color: string; bg: string }> = {
  pass: { icon: "✓", color: "#16a34a", bg: "rgba(22, 163, 74, 0.12)" },
  warn: { icon: "!", color: "#b45309", bg: "rgba(217, 119, 6, 0.12)" },
  fail: { icon: "✕", color: "#dc2626", bg: "rgba(220, 38, 38, 0.12)" },
};

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

function splitDetail(d: string): { desc: string; location?: string } {
  const [desc, location] = d.split("  ·  📍 ");
  return { desc, location };
}

// Navegação → categoria da auditoria (ou "overview" para a Visão geral).
const NAV_ITEMS: { label: string; sub?: string; view: string }[] = [
  { label: "Visão geral", view: "overview" },
  { label: "Links quebrados", view: "links" },
  { label: "Botões sem ação", view: "buttons" },
  { label: "Imagens e alt text", sub: "a parte de otimização", view: "images" },
  { label: "SEO", sub: "meta tags, headings, títulos ausentes", view: "seo" },
  { label: "Compressão de imagens", sub: "envie imagens e otimize", view: "compressor" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [auditedUrl, setAuditedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [active, setActive] = useState("Visão geral");

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<ImagesResult | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [seo, setSeo] = useState<SeoResult | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("desktop");
  const [perf, setPerf] = useState<Record<Strategy, PerfResult | null>>({
    desktop: null,
    mobile: null,
  });
  const [perfLoading, setPerfLoading] = useState<Record<Strategy, boolean>>({
    desktop: false,
    mobile: false,
  });

  const loadPerf = useCallback(
    async (u: string, strat: Strategy) => {
      setPerf((prev) => {
        if (prev[strat]) return prev;
        return prev;
      });
      setPerfLoading((prev) => {
        if (prev[strat]) return prev;
        return { ...prev, [strat]: true };
      });
      try {
        const res = await fetch("/api/performance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: u, strategy: strat }),
        });
        const data: PerfResult = await res.json();
        setPerf((prev) => ({ ...prev, [strat]: data }));
      } catch {
        setPerf((prev) => ({
          ...prev,
          [strat]: { strategy: strat, score: null, metrics: [], opportunities: [], error: "Falha ao medir." },
        }));
      } finally {
        setPerfLoading((prev) => ({ ...prev, [strat]: false }));
      }
    },
    []
  );

  const loadImages = useCallback(async (u: string) => {
    setImagesLoading(true);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data: ImagesResult = await res.json();
      setImages(data);
    } catch {
      setImages({ total: 0, withoutAlt: [], pageUrl: u, error: "Falha ao analisar as imagens." });
    } finally {
      setImagesLoading(false);
    }
  }, []);

  const loadSeo = useCallback(async (u: string) => {
    setSeoLoading(true);
    try {
      const res = await fetch("/api/seo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data: SeoResult = await res.json();
      setSeo(data);
    } catch {
      setSeo({ pages: [], source: "links", error: "Falha ao auditar o SEO das páginas." });
    } finally {
      setSeoLoading(false);
    }
  }, []);

  async function runAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPerf({ desktop: null, mobile: null });
    setImages(null);
    setSeo(null);
    setDismissed(new Set());
    setActive("Visão geral");
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na auditoria.");
      setResult(data as AuditResult);
      setAuditedUrl((data as AuditResult).finalUrl);
      // Dispara medição de desempenho e análise de imagens (DOM renderizado).
      loadPerf((data as AuditResult).finalUrl, "desktop");
      loadImages((data as AuditResult).finalUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function switchStrategy(strat: Strategy) {
    setStrategy(strat);
    if (auditedUrl && !perf[strat] && !perfLoading[strat]) {
      loadPerf(auditedUrl, strat);
    }
  }

  const hasResult = result !== null;
  const activeItem = NAV_ITEMS.find((n) => n.label === active) ?? NAV_ITEMS[0];

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: 8,
        minHeight: "100vh",
        background: "var(--bg-lightest)",
        boxSizing: "border-box",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 271,
          flexShrink: 0,
          background: "var(--bg-light)",
          borderRadius: "var(--radius-lg)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          alignItems: "flex-start",
          alignSelf: "stretch",
        }}
      >
        <div
          style={{
            width: "100%",
            paddingBottom: 12,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <Image
            src="/figma/logo.svg"
            alt="Collateral Partners"
            width={137}
            height={32}
            style={{ height: 32, width: "auto" }}
            priority
          />
        </div>

        <nav style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.label;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setActive(item.label);
                  if (item.view === "seo" && auditedUrl && !seo && !seoLoading) {
                    loadSeo(auditedUrl);
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                  padding: 16,
                  borderRadius: "var(--radius-xl)",
                  background: isActive ? "var(--bg-dark)" : "var(--nav-hover)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: "22px",
                    color: isActive ? "#fff" : "var(--text-default)",
                  }}
                >
                  {item.label}
                </span>
                {item.sub && (
                  <span
                    style={{
                      fontSize: 12,
                      lineHeight: "16px",
                      color: isActive ? "rgba(255,255,255,0.6)" : "var(--text-subtle)",
                    }}
                  >
                    {item.sub}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Área principal */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {activeItem.view === "compressor" ? (
          <div style={{ padding: 40 }}>
            <CompressorView />
          </div>
        ) : (
          <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Barra de auditoria (sempre visível) */}
            <form onSubmit={runAudit} style={{ display: "flex", gap: 10, maxWidth: 520 }}>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Link do site"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "var(--bg-lighter)",
                  color: "var(--text-default)",
                  border: "1px solid var(--stroke-light)",
                  borderRadius: 4,
                  padding: "8px 12px",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? "#9d7a2e" : "var(--bg-darker)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "8px 20px",
                  fontSize: 14,
                  cursor: loading ? "default" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? "Auditando…" : "Auditar"}
              </button>
            </form>
            {error && <div style={{ color: "#dc2626", fontSize: 14 }}>⚠️ {error}</div>}

            {!hasResult ? (
              <AuditEmptyState loading={loading} label={activeItem.label} view={activeItem.view} />
            ) : (
              activeItem.view === "overview" ? (
                <Overview
                  result={result}
                  auditedUrl={auditedUrl}
                  strategy={strategy}
                  perf={perf}
                  perfLoading={perfLoading}
                  images={images}
                  imagesLoading={imagesLoading}
                  dismissed={dismissed}
                  onDismiss={(k) => setDismissed((prev) => new Set(prev).add(k))}
                  onStrategy={switchStrategy}
                  onOpenView={(v) => {
                    const item = NAV_ITEMS.find((n) => n.view === v);
                    if (item) setActive(item.label);
                  }}
                />
              ) : activeItem.view === "links" ? (
                <LinkIssuesView
                  title="Links quebrados"
                  issues={result.linkIssues}
                  auditedUrl={auditedUrl}
                  dismissed={dismissed}
                  onDismiss={(k) => setDismissed((prev) => new Set(prev).add(k))}
                />
              ) : activeItem.view === "buttons" ? (
                <LinkIssuesView
                  title="Botões sem ação"
                  issues={result.buttonIssues}
                  auditedUrl={auditedUrl}
                  dismissed={dismissed}
                  onDismiss={(k) => setDismissed((prev) => new Set(prev).add(k))}
                  emptyText="Nenhum botão sem ação encontrado 🎉"
                />
              ) : activeItem.view === "images" ? (
                <ImagesView images={images} loading={imagesLoading} />
              ) : activeItem.view === "seo" ? (
                <SeoView seo={seo} loading={seoLoading} />
              ) : (
                <CategoryView
                  category={result.categories.find((c) => c.id === activeItem.view)}
                  title={activeItem.label}
                />
              ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------- Estado vazio (antes de auditar) ---------- */
function AuditEmptyState({ loading, label, view }: { loading: boolean; label: string; view: string }) {
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "80px 24px" }}>
        <Image src="/figma/search.svg" alt="" width={48} height={48} style={{ width: 48, height: 48, opacity: 0.6 }} />
        <p style={{ fontSize: 14, color: "var(--text-subtle)" }}>Auditando o site…</p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "72px 24px", textAlign: "center" }}>
      <Image src="/figma/search.svg" alt="" width={56} height={56} style={{ width: 56, height: 56 }} priority />
      <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, color: "var(--text-default)", margin: 0 }}>
        Site Audit Tool
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-subtle)", maxWidth: 420, margin: 0 }}>
        {view === "overview"
          ? "Cole a URL de uma página acima e clique em Auditar para checar SEO, acessibilidade, imagens sem alt text e links quebrados."
          : `Faça uma auditoria acima para ver “${label}”. Ou use “Compressão de imagens” na barra lateral, que funciona sem auditar.`}
      </p>
    </div>
  );
}

/* ---------- Gauge de desempenho ---------- */
function Gauge({
  score,
  loading,
  onClick,
}: {
  score: number | null;
  loading: boolean;
  onClick?: () => void;
}) {
  const size = 110;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score ?? 0;
  const color = score === null ? "#d8d6d3" : scoreColor(value);
  const offset = c * (1 - value / 100);
  const clickable = !loading && score !== null && !!onClick;

  const svg = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6e4e1" strokeWidth={stroke} />
      {loading ? (
        // Spinner indeterminado
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#78736f"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * 0.25} ${c * 0.75}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${size / 2} ${size / 2}`}
            to={`360 ${size / 2} ${size / 2}`}
            dur="0.9s"
            repeatCount="indefinite"
          />
        </circle>
      ) : (
        score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )
      )}
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: score === null && !loading ? 24 : 26, fill: score === null ? "#78736f" : "#000" }}
      >
        {loading ? "" : score === null ? "—" : value}
      </text>
      {!loading && (
        <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fill: "#78736f" }}>
          /100
        </text>
      )}
    </svg>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Ver relatório de desempenho"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", borderRadius: "50%" }}
      >
        {svg}
      </button>
    );
  }
  return svg;
}

function DeviceToggle({
  strategy,
  onStrategy,
}: {
  strategy: Strategy;
  onStrategy: (s: Strategy) => void;
}) {
  const pill = (s: Strategy, label: string, icon: React.ReactNode) => {
    const activePill = strategy === s;
    return (
      <button
        type="button"
        onClick={() => onStrategy(s)}
        style={{
          display: "flex",
          gap: 4,
          alignItems: "center",
          padding: "4px 8px",
          borderRadius: 4,
          border: "none",
          cursor: "pointer",
          background: activePill ? "var(--support-teal-light)" : "transparent",
          color: activePill ? "var(--support-teal-base)" : "var(--text-subtle)",
          fontSize: 14,
        }}
      >
        {icon}
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {pill(
        "desktop",
        "Desktop",
        <Image src="/figma/desktop.svg" alt="" width={18} height={18} style={{ width: 18, height: 18 }} />
      )}
      {pill(
        "mobile",
        "Mobile",
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
      )}
    </div>
  );
}

/* ---------- Visão geral (overview) ---------- */
function Overview({
  result,
  auditedUrl,
  strategy,
  perf,
  perfLoading,
  images,
  imagesLoading,
  dismissed,
  onDismiss,
  onStrategy,
  onOpenView,
}: {
  result: AuditResult;
  auditedUrl: string;
  strategy: Strategy;
  perf: Record<Strategy, PerfResult | null>;
  perfLoading: Record<Strategy, boolean>;
  images: ImagesResult | null;
  imagesLoading: boolean;
  dismissed: Set<string>;
  onDismiss: (k: string) => void;
  onStrategy: (s: Strategy) => void;
  onOpenView: (v: string) => void;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const current = perf[strategy];
  const activeIssues = result.linkIssues.filter((it) => !dismissed.has(issueKey(it)));
  const imgsWithoutAlt = images?.withoutAlt ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Cabeçalho + desempenho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, lineHeight: "27px", color: "var(--text-default)", margin: 0 }}>
            Site Audit Tool
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-subtle)", margin: 0, wordBreak: "break-all" }}>{auditedUrl}</p>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <SummaryStat icon="/figma/check-circle.svg" color="#0a7b77" text={`${result.totals.pass} ok`} />
            <SummaryStat icon="/figma/warning.svg" color="#e89d01" text={`${result.totals.warn} ${result.totals.warn === 1 ? "aviso" : "avisos"}`} />
            <SummaryStat icon="/figma/x-circle.svg" color="#e32d14" text={`${result.totals.fail} ${result.totals.fail === 1 ? "falha" : "falhas"}`} />
          </div>
          <p style={{ fontSize: 14, color: "var(--text-subtle)", margin: 0 }}>
            {result.stats.images} imagens · {result.stats.links} links ({result.stats.internalLinks} internos, {result.stats.externalLinks} externos) · {(result.stats.htmlBytes / 1024).toFixed(0)} KB
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "3px 20px" }}>
          <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>Desempenho</span>
          <Gauge score={current?.score ?? null} loading={perfLoading[strategy]} onClick={() => setReportOpen(true)} />
          {perfLoading[strategy] ? (
            <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>Analisando…</span>
          ) : current && current.score !== null ? (
            <button type="button" onClick={() => setReportOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--support-teal-base)", textDecoration: "underline" }}>
              Ver relatório
            </button>
          ) : null}
          <DeviceToggle strategy={strategy} onStrategy={onStrategy} />
          {current?.error && (
            <span style={{ fontSize: 11, color: "#dc2626", maxWidth: 170, textAlign: "center" }}>{current.error}</span>
          )}
        </div>
      </div>

      {reportOpen && (
        <PerfModal
          auditedUrl={auditedUrl}
          strategy={strategy}
          perf={perf}
          perfLoading={perfLoading}
          onStrategy={onStrategy}
          onClose={() => setReportOpen(false)}
        />
      )}

      <Divider />

      {/* Links quebrados / sem destino (prévia) */}
      <Section title="Links quebrados" onSeeAll={activeIssues.length > 3 ? () => onOpenView("links") : undefined}>
        {activeIssues.length === 0 ? (
          <Empty text="Nenhum link com problema encontrado 🎉" />
        ) : (
          activeIssues.slice(0, 3).map((it) => (
            <LinkIssueCard key={issueKey(it)} issue={it} auditedUrl={auditedUrl} onDismiss={() => onDismiss(issueKey(it))} />
          ))
        )}
      </Section>

      <Divider />

      {/* Imagens e alt text (prévia) */}
      <Section title="Imagens e alt text" onSeeAll={imgsWithoutAlt.length > 2 ? () => onOpenView("images") : undefined}>
        {imagesLoading ? (
          <Empty text="Analisando as imagens da página…" />
        ) : images?.error ? (
          <Empty text={images.error} />
        ) : imgsWithoutAlt.length === 0 ? (
          <Empty text={images ? "Todas as imagens têm alt text 🎉" : "—"} />
        ) : (
          imgsWithoutAlt.slice(0, 2).map((im, i) => <ImageCard key={i} image={im} pageUrl={images?.pageUrl ?? auditedUrl} />)
        )}
      </Section>
    </div>
  );
}

function SummaryStat({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <Image src={icon} alt="" width={24} height={24} style={{ width: 24, height: 24 }} />
      <span style={{ fontSize: 14, color }}>{text}</span>
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <span
      style={{
        background: "var(--support-orange-light)",
        color: "var(--text-default)",
        fontSize: 13,
        padding: "3px 10px",
        borderRadius: 100,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, width: "100%", background: "rgba(120,115,111,0.15)" }} />;
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: 14, color: "var(--text-subtle)", margin: 0 }}>{text}</p>;
}

function Section({
  title,
  onSeeAll,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, lineHeight: "27px", color: "var(--text-default)", margin: 0 }}>
          {title}
        </h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} style={{ background: "none", border: "none", color: "var(--text-subtle)", fontSize: 13, cursor: "pointer" }}>
            Ver tudo →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ---------- Tela de uma categoria (Links / Botões / Imagens / SEO) ---------- */
function CategoryView({ category, title }: { category?: Category; title: string }) {
  if (!category) return <Empty text="Sem dados para esta seção." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, lineHeight: "27px", color: "var(--text-default)", margin: 0 }}>
        {title}
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {category.checks.map((check) => {
          const meta = STATUS_META[check.status];
          return (
            <div key={check.id} style={{ display: "flex", gap: 12, padding: 14, background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
              <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: meta.bg, color: meta.color, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                {meta.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-default)" }}>{check.label}</div>
                <div style={{ color: "rgba(36,35,32,0.7)", fontSize: 14 }}>{check.message}</div>
                {check.details && check.details.length > 0 && (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text-subtle)", fontSize: 13, wordBreak: "break-all" }}>
                    {check.details.map((d, i) => {
                      const { desc, location } = splitDetail(d);
                      return (
                        <li key={i} style={{ marginBottom: 4 }}>
                          <span>{desc}</span>
                          {location && (
                            <span style={{ display: "inline-block", marginLeft: 8, padding: "1px 8px", borderRadius: 6, background: "#e0e7ff", color: "#4338ca", fontSize: 12, fontFamily: "var(--font-geist-mono), ui-monospace, monospace", whiteSpace: "nowrap" }}>
                              📍 {location}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Card de problema de link (estilo LinkAudit) ---------- */
function LinkIssueCard({
  issue,
  auditedUrl,
  onDismiss,
}: {
  issue: LinkIssue;
  auditedUrl: string;
  onDismiss: () => void;
}) {
  const [showShot, setShowShot] = useState(false);
  const [shotError, setShotError] = useState(false);

  const dotColor = issue.kind === "broken" ? "#e32d14" : "#e89d01";
  const shotUrl = `/api/screenshot?url=${encodeURIComponent(auditedUrl)}&selector=${encodeURIComponent(issue.selector)}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 16,
        background: "#fff",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
      }}
    >
      {/* Linha 1: rótulo + texto + pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--text-subtle)" }}>
          {issue.label}
        </span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-default)" }}>{issue.text}</span>
        <span
          style={{
            background: "var(--bg-light)",
            color: "var(--text-subtle)",
            fontSize: 13,
            padding: "2px 10px",
            borderRadius: 100,
          }}
        >
          {landmarkOf(issue.location)} · nesta página
        </span>
      </div>

      {/* Linha 2: descrição */}
      <p style={{ margin: 0, fontSize: 14, color: "var(--text-subtle)" }}>{issue.description}</p>

      {/* Página onde aparece */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>Página:</span>
        <a href={auditedUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--support-teal-base)", wordBreak: "break-all" }}>
          {auditedUrl}
        </a>
      </div>

      {/* Linha 3: seletor + ações */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <code
          style={{
            flex: 1,
            minWidth: 180,
            background: "var(--bg-lighter)",
            border: "1px solid var(--stroke-light)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            color: "var(--text-default)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={issue.selector}
        >
          {issue.selector || "—"}
        </code>
        <button
          type="button"
          onClick={() => {
            setShotError(false);
            setShowShot((v) => !v);
          }}
          style={{
            background: "var(--bg-darker)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {showShot ? "Ocultar print" : "Ver na página"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "transparent",
            color: "var(--text-subtle)",
            border: "1px solid var(--stroke-light)",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Descartar
        </button>
      </div>

      {/* Print da página com o elemento destacado */}
      {showShot && (
        <div
          style={{
            marginTop: 4,
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-light)",
            minHeight: 80,
          }}
        >
          {shotError ? (
            <p style={{ margin: 0, padding: 16, fontSize: 13, color: "#dc2626" }}>
              Não foi possível capturar o print desta página.
            </p>
          ) : (
            <>
              <p style={{ margin: 0, padding: "8px 12px", fontSize: 12, color: "var(--text-subtle)" }}>
                Carregando print…
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shotUrl}
                alt="Print da página com o elemento destacado"
                style={{ display: "block", width: "100%", height: "auto" }}
                onError={() => setShotError(true)}
                onLoad={(e) => {
                  const prev = (e.currentTarget.previousElementSibling as HTMLElement) ?? null;
                  if (prev) prev.style.display = "none";
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Tela de Links quebrados (lista de cards) ---------- */
function LinkIssuesView({
  title,
  issues,
  auditedUrl,
  dismissed,
  onDismiss,
  emptyText,
}: {
  title: string;
  issues: LinkIssue[];
  auditedUrl: string;
  dismissed: Set<string>;
  onDismiss: (k: string) => void;
  emptyText?: string;
}) {
  const active = issues.filter((it) => !dismissed.has(issueKey(it)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, lineHeight: "27px", color: "var(--text-default)", margin: 0 }}>
        {title}
      </h1>
      {active.length === 0 ? (
        <Empty text={emptyText ?? "Nenhum link com problema encontrado 🎉"} />
      ) : (
        active.map((it) => (
          <LinkIssueCard key={issueKey(it)} issue={it} auditedUrl={auditedUrl} onDismiss={() => onDismiss(issueKey(it))} />
        ))
      )}
    </div>
  );
}

function formatBytes(bytes: number | null): string | null {
  if (bytes === null || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---------- Card de imagem sem alt ---------- */
function ImageCard({
  image,
  pageUrl,
  comp,
  compLoading,
  onCompress,
}: {
  image: ImageIssue;
  pageUrl: string;
  comp?: CompressResult | null;
  compLoading?: boolean;
  onCompress?: () => void;
}) {
  const name = (image.src.split("?")[0].split("/").pop() || image.src).slice(0, 60);
  const dims = image.width && image.height ? `${image.width}×${image.height}px` : null;
  const weight = formatBytes(image.bytes);
  const downloadName = (name.replace(/\.[a-z0-9]+$/i, "") || "imagem") + ".webp";

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch", padding: 12, background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt=""
        style={{ width: 180, height: 135, objectFit: "cover", borderRadius: 12, background: "var(--bg-light)", flexShrink: 0 }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.opacity = "0.15";
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10, padding: "4px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-default)", wordBreak: "break-all" }}>{name}</span>
            <span style={{ fontSize: 12, color: "#dc2626", background: "rgba(220,38,38,0.1)", padding: "2px 8px", borderRadius: 100 }}>
              Sem alt text
            </span>
          </div>

          {/* Página onde a imagem está */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>Página:</span>
            <a href={pageUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--support-teal-base)", wordBreak: "break-all" }}>
              {pageUrl}
            </a>
            <Pill text={image.location} />
          </div>

          {/* Tamanho da imagem */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13, color: "var(--text-subtle)" }}>
            <span>Tamanho: {dims ?? "—"}</span>
            {weight && <span>· {weight}</span>}
          </div>
        </div>

        {/* Compressor */}
        {onCompress && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {!comp || !comp.ok ? (
            <button
              type="button"
              onClick={onCompress}
              disabled={compLoading}
              style={{ background: "var(--bg-darker)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: compLoading ? "default" : "pointer" }}
            >
              {compLoading ? "Comprimindo…" : "🗜 Comprimir"}
            </button>
          ) : null}
          {comp && comp.ok && (
            <>
              <span style={{ fontSize: 13, color: "var(--text-default)" }}>
                {formatBytes(comp.originalBytes ?? 0)} → <strong>{formatBytes(comp.compressedBytes ?? 0)}</strong>
                {typeof comp.savedPct === "number" && (
                  <span style={{ color: comp.savedPct > 0 ? "#16a34a" : "#78736f", marginLeft: 6, fontWeight: 600 }}>
                    ({comp.savedPct > 0 ? "−" : ""}{Math.abs(comp.savedPct)}%)
                  </span>
                )}
              </span>
              <a
                href={comp.dataUrl}
                download={downloadName}
                style={{ background: "var(--support-teal-base)", color: "#fff", fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}
              >
                Baixar WebP
              </a>
            </>
          )}
          {comp && !comp.ok && (
            <span style={{ fontSize: 12, color: "#dc2626" }}>{comp.error}</span>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Tela de Imagens e alt text ---------- */
function ImagesView({ images, loading }: { images: ImagesResult | null; loading: boolean }) {
  const [quality, setQuality] = useState(78);
  const [results, setResults] = useState<Record<number, CompressResult>>({});
  const [loadingSet, setLoadingSet] = useState<Set<number>>(new Set());
  const [batchRunning, setBatchRunning] = useState(false);
  const [zipping, setZipping] = useState(false);

  const imgs = images?.withoutAlt ?? [];

  const compressOne = useCallback(
    async (i: number, src: string, q: number) => {
      setLoadingSet((prev) => new Set(prev).add(i));
      try {
        const res = await fetch("/api/compress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: src, quality: q }),
        });
        const data: CompressResult = await res.json();
        setResults((prev) => ({ ...prev, [i]: data }));
      } catch {
        setResults((prev) => ({ ...prev, [i]: { ok: false, error: "Falha ao comprimir." } }));
      } finally {
        setLoadingSet((prev) => {
          const n = new Set(prev);
          n.delete(i);
          return n;
        });
      }
    },
    []
  );

  async function compressAll() {
    setBatchRunning(true);
    const indices = imgs.map((_, i) => i).filter((i) => !results[i]?.ok);
    const CONC = 3;
    let cursor = 0;
    async function worker() {
      while (cursor < indices.length) {
        const i = indices[cursor++];
        await compressOne(i, imgs[i].src, quality);
      }
    }
    await Promise.all(Array.from({ length: CONC }, () => worker()));
    setBatchRunning(false);
  }

  async function downloadZip() {
    const ok = Object.entries(results).filter(([, r]) => r.ok && r.dataUrl);
    if (ok.length === 0) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used = new Set<string>();
      for (const [idx, r] of ok) {
        const i = Number(idx);
        const base = (imgs[i].src.split("?")[0].split("/").pop() || `imagem-${i}`).replace(/\.[a-z0-9]+$/i, "");
        let fname = `${base}.webp`;
        let n = 1;
        while (used.has(fname)) fname = `${base}-${n++}.webp`;
        used.add(fname);
        const b64 = (r.dataUrl as string).split(",")[1];
        zip.file(fname, b64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "imagens-otimizadas.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
    } finally {
      setZipping(false);
    }
  }

  const okCount = Object.values(results).filter((r) => r.ok).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, lineHeight: "27px", color: "var(--text-default)", margin: 0 }}>
        Imagens e alt text
      </h1>
      {loading ? (
        <Empty text="Analisando as imagens da página (renderizando com navegador)…" />
      ) : images?.error ? (
        <Empty text={images.error} />
      ) : !images ? (
        <Empty text="—" />
      ) : imgs.length === 0 ? (
        <Empty text={`Todas as ${images.total} imagens têm alt text 🎉`} />
      ) : (
        <>
          <p style={{ fontSize: 14, color: "var(--text-subtle)", margin: 0 }}>
            {imgs.length} de {images.total} imagens sem alt text.
          </p>

          {/* Barra de compressão em lote */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              padding: "12px 16px",
              background: "#fff",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-default)" }}>
              Qualidade
              <input
                type="range"
                min={30}
                max={95}
                step={1}
                value={quality}
                onChange={(e) => {
                  setQuality(Number(e.target.value));
                  setResults({}); // resultados anteriores ficam obsoletos com nova qualidade
                }}
                style={{ accentColor: "var(--support-teal-base)" }}
              />
              <span style={{ fontWeight: 600, minWidth: 28 }}>{quality}</span>
            </label>
            <button
              type="button"
              onClick={compressAll}
              disabled={batchRunning}
              style={{ background: "var(--bg-darker)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: batchRunning ? "default" : "pointer" }}
            >
              {batchRunning ? `Comprimindo… (${okCount}/${imgs.length})` : "🗜 Comprimir todas"}
            </button>
            {okCount > 0 && (
              <button
                type="button"
                onClick={downloadZip}
                disabled={zipping}
                style={{ background: "var(--support-teal-base)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: zipping ? "default" : "pointer" }}
              >
                {zipping ? "Gerando .zip…" : `Baixar tudo (.zip · ${okCount})`}
              </button>
            )}
          </div>

          {imgs.map((im, i) => (
            <ImageCard
              key={i}
              image={im}
              pageUrl={images.pageUrl}
              comp={results[i] ?? null}
              compLoading={loadingSet.has(i)}
              onCompress={() => compressOne(i, im.src, quality)}
            />
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- Modal de relatório de desempenho (estilo PageSpeed) ---------- */
const RATING_COLOR: Record<Rating, string> = {
  good: "#16a34a",
  average: "#d97706",
  poor: "#dc2626",
};
const RATING_LABEL: Record<Rating, string> = {
  good: "Bom",
  average: "Precisa melhorar",
  poor: "Ruim",
};

function PerfModal({
  auditedUrl,
  strategy,
  perf,
  perfLoading,
  onStrategy,
  onClose,
}: {
  auditedUrl: string;
  strategy: Strategy;
  perf: Record<Strategy, PerfResult | null>;
  perfLoading: Record<Strategy, boolean>;
  onStrategy: (s: Strategy) => void;
  onClose: () => void;
}) {
  const current = perf[strategy];
  const loading = perfLoading[strategy];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 24,
        zIndex: 50,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-lightest)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 640,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 20, color: "var(--text-default)", margin: 0 }}>
              Relatório de desempenho
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-subtle)", margin: "4px 0 0", wordBreak: "break-all" }}>{auditedUrl}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, color: "var(--text-subtle)" }}>
            ×
          </button>
        </div>

        {/* Toggle */}
        <DeviceToggle strategy={strategy} onStrategy={onStrategy} />

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0" }}>
            <Gauge score={null} loading />
            <span style={{ fontSize: 13, color: "var(--text-subtle)" }}>Analisando {strategy === "mobile" ? "mobile" : "desktop"}…</span>
          </div>
        ) : current?.error ? (
          <p style={{ fontSize: 14, color: "#dc2626" }}>{current.error}</p>
        ) : current && current.score !== null ? (
          <>
            {/* Score */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <Gauge score={current.score} loading={false} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: scoreColor(current.score) }}>
                  {current.score >= 90 ? "Bom" : current.score >= 50 ? "Precisa melhorar" : "Ruim"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-subtle)", maxWidth: 360, marginTop: 4 }}>
                  Nota de desempenho ({strategy === "mobile" ? "Mobile" : "Desktop"}), baseada no Lighthouse do Google PageSpeed.
                </div>
              </div>
            </div>

            {/* Core Web Vitals */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-default)", margin: "0 0 10px" }}>Métricas</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                {current.metrics.map((m) => {
                  const color = m.rating ? RATING_COLOR[m.rating] : "#78736f";
                  return (
                    <div key={m.id} style={{ background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>{m.label}</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 600, color, marginTop: 6 }}>{m.display}</div>
                      {m.rating && <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>{RATING_LABEL[m.rating]}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Oportunidades */}
            {current.opportunities.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-default)", margin: "0 0 10px" }}>
                  Oportunidades de melhoria
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {current.opportunities.map((o) => (
                    <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px" }}>
                      <span style={{ fontSize: 14, color: "var(--text-default)" }}>{o.title}</span>
                      <span style={{ fontSize: 13, color: "#d97706", whiteSpace: "nowrap", fontWeight: 600 }}>
                        {o.display || `~${(o.savingsMs / 1000).toFixed(1)}s`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: 11, color: "var(--text-subtle)", margin: 0 }}>
              Verde = bom · Amarelo = precisa melhorar · Vermelho = ruim (limiares do Lighthouse).
            </p>
          </>
        ) : (
          <p style={{ fontSize: 14, color: "var(--text-subtle)" }}>Sem dados de desempenho.</p>
        )}
      </div>
    </div>
  );
}

/* ---------- Tela de SEO (abas por página) ---------- */
function pageLabel(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/$/, "");
    return p === "" ? "Home" : p.length > 28 ? "…" + p.slice(-27) : p;
  } catch {
    return url;
  }
}

function SeoView({ seo, loading }: { seo: SeoResult | null; loading: boolean }) {
  const [tab, setTab] = useState(0);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, color: "var(--text-default)", margin: 0 }}>SEO</h1>
        <Empty text="Descobrindo e auditando as páginas do site…" />
      </div>
    );
  }
  if (!seo) return <Empty text="—" />;
  if (seo.error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, color: "var(--text-default)", margin: 0 }}>SEO</h1>
        <Empty text={seo.error} />
      </div>
    );
  }

  const pages = seo.pages;
  const current = pages[Math.min(tab, pages.length - 1)];

  function dotColor(p: PageSeo): string {
    if (p.error || p.totals.fail > 0) return "#dc2626";
    if (p.totals.warn > 0) return "#d97706";
    return "#16a34a";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, color: "var(--text-default)", margin: 0 }}>SEO</h1>
        <p style={{ fontSize: 13, color: "var(--text-subtle)", margin: "4px 0 0" }}>
          {pages.length} página{pages.length !== 1 ? "s" : ""} · descobertas via {seo.source === "sitemap" ? "sitemap.xml" : "links internos"}
        </p>
      </div>

      {/* Abas de páginas */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
        {pages.map((p, i) => {
          const activeTab = i === (tab < pages.length ? tab : 0);
          return (
            <button
              key={p.url}
              type="button"
              onClick={() => setTab(i)}
              title={p.url}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 100,
                border: "1px solid " + (activeTab ? "var(--bg-darker)" : "var(--stroke-light)"),
                background: activeTab ? "var(--bg-darker)" : "#fff",
                color: activeTab ? "#fff" : "var(--text-default)",
                cursor: "pointer",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor(p), flexShrink: 0 }} />
              {pageLabel(p.url)}
            </button>
          );
        })}
      </div>

      {/* Página selecionada */}
      {current && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a href={current.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--support-teal-base)", wordBreak: "break-all" }}>
            {current.url}
          </a>
          {current.error ? (
            <Empty text={current.error} />
          ) : (
            <>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "#16a34a" }}>✓ {current.totals.pass} ok</span>{"  ·  "}
                <span style={{ color: "#b45309" }}>! {current.totals.warn} avisos</span>{"  ·  "}
                <span style={{ color: "#dc2626" }}>✕ {current.totals.fail} falhas</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {current.checks.map((check) => {
                  const meta = STATUS_META[check.status];
                  return (
                    <div key={check.id} style={{ display: "flex", gap: 12, padding: 14, background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
                      <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: meta.bg, color: meta.color, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                        {meta.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "var(--text-default)" }}>{check.label}</div>
                        <div style={{ color: "rgba(36,35,32,0.7)", fontSize: 14 }}>{check.message}</div>
                        {check.details && check.details.length > 0 && (
                          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text-subtle)", fontSize: 13, wordBreak: "break-all" }}>
                            {check.details.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Aba independente: Compressão de imagens ---------- */
type CItem = {
  id: string;
  name: string;
  preview: string;
  kind: "file" | "url";
  payload: string; // dataUrl (file) ou url
  origBytes?: number; // tamanho original (arquivos)
  result: CompressResult | null;
  loading: boolean;
};

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new window.Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

// Compressão no navegador (canvas → WebP): sem upload, sem limite de tamanho.
async function compressDataUrlClient(
  dataUrl: string,
  quality: number,
  maxWidth: number,
  originalBytes: number
): Promise<CompressResult> {
  try {
    const img = await loadImg(dataUrl);
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) return { ok: false, error: "Imagem inválida." };
    if (w > maxWidth) {
      h = Math.round((h * maxWidth) / w);
      w = maxWidth;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, error: "Canvas indisponível." };
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/webp", quality / 100));
    if (!blob) return { ok: false, error: "Não foi possível gerar o WebP." };
    const outDataUrl = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });
    const compressedBytes = blob.size;
    return {
      ok: true,
      format: "webp",
      originalBytes,
      compressedBytes,
      savedPct: originalBytes > 0 ? Math.round((1 - compressedBytes / originalBytes) * 100) : 0,
      width: w,
      height: h,
      dataUrl: outDataUrl,
    };
  } catch {
    return { ok: false, error: "Não foi possível processar esta imagem." };
  }
}

function CompressorView() {
  const [quality, setQuality] = useState(78);
  const [items, setItems] = useState<CItem[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [zipping, setZipping] = useState(false);

  const uid = () => Math.random().toString(36).slice(2);

  async function compressItem(id: string, payload: string, kind: "file" | "url", q: number, origBytes?: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, loading: true } : it)));
    try {
      let data: CompressResult;
      if (kind === "file") {
        // Arquivos são comprimidos no navegador (sem upload → sem limite de tamanho).
        data = await compressDataUrlClient(payload, q, 1600, origBytes ?? 0);
      } else {
        const res = await fetch("/api/compress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: payload, quality: q }),
        });
        data = await res.json();
      }
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, result: data, loading: false } : it)));
    } catch {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, result: { ok: false, error: "Falha ao comprimir." }, loading: false } : it)));
    }
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const id = uid();
        const item: CItem = { id, name: file.name, preview: dataUrl, kind: "file", payload: dataUrl, origBytes: file.size, result: null, loading: true };
        setItems((prev) => [...prev, item]);
        compressItem(id, dataUrl, "file", quality, file.size);
      };
      reader.readAsDataURL(file);
    });
  }

  function addUrl() {
    const u = urlInput.trim();
    if (!u) return;
    const id = uid();
    const name = (u.split("?")[0].split("/").pop() || u).slice(0, 60);
    setItems((prev) => [...prev, { id, name, preview: u, kind: "url", payload: u, result: null, loading: true }]);
    compressItem(id, u, "url", quality);
    setUrlInput("");
  }

  function recompressAll() {
    items.forEach((it) => compressItem(it.id, it.payload, it.kind, quality, it.origBytes));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function downloadZip() {
    const ok = items.filter((it) => it.result?.ok && it.result.dataUrl);
    if (ok.length === 0) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used = new Set<string>();
      for (const it of ok) {
        const base = it.name.replace(/\.[a-z0-9]+$/i, "") || "imagem";
        let fname = `${base}.webp`;
        let n = 1;
        while (used.has(fname)) fname = `${base}-${n++}.webp`;
        used.add(fname);
        zip.file(fname, (it.result!.dataUrl as string).split(",")[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "imagens-otimizadas.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
    } finally {
      setZipping(false);
    }
  }

  const okCount = items.filter((it) => it.result?.ok).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 24, color: "var(--text-default)", margin: 0 }}>
          Compressão de imagens
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-subtle)", margin: "4px 0 0" }}>
          Envie imagens do seu computador (ou cole uma URL), escolha a qualidade e baixe otimizadas em WebP. Não precisa auditar um site.
        </p>
      </div>

      {/* Dropzone / upload */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
        style={{
          border: "2px dashed var(--stroke-light)",
          borderRadius: 12,
          padding: "28px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: "#fff",
          color: "var(--text-subtle)",
          fontSize: 14,
        }}
      >
        <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onFiles(e.target.files)} />
        <div style={{ fontSize: 28, marginBottom: 6 }}>🗜</div>
        Arraste imagens aqui ou <span style={{ color: "var(--support-teal-base)", textDecoration: "underline" }}>clique para selecionar</span>
      </label>

      {/* URL + qualidade + ações */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "12px 16px", background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 240 }}>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addUrl(); }}
            placeholder="…ou cole a URL de uma imagem"
            style={{ flex: 1, minWidth: 0, background: "var(--bg-lighter)", color: "var(--text-default)", border: "1px solid var(--stroke-light)", borderRadius: 4, padding: "8px 12px", fontSize: 14, outline: "none" }}
          />
          <button type="button" onClick={addUrl} style={{ background: "var(--bg-darker)", color: "#fff", border: "none", borderRadius: 4, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Adicionar</button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-default)" }}>
          Qualidade
          <input type="range" min={30} max={95} step={1} value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ accentColor: "var(--support-teal-base)" }} />
          <span style={{ fontWeight: 600, minWidth: 28 }}>{quality}</span>
        </label>
        {items.length > 0 && (
          <button type="button" onClick={recompressAll} style={{ background: "transparent", color: "var(--text-default)", border: "1px solid var(--stroke-light)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
            Recomprimir todas
          </button>
        )}
        {okCount > 0 && (
          <button type="button" onClick={downloadZip} disabled={zipping} style={{ background: "var(--support-teal-base)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: zipping ? "default" : "pointer" }}>
            {zipping ? "Gerando .zip…" : `Baixar tudo (.zip · ${okCount})`}
          </button>
        )}
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <Empty text="Nenhuma imagem adicionada ainda." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => {
            const r = it.result;
            const downloadName = (it.name.replace(/\.[a-z0-9]+$/i, "") || "imagem") + ".webp";
            return (
              <div key={it.id} style={{ display: "flex", gap: 16, alignItems: "center", padding: 12, background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.preview} alt="" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 8, background: "var(--bg-light)", flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.15"; }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-default)", wordBreak: "break-all" }}>{it.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 4 }}>
                    {it.loading ? "Comprimindo…" : r?.ok ? (
                      <>
                        {formatBytes(r.originalBytes ?? 0)} → <strong style={{ color: "var(--text-default)" }}>{formatBytes(r.compressedBytes ?? 0)}</strong>
                        {typeof r.savedPct === "number" && <span style={{ color: r.savedPct > 0 ? "#16a34a" : "#78736f", marginLeft: 6, fontWeight: 600 }}>({r.savedPct > 0 ? "−" : ""}{Math.abs(r.savedPct)}%)</span>}
                        {r.width && r.height && <span style={{ marginLeft: 8 }}>· {r.width}×{r.height}px</span>}
                      </>
                    ) : r && !r.ok ? <span style={{ color: "#dc2626" }}>{r.error}</span> : "—"}
                  </div>
                </div>
                {r?.ok && (
                  <a href={r.dataUrl} download={downloadName} style={{ background: "var(--support-teal-base)", color: "#fff", fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8, whiteSpace: "nowrap" }}>Baixar WebP</a>
                )}
                <button type="button" onClick={() => removeItem(it.id)} aria-label="Remover" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-subtle)", lineHeight: 1 }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
