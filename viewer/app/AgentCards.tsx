"use client";

import { useEffect, useState } from "react";

export type AgentCard = {
  name: string;
  task: string;
  vendor: string;
  status: "done" | "running" | "failed";
  decisions: number;
  duration: string;
  isOurDemo?: boolean;
};

const FAKE_AGENTS: AgentCard[] = [
  {
    name: "Agent A",
    task: "refactor auth middleware",
    vendor: "Claude Code",
    status: "done",
    decisions: 18,
    duration: "3m 22s",
  },
  {
    name: "Agent B",
    task: "add JWT refresh logic",
    vendor: "Codex CLI",
    status: "running",
    decisions: 12,
    duration: "1m 47s",
  },
  {
    name: "Agent C",
    task: "fix typo in README",
    vendor: "Gemini CLI",
    status: "done",
    decisions: 4,
    duration: "0m 45s",
  },
  {
    name: "Agent D",
    task: "fix sort_unique bug",
    vendor: "Claude Code",
    status: "failed",
    decisions: 6,
    duration: "2m 18s",
    isOurDemo: true,
  },
];

const STATUS_STYLE: Record<AgentCard["status"], { bg: string; border: string; badge: string; emoji: string }> = {
  done: { bg: "#0d1117", border: "#3fb950", badge: "#1a3d20", emoji: "✅" },
  running: { bg: "#0d1117", border: "#f0883e", badge: "#3a2d10", emoji: "🟡" },
  failed: { bg: "#1a0e0e", border: "#f97583", badge: "#5a1a1a", emoji: "❌" },
};

export default function AgentCards({ onBisectClick }: { onBisectClick: () => void }) {
  // Tick the "running" agent's decision counter to give it life.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      style={{
        marginBottom: 24,
        padding: 16,
        background: "#0d1117",
        border: "1px solid #30363d",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, color: "#8b949e", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          📊 Today's agent runs (4 active)
        </h2>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          (4 카드 = visual context. Agent D 만 우리 cmux-bisect 의 진짜 demo data)
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        {FAKE_AGENTS.map((agent) => {
          const style = STATUS_STYLE[agent.status];
          const liveDecisions = agent.status === "running" ? agent.decisions + tick : agent.decisions;
          return (
            <div
              key={agent.name}
              style={{
                padding: 14,
                background: agent.isOurDemo ? "#1a0e0e" : style.bg,
                border: agent.isOurDemo ? "2px solid #f97583" : `1px solid ${style.border}`,
                borderRadius: 10,
                position: "relative",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "#e6edf3" }}>
                  {agent.name}
                </span>
                <span style={{ fontSize: 16 }}>{style.emoji}</span>
              </div>
              <div style={{ fontSize: 12, color: "#c9d1d9", marginBottom: 8, minHeight: 30 }}>{agent.task}</div>
              <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#8b949e", marginBottom: 8 }}>
                <span>{agent.vendor}</span>
                <span>·</span>
                <span className="mono">{liveDecisions} dec</span>
                <span>·</span>
                <span className="mono">{agent.duration}</span>
              </div>

              {agent.isOurDemo && (
                <button
                  onClick={onBisectClick}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "linear-gradient(180deg, #f0883e, #d97a30)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🔍 bisect this run
                </button>
              )}

              {agent.status === "running" && (
                <div
                  style={{
                    width: "100%",
                    height: 4,
                    background: "#1a1f2a",
                    borderRadius: 2,
                    overflow: "hidden",
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "linear-gradient(90deg, transparent, #f0883e, transparent)",
                      animation: "shimmer 1.5s infinite",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
}
