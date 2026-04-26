"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";

type Decision = {
  decision_id: number;
  turn: number;
  tool_name: string;
  args_json: string;
  result?: string;
};

type Status = {
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
  updated_at: number;
  // Optional: full decision lists if dumped alongside
  good_decisions?: Decision[];
  bad_decisions?: Decision[];
};

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));

export default function Home() {
  const { data: status, error } = useSWR<Status | null>(
    "/demo-status.json",
    fetcher,
    { refreshInterval: 1000, fallbackData: null }
  );

  if (error) {
    return (
      <main style={{ padding: 48 }}>
        <h1>cmux-bisect viewer</h1>
        <p style={{ color: "#f97583" }}>Failed to load status.</p>
      </main>
    );
  }

  if (!status) {
    return (
      <main style={{ padding: 48 }}>
        <Header />
        <Empty />
      </main>
    );
  }

  return (
    <main style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <Header />
      <SummaryBar status={status} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr 1fr",
          gap: 16,
          marginTop: 24,
        }}
      >
        <Timeline
          title="✅ GOOD"
          color="#3fb950"
          decisions={status.good_decisions ?? []}
          highlight={null}
        />
        <BisectProgress status={status} />
        <Timeline
          title="❌ BAD"
          color="#f97583"
          decisions={status.bad_decisions ?? []}
          highlight={status.current_midpoint}
          range={[status.current_lo, status.current_hi]}
          firstBad={status.first_bad_decision_id}
        />
      </div>
      {status.phase === "done" && (
        <ResultCard status={status} />
      )}
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
        git bisect for AI agent decisions — localize the first bad tool call in log₂(N) trials
      </p>
    </header>
  );
}

function Empty() {
  return (
    <div
      style={{
        marginTop: 48,
        padding: 32,
        background: "#0d1117",
        border: "1px dashed #30363d",
        borderRadius: 12,
        textAlign: "center",
      }}
    >
      <p style={{ color: "#8b949e", fontSize: 16 }}>
        No bisection in progress. Run:
      </p>
      <pre
        className="mono"
        style={{
          marginTop: 16,
          background: "#161b22",
          padding: 16,
          borderRadius: 8,
          fontSize: 13,
          textAlign: "left",
          overflowX: "auto",
        }}
      >
{`source ~/.config/cmux-bisect/env
npx tsx src/cli.ts bisect \\
  --good GOOD --bad BAD \\
  --repo ./tmp-demo/sort-bug \\
  --prompt "Fix src/sortlib.py" \\
  --oracle "python3 -m unittest discover tests/" \\
  --trials 3`}
      </pre>
      <p style={{ color: "#8b949e", marginTop: 16, fontSize: 13 }}>
        The CLI writes to <code className="mono">viewer/public/demo-status.json</code> as it runs.
      </p>
    </div>
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

function Stat({
  label,
  value,
  color = "#e6edf3",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
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
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #30363d",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h2 style={{ fontSize: 14, color, marginBottom: 12, fontWeight: 700 }}>{title}</h2>
      {decisions.length === 0 && (
        <p style={{ color: "#8b949e", fontSize: 13 }}>(no decisions captured)</p>
      )}
      {decisions.map((d) => {
        const inRange =
          range && d.decision_id >= range[0] && d.decision_id <= range[1];
        const isMid = highlight === d.decision_id;
        const isFirstBad = firstBad === d.decision_id;
        return (
          <div
            key={d.decision_id}
            style={{
              padding: "8px 10px",
              marginBottom: 4,
              borderRadius: 6,
              background: isFirstBad
                ? "#5a1a1a"
                : isMid
                ? "#3a2d10"
                : inRange
                ? "#1a1f2a"
                : "#0d1117",
              border: isFirstBad
                ? "2px solid #f97583"
                : isMid
                ? "2px solid #f0883e"
                : "1px solid transparent",
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
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #30363d",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h2 style={{ fontSize: 14, color: "#f0883e", marginBottom: 12, fontWeight: 700 }}>
        🔍 BISECTION
      </h2>

      {status.phase === "trial" && (
        <>
          <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}>
            Round {status.current_round}: testing midpoint
          </p>
          <div
            className="mono"
            style={{
              fontSize: 24,
              color: "#f0883e",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            #{status.current_midpoint}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>
              K trials (majority vote)
            </div>
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
                    background:
                      v === "good"
                        ? "#1a3d20"
                        : v === "bad"
                        ? "#5a1a1a"
                        : "#1a1f2a",
                    color:
                      v === "good"
                        ? "#3fb950"
                        : v === "bad"
                        ? "#f97583"
                        : "#8b949e",
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
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>
          history
        </div>
        {status.history.length === 0 && (
          <div style={{ color: "#8b949e", fontSize: 12 }}>(no rounds completed)</div>
        )}
        {status.history.map((h) => (
          <div
            key={h.round}
            className="mono"
            style={{
              fontSize: 12,
              color: h.passed ? "#3fb950" : "#f97583",
              marginBottom: 2,
            }}
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
