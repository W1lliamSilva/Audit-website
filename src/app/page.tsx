"use client";

import { useState } from "react";
import type { AuditResult, CheckStatus } from "@/lib/audit";

const STATUS_META: Record<CheckStatus, { icon: string; color: string; bg: string }> = {
  pass: { icon: "✓", color: "#15803d", bg: "#dcfce7" },
  warn: { icon: "!", color: "#b45309", bg: "#fef3c7" },
  fail: { icon: "✕", color: "#b91c1c", bg: "#fee2e2" },
};

function scoreColor(score: number): string {
  if (score >= 80) return "#15803d";
  if (score >= 50) return "#b45309";
  return "#b91c1c";
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

  return (
    <main
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "48px 20px 80px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
        🔍 Site Audit Tool
      </h1>
      <p style={{ color: "#64748b", marginBottom: 28 }}>
        Cole a URL de uma página para checar SEO, acessibilidade, imagens sem
        alt text e links quebrados.
      </p>

      <form onSubmit={runAudit} style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="exemplo.com"
          style={{
            flex: 1,
            padding: "12px 16px",
            fontSize: 16,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 600,
            color: "#fff",
            background: loading ? "#94a3b8" : "#2563eb",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Auditando…" : "Auditar"}
        </button>
      </form>

      {error && (
        <div
          style={{
            padding: 16,
            background: "#fee2e2",
            color: "#b91c1c",
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {result && (
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: 24,
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: `6px solid ${scoreColor(result.score)}`,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 700, color: scoreColor(result.score) }}>
                {result.score}
              </span>
              <span style={{ fontSize: 11, color: "#64748b" }}>/ 100</span>
            </div>
            <div>
              <div style={{ fontWeight: 600, wordBreak: "break-all" }}>{result.finalUrl}</div>
              <div style={{ color: "#64748b", fontSize: 14, margin: "6px 0" }}>
                <span style={{ color: "#15803d" }}>✓ {result.totals.pass} ok</span>
                {"  ·  "}
                <span style={{ color: "#b45309" }}>! {result.totals.warn} avisos</span>
                {"  ·  "}
                <span style={{ color: "#b91c1c" }}>✕ {result.totals.fail} falhas</span>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                {result.stats.images} imagens · {result.stats.links} links (
                {result.stats.internalLinks} internos, {result.stats.externalLinks} externos) ·{" "}
                {(result.stats.htmlBytes / 1024).toFixed(0)} KB
              </div>
            </div>
          </div>

          {result.categories.map((cat) => (
            <div key={cat.id} style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{cat.label}</h2>
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
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
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
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{check.label}</div>
                        <div style={{ color: "#475569", fontSize: 14 }}>{check.message}</div>
                        {check.details && check.details.length > 0 && (
                          <ul
                            style={{
                              margin: "8px 0 0",
                              paddingLeft: 18,
                              color: "#94a3b8",
                              fontSize: 13,
                              wordBreak: "break-all",
                            }}
                          >
                            {check.details.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
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
      )}
    </main>
  );
}
