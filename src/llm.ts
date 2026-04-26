import { GoogleGenAI } from "@google/genai";

let _keys: string[] | null = null;

function loadKeys(): string[] {
  if (_keys) return _keys;
  const keys: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  if (keys.length === 0 && process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }
  if (keys.length === 0) {
    throw new Error(
      "No GEMINI_API_KEY_N found. Source ~/.config/cmux-bisect/env first."
    );
  }
  _keys = keys;
  return keys;
}

let cursor = 0;
export function nextClient(): GoogleGenAI {
  const keys = loadKeys();
  const key = keys[cursor % keys.length];
  cursor++;
  return new GoogleGenAI({ apiKey: key });
}

export function keyCount(): number {
  try {
    return loadKeys().length;
  } catch {
    return 0;
  }
}
