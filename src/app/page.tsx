"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import type { AuditResult, Category, CheckStatus } from "@/lib/audit";
import type { PerfResult, Strategy } from "@/lib/performance";

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
  { label: "Botões sem ação", view: "accessibility" },
  { label: "Imagens e alt text", sub: "a parte de otimização", view: "images" },
  { label: "SEO", sub: "meta tags, headings, títulos ausentes", view: "seo" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [auditedUrl, setAuditedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [active, setActive] = useState("Visão geral");

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
          [strat]: { strategy: strat, score: null, metrics: [], error: "Falha ao medir." },
        }));
      } finally {
        setPerfLoading((prev) => ({ ...prev, [strat]: false }));
      }
    },
    []
  );

  async function runAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPerf({ desktop: null, mobile: null });
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
      // Dispara a medição de desempenho (desktop primeiro).
      loadPerf((data as AuditResult).finalUrl, "desktop");
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
          position: "sticky",
          top: 8,
          alignSelf: "flex-start",
          maxHeight: "calc(100vh - 16px)",
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
            const disabled = !hasResult && item.view !== "overview";
            return (
              <button
                key={item.label}
                type="button"
                disabled={disabled}
                onClick={() => setActive(item.label)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
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
        {!hasResult ? (
          <EntryHero
            url={url}
            setUrl={setUrl}
            loading={loading}
            error={error}
            onSubmit={runAudit}
          />
        ) : (
          <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Barra de nova auditoria */}
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
                  background: loading ? "#4a4844" : "var(--bg-darker)",
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

            {result &&
              (activeItem.view === "overview" ? (
                <Overview
                  result={result}
                  auditedUrl={auditedUrl}
                  strategy={strategy}
                  perf={perf}
                  perfLoading={perfLoading}
                  onStrategy={switchStrategy}
                  onOpenView={(v) => {
                    const item = NAV_ITEMS.find((n) => n.view === v);
                    if (item) setActive(item.label);
                  }}
                />
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

/* ---------- Tela inicial (entrada) ---------- */
function EntryHero({
  url,
  setUrl,
  loading,
  error,
  onSubmit,
}: {
  url: string;
  setUrl: (v: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Image src="/figma/search.svg" alt="" width={56} height={56} style={{ width: 56, height: 56 }} priority />
        <h1
          style={{
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontWeight: 500,
            fontSize: 28,
            lineHeight: "31px",
            color: "var(--text-default)",
            margin: 0,
            textAlign: "center",
          }}
        >
          Site Audit Tool
        </h1>
        <p style={{ fontSize: 14, lineHeight: "22px", color: "var(--text-subtle)", textAlign: "center", maxWidth: 384, margin: 0 }}>
          Cole a URL de uma página para checar SEO, acessibilidade, imagens sem alt text e links quebrados.
        </p>
        <form onSubmit={onSubmit} style={{ display: "flex", gap: 10, width: "100%", maxWidth: 400, marginTop: 6 }}>
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
              lineHeight: "22px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#4a4844" : "var(--bg-darker)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "8px 20px",
              fontSize: 16,
              lineHeight: "24px",
              cursor: loading ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Auditando…" : "Auditar"}
          </button>
        </form>
        {error && (
          <div style={{ width: "100%", maxWidth: 400, padding: 12, background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", borderRadius: 4, fontSize: 14, textAlign: "center" }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Gauge de desempenho ---------- */
function Gauge({ score, loading }: { score: number | null; loading: boolean }) {
  const size = 110;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score ?? 0;
  const color = score === null ? "#d8d6d3" : scoreColor(value);
  const offset = c * (1 - value / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6e4e1" strokeWidth={stroke} />
      {score !== null && (
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
      )}
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 600, fontSize: 24, fill: "#000" }}
      >
        {loading ? "…" : score === null ? "—" : value}
      </text>
      <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fill: "#78736f" }}>
        /100
      </text>
    </svg>
  );
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
  onStrategy,
  onOpenView,
}: {
  result: AuditResult;
  auditedUrl: string;
  strategy: Strategy;
  perf: Record<Strategy, PerfResult | null>;
  perfLoading: Record<Strategy, boolean>;
  onStrategy: (s: Strategy) => void;
  onOpenView: (v: string) => void;
}) {
  const current = perf[strategy];
  const brokenCheck = result.categories.find((c) => c.id === "links")?.checks.find((c) => c.id === "broken");
  const brokenDetails = brokenCheck?.details ?? [];
  const imgCheck = result.categories.find((c) => c.id === "images")?.checks.find((c) => c.id === "img-alt");
  const imgDetails = imgCheck?.status === "fail" ? imgCheck.details ?? [] : [];

  let base: URL | null = null;
  try {
    base = new URL(auditedUrl);
  } catch {}

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Cabeçalho + desempenho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
          <h1 style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 500, fontSize: 24, lineHeight: "27px", color: "var(--text-default)", margin: 0 }}>
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

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "3px 20px" }}>
          <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>Desempenho</span>
          <Gauge score={current?.score ?? null} loading={perfLoading[strategy]} />
          <DeviceToggle strategy={strategy} onStrategy={onStrategy} />
          {current?.error && (
            <span style={{ fontSize: 11, color: "#dc2626", maxWidth: 160, textAlign: "center" }}>{current.error}</span>
          )}
        </div>
      </div>

      {/* métricas de desempenho */}
      {current && current.score !== null && current.metrics.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {current.metrics.map((m) => (
            <div key={m.id} style={{ background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 12px", minWidth: 120 }}>
              <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-default)" }}>{m.display}</div>
            </div>
          ))}
        </div>
      )}

      <Divider />

      {/* Links quebrados (prévia) */}
      <Section title="Links quebrados" onSeeAll={() => onOpenView("links")}>
        {brokenDetails.length === 0 || brokenCheck?.status === "pass" ? (
          <Empty text="Nenhum link quebrado encontrado 🎉" />
        ) : (
          brokenDetails.map((d, i) => {
            const { desc, location } = splitDetail(d);
            const urlMatch = desc.match(/^(\S+)\s*(\(.*\))?/);
            const link = urlMatch?.[1] ?? desc;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: "var(--text-subtle)", wordBreak: "break-all" }}>{desc}</span>
                  {location && <Pill text={location} />}
                </div>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "var(--support-teal-base)", color: "#fff", fontSize: 14, textDecoration: "none", padding: "8px 18px", borderRadius: 100, whiteSpace: "nowrap" }}
                >
                  Abrir link
                </a>
              </div>
            );
          })
        )}
      </Section>

      <Divider />

      {/* Imagens e alt text (prévia) */}
      <Section title="Imagens e alt text" onSeeAll={() => onOpenView("images")}>
        {imgDetails.length === 0 ? (
          <Empty text="Todas as imagens têm alt text 🎉" />
        ) : (
          imgDetails.map((d, i) => {
            const { desc, location } = splitDetail(d);
            let src = desc;
            try {
              if (base) src = new URL(desc, base).toString();
            } catch {}
            const name = desc.split("/").pop() || desc;
            return (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  style={{ width: 160, height: 120, objectFit: "cover", borderRadius: 12, background: "var(--bg-light)", flexShrink: 0 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10, padding: "4px 0" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-default)", wordBreak: "break-all" }}>{name}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, color: "var(--text-subtle)" }}>{base?.host ?? auditedUrl}</span>
                      {location && <Pill text={location} />}
                    </div>
                  </div>
                  <div style={{ background: "var(--bg-light)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 14, color: "var(--text-subtle)" }}>Sem alt text — geração por IA em breve</span>
                    <Image src="/figma/copy.svg" alt="Copiar" width={20} height={20} style={{ width: 20, height: 20, opacity: 0.5 }} />
                  </div>
                </div>
              </div>
            );
          })
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
        <h2 style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 500, fontSize: 24, lineHeight: "27px", color: "var(--text-default)", margin: 0 }}>
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
      <h1 style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 500, fontSize: 24, lineHeight: "27px", color: "var(--text-default)", margin: 0 }}>
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
