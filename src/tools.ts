import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Type } from "@google/genai";

export type ToolContext = { cwd: string };

export type ToolFn = (args: any, ctx: ToolContext) => string;

export const tools: Record<string, ToolFn> = {
  read_file: ({ path }, { cwd }) => {
    const full = join(cwd, path);
    const content = readFileSync(full, "utf-8");
    return content.length > 8000 ? content.slice(0, 8000) + "\n...[truncated]" : content;
  },

  write_file: ({ path, content }, { cwd }) => {
    const full = join(cwd, path);
    writeFileSync(full, content, "utf-8");
    return `wrote ${content.length} bytes to ${path}`;
  },

  bash: ({ cmd }, { cwd }) => {
    try {
      const out = execFileSync("bash", ["-c", cmd], {
        cwd,
        timeout: 30_000,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return `exit=0\nstdout: ${out.slice(0, 2000)}`;
    } catch (e: any) {
      const stdout = (e.stdout || "").toString().slice(0, 2000);
      const stderr = (e.stderr || "").toString().slice(0, 1000);
      return `exit=${e.status ?? "?"}\nstdout: ${stdout}\nstderr: ${stderr}`;
    }
  },
};

// Gemini function declarations (typed Schema)
export const toolDeclarations = [
  {
    name: "read_file",
    description: "Read a file's contents (max 8KB). Use to inspect source code or test output.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Relative path from working dir" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file (overwrites). Use to make code changes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING },
        content: { type: Type.STRING },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "bash",
    description: "Run a bash command (30s timeout). Use to run tests, list files, install deps.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        cmd: { type: Type.STRING },
      },
      required: ["cmd"],
    },
  },
];
