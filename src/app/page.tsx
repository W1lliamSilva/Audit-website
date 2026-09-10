"use client";

import { useState } from "react";
import Image from "next/image";
import type { AuditResult, CheckStatus } from "@/lib/audit";

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

// Itens de navegação do dashboard (telas serão implementadas a seguir).
const NAV_ITEMS: { label: string; sub?: string }[] = [
  { label: "Visão geral" },
  { label: "Links quebrados" },
  { label: "Botões sem ação" },
  { label: "Imagens e alt text", sub: "a parte de otimização" },
  { label: "SEO", sub: "meta tags, headings, títulos ausentes" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [active, setActive] = useState("Visão geral");

  async function runAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na auditoria.");
      setResult(data as AuditResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  const hasResult = result !== null;

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
                onClick={() => setActive(item.label)}
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
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: hasResult ? "flex-start" : "center",
          overflowY: "auto",
          padding: hasResult ? "48px 24px" : "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: hasResult ? 820 : 460,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          {!hasResult && (
            <Image
              src="/figma/search.svg"
              alt=""
              width={56}
              height={56}
              style={{ width: 56, height: 56 }}
              priority
            />
          )}

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

          <p
            style={{
              fontSize: 14,
              lineHeight: "22px",
              color: "var(--text-subtle)",
              textAlign: "center",
              maxWidth: 384,
              margin: 0,
            }}
          >
            Cole a URL de uma página para checar SEO, acessibilidade, imagens sem
            alt text e links quebrados.
          </p>

          <form
            onSubmit={runAudit}
            style={{
              display: "flex",
              gap: 10,
              width: "100%",
              maxWidth: 400,
              marginTop: 6,
            }}
          >
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
            <div
              style={{
                width: "100%",
                maxWidth: 400,
                padding: 12,
                background: "rgba(220, 38, 38, 0.1)",
                color: "#dc2626",
                borderRadius: 4,
                fontSize: 14,
                textAlign: "center",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {result && <Results result={result} />}
        </div>
      </main>
    </div>
  );
}

function Results({ result }: { result: AuditResult }) {
  return (
    <section style={{ width: "100%", marginTop: 32, textAlign: "left" }}>
      {/* Cabeçalho / nota */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: 24,
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `6px solid ${scoreColor(result.score)}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, color: scoreColor(result.score) }}>
            {result.score}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>/ 100</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "var(--text-default)", wordBreak: "break-all" }}>
            {result.finalUrl}
          </div>
          <div style={{ fontSize: 14, margin: "6px 0" }}>
            <span style={{ color: "#16a34a" }}>✓ {result.totals.pass} ok</span>
            {"  ·  "}
            <span style={{ color: "#b45309" }}>! {result.totals.warn} avisos</span>
            {"  ·  "}
            <span style={{ color: "#dc2626" }}>✕ {result.totals.fail} falhas</span>
          </div>
          <div style={{ color: "var(--text-subtle)", fontSize: 13 }}>
            {result.stats.images} imagens · {result.stats.links} links (
            {result.stats.internalLinks} internos, {result.stats.externalLinks} externos) ·{" "}
            {(result.stats.htmlBytes / 1024).toFixed(0)} KB
          </div>
        </div>
      </div>

      {result.categories.map((cat) => (
        <div key={cat.id} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-default)", marginBottom: 10 }}>
            {cat.label}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cat.checks.map((check) => {
              const meta = STATUS_META[check.status];
              return (
                <div
                  key={check.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 14,
                    background: "#fff",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: meta.bg,
                      color: meta.color,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                    }}
                  >
                    {meta.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-default)" }}>{check.label}</div>
                    <div style={{ color: "rgba(36,35,32,0.7)", fontSize: 14 }}>
                      {check.message}
                    </div>
                    {check.details && check.details.length > 0 && (
                      <ul
                        style={{
                          margin: "8px 0 0",
                          paddingLeft: 18,
                          color: "var(--text-subtle)",
                          fontSize: 13,
                          wordBreak: "break-all",
                        }}
                      >
                        {check.details.map((d, i) => {
                          const [desc, location] = d.split("  ·  📍 ");
                          return (
                            <li key={i} style={{ marginBottom: 4 }}>
                              <span>{desc}</span>
                              {location && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    marginLeft: 8,
                                    padding: "1px 8px",
                                    borderRadius: 6,
                                    background: "#e0e7ff",
                                    color: "#4338ca",
                                    fontSize: 12,
                                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                                    whiteSpace: "nowrap",
                                  }}
                                >
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
      ))}
    </section>
  );
}
