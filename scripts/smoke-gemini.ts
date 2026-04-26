import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY_1 not set. Source ~/.config/cmux-bisect/env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
console.log("Calling Gemini 2.5 Flash...");

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Reply with exactly: SMOKE TEST OK",
});

console.log("Response:", response.text);
console.log("✓ Gemini API works");
