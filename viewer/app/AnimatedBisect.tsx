"use client";

import { useEffect, useRef, useState } from "react";
import type { Status } from "./Viewer";

/**
 * Plays back a frozen Status as if it were running live.
 * Walks through each round + each trial vote with timed transitions.
 *
 * Why this exists: the viewer used to render the final state immediately,
 * which felt static. Animated playback gives the audience a sense of the
 * binary search actually narrowing the range — watching it work, not just
 * seeing the answer.
 */

const TRIAL_MS = 700;       // each trial vote tick
const ROUND_PAUSE_MS = 1000; // pause between rounds
const FINAL_HOLD_MS = 6000;  // hold the result before optional reset

export type PlayerState = {
  phase: Status["phase"];
  current_round: number;
  current_lo: number;
  current_hi: number;
  current_midpoint: number;
  trial_votes: ("good" | "bad" | "pending")[];
  history: { round: number; midpoint: number; passed: boolean }[];
  first_bad_decision_id?: number;
  first_bad_summary?: string;
  rounds_used?: number;
};

export function buildLiveStatus(staticStatus: Status, player: PlayerState): Status {
  return {
    ...staticStatus,
    phase: player.phase,
    current_round: player.current_round,
    current_lo: player.current_lo,
    current_hi: player.current_hi,
    current_midpoint: player.current_midpoint,
    trial_votes: player.trial_votes,
    history: player.history,
    first_bad_decision_id: player.first_bad_decision_id,
    first_bad_summary: player.first_bad_summary,
    rounds_used: player.rounds_used,
    updated_at: Date.now(),
  };
}

const initialPlayer = (s: Status): PlayerState => ({
  phase: "starting",
  current_round: 0,
  current_lo: s.divergence_turn,
  current_hi: s.total_decisions_in_bad - 1,
  current_midpoint: -1,
  trial_votes: [],
  history: [],
});

/**
 * Hook: returns a live PlayerState that animates through staticStatus.history.
 * `nonce` change forces a restart from the beginning.
 */
export function useAnimatedPlayer(staticStatus: Status, nonce: number, autoLoop: boolean): PlayerState {
  const [player, setPlayer] = useState<PlayerState>(() => initialPlayer(staticStatus));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reset on nonce change.
    setPlayer(initialPlayer(staticStatus));

    const history = staticStatus.history;
    if (!history || history.length === 0) return;

    let cancelled = false;
    const queue: Array<() => void> = [];

    // Initial pause before round 1 starts.
    queue.push(() => {
      if (cancelled) return;
      // First round starts → walk through votes one by one, then commit.
      stepRound(0);
    });

    const stepRound = (idx: number) => {
      if (cancelled) return;
      const round = history[idx];
      const midpoint = round.midpoint;
      const passed = round.passed;
      // Two trials shown (matches CLI behavior with K=3 majority + early-stop)
      const numTrials = 2;
      let trialIdx = 0;

      // Set up the round (phase=trial, midpoint highlighted, votes pending)
      setPlayer((p) => ({
        ...p,
        phase: "trial",
        current_round: idx + 1,
        current_midpoint: midpoint,
        trial_votes: Array(numTrials).fill("pending"),
      }));

      const tickTrial = () => {
        if (cancelled) return;
        if (trialIdx >= numTrials) {
          // Round done: commit history, narrow range
          setPlayer((p) => {
            const newLo = passed ? midpoint + 1 : p.current_lo;
            const newHi = passed ? p.current_hi : midpoint;
            return {
              ...p,
              phase: "round_done",
              current_lo: newLo,
              current_hi: newHi,
              history: [...p.history, { round: idx + 1, midpoint, passed }],
            };
          });

          if (idx + 1 < history.length) {
            timerRef.current = setTimeout(() => stepRound(idx + 1), ROUND_PAUSE_MS);
          } else {
            // Final phase
            timerRef.current = setTimeout(() => {
              if (cancelled) return;
              setPlayer((p) => ({
                ...p,
                phase: "done",
                first_bad_decision_id: staticStatus.first_bad_decision_id,
                first_bad_summary: staticStatus.first_bad_summary,
                rounds_used: staticStatus.rounds_used,
              }));

              if (autoLoop) {
                timerRef.current = setTimeout(() => {
                  if (cancelled) return;
                  setPlayer(initialPlayer(staticStatus));
                  timerRef.current = setTimeout(() => stepRound(0), 1500);
                }, FINAL_HOLD_MS);
              }
            }, ROUND_PAUSE_MS);
          }
          return;
        }
        const verdict: "good" | "bad" = passed ? "good" : "bad";
        setPlayer((p) => {
          const votes = [...p.trial_votes];
          votes[trialIdx] = verdict;
          return { ...p, trial_votes: votes };
        });
        trialIdx++;
        timerRef.current = setTimeout(tickTrial, TRIAL_MS);
      };

      timerRef.current = setTimeout(tickTrial, TRIAL_MS);
    };

    // Kick off after a short pause so the user sees the initial state first.
    timerRef.current = setTimeout(() => queue.shift()?.(), 800);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, autoLoop]);

  return player;
}
