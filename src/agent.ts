import { nextClient } from "./llm.js";
import { tools, toolDeclarations, type ToolContext } from "./tools.js";

export type Decision = {
  turn: number;
  tool_name: string;
  args: Record<string, any>;
  result: string;
  timestamp: number;
};

export type RunAgentOpts = {
  userPrompt: string;
  cwd: string;
  systemInstruction?: string;
  maxTurns?: number;
  model?: string;
  onDecision?: (d: Decision) => void;
};

export async function runAgent(opts: RunAgentOpts): Promise<Decision[]> {
  const {
    userPrompt,
    cwd,
    systemInstruction,
    maxTurns = 30,
    model = "gemini-2.5-flash",
    onDecision,
  } = opts;

  const ai = nextClient();
  const ctx: ToolContext = { cwd };
  const decisions: Decision[] = [];

  // Conversation history: array of Content parts
  const contents: any[] = [
    { role: "user", parts: [{ text: userPrompt }] },
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) break;

    let hadToolCall = false;
    // Append model response to history first
    contents.push(candidate.content);

    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        hadToolCall = true;
        const fc = part.functionCall;
        const name = fc.name!;
        const args = (fc.args ?? {}) as Record<string, any>;

        let result: string;
        try {
          const fn = tools[name];
          if (!fn) throw new Error(`Unknown tool: ${name}`);
          result = fn(args, ctx);
        } catch (e: any) {
          result = `ERROR: ${e?.message ?? e}`;
        }

        const decision: Decision = {
          turn,
          tool_name: name,
          args,
          result: result.slice(0, 1000),
          timestamp: Date.now(),
        };
        decisions.push(decision);
        onDecision?.(decision);

        // Append tool response back
        contents.push({
          role: "user",
          parts: [{
            functionResponse: {
              name,
              response: { result },
            },
          }],
        });
      }
    }

    if (!hadToolCall) {
      // Text-only reply = agent done
      break;
    }
  }

  return decisions;
}
