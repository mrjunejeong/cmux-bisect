import { execFileSync } from "node:child_process";

export type OracleResult = { passed: boolean; exitCode: number; output: string };

export function runOracle(
  cwd: string,
  cmd: string,
  timeoutMs: number = 60_000,
): OracleResult {
  try {
    const out = execFileSync("bash", ["-c", cmd], {
      cwd,
      timeout: timeoutMs,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { passed: true, exitCode: 0, output: out.slice(-1000) };
  } catch (e: any) {
    const stdout = (e.stdout || "").toString();
    const stderr = (e.stderr || "").toString();
    return {
      passed: false,
      exitCode: e.status ?? -1,
      output: (stdout + stderr).slice(-1000),
    };
  }
}
