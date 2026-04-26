"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import AgentCards from "./AgentCards";
import { useAnimatedPlayer, buildLiveStatus } from "./AnimatedBisect";

export type Decision = {
  decision_id: number;
  turn: number;
  tool_name: string;
  args_json: string;
  result?: string;
};

export type Status = {
  phase: "starting" | "trial" | "round_done" | "done" | "error";
  good_run_id: string;
  bad_run_id: string;
  divergence_turn: number;
  total_decisions_in_bad: number;
  total_rounds_estimate: number;
  current_round: number;
  current_lo: number;
  current_hi: number;
  current_midpoint: number;
  trial_votes: ("good" | "bad" | "pending")[];
  history: { round: number; midpoint: number; passed: boolean }[];
  first_bad_decision_id?: number;
  first_bad_summary?: string;
  rounds_used?: number;
  good_decisions?: Decision[];
  bad_decisions?: Decision[];
  user_prompt?: string;
  oracle_cmd?: string;
  updated_at: number;
};

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));

export default function Viewer({ initialData }: { initialData: Status }) {
  // SWR with initial data from server — never null, never shows empty state.
  // For local CLI runs, this picks up fresh writes to demo-status.json.
  const { data: fetched } = useSWR<Status>("/demo-status.json", fetcher, {
    fallbackData: initialData,
    refreshInterval: 2000,
  });

  const baseStatus = fetched ?? initialData;

  // Replay the bisection visually. nonce changes → restart from scratch.
  const [nonce, setNonce] = useState(0);
  const player = useAnimatedPlayer(baseStatus, nonce, /* autoLoop */ true);
  const liveStatus = buildLiveStatus(baseStatus, player);

  // Auto-start the animation on mount (small delay so user sees initial layout first).
  useEffect(() => {
    const t = setTimeout(() => setNonce((n) => n + 1), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <Header />
      <AgentCards onBisectClick={() => setNonce((n) => n + 1)} />
      <SummaryBar status={liveStatus} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr 1fr",
          gap: 16,
          marginTop: 24,
        }}
      >
        <Timeline title="✅ GOOD" color="#3fb950" decisions={liveStatus.good_decisions ?? []} highlight={null} />
        <BisectProgress status={liveStatus} />
        <Timeline
          title="❌ BAD (Agent D's run)"
          color="#f97583"
          decisions={liveStatus.bad_decisions ?? []}
          highlight={liveStatus.current_midpoint}
          range={[liveStatus.current_lo, liveStatus.current_hi]}
          firstBad={liveStatus.first_bad_decision_id}
        />
      </div>
      {liveStatus.phase === "done" && <ResultCard status={liveStatus} />}

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <button
          onClick={() => setNonce((n) => n + 1)}
          style={{
            padding: "10px 20px",
            background: "#1f6feb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ▶ Replay bisection
        </button>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>
        cmux-bisect <span style={{ color: "#8b949e", fontWeight: 400 }}>· live viewer</span>
      </h1>
      <p style={{ color: "#8b949e", marginTop: 4 }}>
        AI 에이전트의 결정 트리에 git bisect 적용 — log₂(N) 시도로 첫 번째 잘못된 tool call 찾기
      </p>
      <p style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
        <a href="https://github.com/mrjunejeong/cmux-bisect" style={{ marginRight: 12 }}>
          GitHub
        </a>
        ·
        <span style={{ marginLeft: 12 }}>MIT · Built for the 2026-04-26 모나코스페이스 hackathon</span>
      </p>
    </header>
  );
}

function SummaryBar({ status }: { status: Status }) {
  const phaseColor = {
    starting: "#79b8ff",
    trial: "#f0883e",
    round_done: "#79b8ff",
    done: "#3fb950",
    error: "#f97583",
  }[status.phase];

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        padding: 16,
        background: "#0d1117",
        borderRadius: 12,
        border: "1px solid #30363d",
        flexWrap: "wrap",
      }}
    >
      <Stat label="phase" value={status.phase} color={phaseColor} />
      <Stat label="round" value={`${status.current_round} / ${status.total_rounds_estimate}`} />
      <Stat label="range" value={`[${status.current_lo}, ${status.current_hi}]`} />
      <Stat label="bad len" value={String(status.total_decisions_in_bad)} />
      <Stat label="divergence" value={`#${status.divergence_turn}`} />
      {status.rounds_used !== undefined && (
        <Stat label="rounds used" value={String(status.rounds_used)} color="#3fb950" />
      )}
    </div>
  );
}

