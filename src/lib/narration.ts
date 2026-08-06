import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function generateNarration(
  routeId: string,
  stopId: string,
  factors: string[],
  stopProbability: number,
  onTimeProbability: number,
  fullnessProbability: number
): Promise<string> {
  const factorStr = factors.length > 0 ? factors.join(", ") : "no special conditions";
  const prompt = `You are a concise Irish bus arrival predictor. In one plain sentence (max 20 words), tell a commuter what to expect for route ${routeId} at stop ${stopId}. Stop probability: ${Math.round(stopProbability * 100)}%, on time: ${Math.round(onTimeProbability * 100)}%, fullness: ${Math.round(fullnessProbability * 100)}%. Conditions: ${factorStr}.`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 80,
    messages: [{ role: "user", content: prompt }],
  });

  const block = msg.content[0];
  return block.type === "text" ? block.text.trim() : "";
}
