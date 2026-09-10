"use client";

import { useState } from "react";
import Image from "next/image";
import type { AuditResult, CheckStatus } from "@/lib/audit";

const STATUS_META: Record<CheckStatus, { icon: string; color: string; bg: string }> = {
  pass: { icon: "✓", color: "#4ade80", bg: "rgba(74, 222, 128, 0.15)" },
  warn: { icon: "!", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)" },
  fail: { icon: "✕", color: "#f87171", bg: "rgba(248, 113, 113, 0.15)" },
};

function scoreColor(score: number): string {
  if (score >= 80) return "#4ade80";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);

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
        background: "#000",
        boxSizing: "border-box",
      }}
    >
      {/* Sidebar (dashboard — conteúdo a definir) */}
      <aside
        style={{
          width: 312,
          flexShrink: 0,
          background: "var(--bg-darker)",
          borderRadius: 8,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: "100%",
            paddingBottom: 16,
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
              color: "#fff",
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
                background: "var(--bg-dark)",
                color: "#fff",
                border: "none",
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
                background: loading ? "#c9c7c2" : "#fff",
                color: "#000",
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
                background: "rgba(248, 113, 113, 0.12)",
                color: "#f87171",
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
          background: "var(--bg-darker)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
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
          <div style={{ fontWeight: 600, color: "#fff", wordBreak: "break-all" }}>
            {result.finalUrl}
          </div>
          <div style={{ fontSize: 14, margin: "6px 0" }}>
            <span style={{ color: "#4ade80" }}>✓ {result.totals.pass} ok</span>
            {"  ·  "}
            <span style={{ color: "#fbbf24" }}>! {result.totals.warn} avisos</span>
            {"  ·  "}
            <span style={{ color: "#f87171" }}>✕ {result.totals.fail} falhas</span>
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
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 10 }}>
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
                    background: "var(--bg-darker)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
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
                    <div style={{ fontWeight: 600, color: "#fff" }}>{check.label}</div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
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
                                    background: "rgba(129, 140, 248, 0.18)",
                                    color: "#c7d2fe",
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