function Stat({ label, value, color = "#e6edf3" }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 600, color, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function Timeline({
  title,
  color,
  decisions,
  highlight,
  range,
  firstBad,
}: {
  title: string;
  color: string;
  decisions: Decision[];
  highlight: number | null;
  range?: [number, number];
  firstBad?: number;
}) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: 14, color, marginBottom: 12, fontWeight: 700 }}>{title}</h2>
      {decisions.length === 0 && <p style={{ color: "#8b949e", fontSize: 13 }}>(no decisions captured)</p>}
      {decisions.map((d) => {
        const inRange = range && d.decision_id >= range[0] && d.decision_id <= range[1];
        const isMid = highlight === d.decision_id;
        const isFirstBad = firstBad === d.decision_id;
        return (
          <div
            key={d.decision_id}
            style={{
              padding: "8px 10px",
              marginBottom: 4,
              borderRadius: 6,
              background: isFirstBad ? "#5a1a1a" : isMid ? "#3a2d10" : inRange ? "#1a1f2a" : "#0d1117",
              border: isFirstBad ? "2px solid #f97583" : isMid ? "2px solid #f0883e" : "1px solid transparent",
              fontSize: 12,
            }}
            className="mono"
          >
            <span style={{ color: "#8b949e" }}>#{d.decision_id}</span>{" "}
            <span style={{ color: "#79b8ff" }}>{d.tool_name}</span>
            <div
              style={{
                color: "#8b949e",
                fontSize: 11,
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {d.args_json}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BisectProgress({ status }: { status: Status }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: 14, color: "#f0883e", marginBottom: 12, fontWeight: 700 }}>🔍 BISECTION</h2>

      {status.phase === "trial" && (
        <>
          <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}>
            Round {status.current_round}: testing midpoint
          </p>
          <div className="mono" style={{ fontSize: 24, color: "#f0883e", fontWeight: 700, marginBottom: 16 }}>
            #{status.current_midpoint}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>K trials (majority vote)</div>
            <div style={{ display: "flex", gap: 6 }}>
              {status.trial_votes.map((v, i) => (
                <div
                  key={i}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    background: v === "good" ? "#1a3d20" : v === "bad" ? "#5a1a1a" : "#1a1f2a",
                    color: v === "good" ? "#3fb950" : v === "bad" ? "#f97583" : "#8b949e",
                    border: "1px solid #30363d",
                  }}
                >
                  {v === "good" ? "✓" : v === "bad" ? "✗" : "·"}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>history</div>
        {status.history.length === 0 && <div style={{ color: "#8b949e", fontSize: 12 }}>(no rounds completed)</div>}
        {status.history.map((h) => (
          <div
            key={h.round}
            className="mono"
            style={{ fontSize: 12, color: h.passed ? "#3fb950" : "#f97583", marginBottom: 2 }}
          >
            R{h.round}: #{h.midpoint} → {h.passed ? "PASS" : "FAIL"}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ status }: { status: Status }) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: 24,
        background: "linear-gradient(180deg, #1a3d20, #0d1117)",
        border: "2px solid #3fb950",
        borderRadius: 12,
      }}
    >
      <h2 style={{ fontSize: 18, color: "#3fb950", fontWeight: 700, marginBottom: 8 }}>
        🎯 First bad decision found
      </h2>
      <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
        #{status.first_bad_decision_id}
      </div>
      <div className="mono" style={{ fontSize: 13, color: "#c9d1d9", whiteSpace: "pre-wrap" }}>
        {status.first_bad_summary}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: "#8b949e" }}>
        Localized in <strong>{status.rounds_used}</strong> rounds (would take ~{status.total_decisions_in_bad} trials linearly)
      </div>
    </div>
  );
}
