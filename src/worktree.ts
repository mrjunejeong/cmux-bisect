import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

export type Worktree = { path: string; branch: string; repo: string };

export function forkWorktree(repo: string, base: string = "HEAD"): Worktree {
  const id = randomBytes(4).toString("hex");
  const wtPath = mkdtempSync(join(tmpdir(), `cmux-bisect-${id}-`));
  const branch = `bisect-${id}`;
  execFileSync("git", ["worktree", "add", "-b", branch, wtPath, base], {
    cwd: repo,
    stdio: "pipe",
  });
  return { path: wtPath, branch, repo };
}

export function cleanupWorktree(wt: Worktree): void {
  try {
    execFileSync("git", ["worktree", "remove", "--force", wt.path], {
      cwd: wt.repo,
      stdio: "pipe",
    });
  } catch {
    /* best-effort */
  }
  try {
    execFileSync("git", ["branch", "-D", wt.branch], {
      cwd: wt.repo,
      stdio: "pipe",
    });
  } catch {
    /* best-effort */
  }
}
