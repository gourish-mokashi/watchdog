import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { aisdk } from "@openai/agents-extensions";

const gatewayApiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_KEY;
if (!gatewayApiKey) {
  throw new Error("Missing AI_GATEWAY_API_KEY (or VERCEL_KEY) for Vercel AI Gateway");
}

const gateway = createOpenAICompatible({
  name: "vercel-ai-gateway",
  apiKey: gatewayApiKey,
  baseURL: process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1",
});

const modelId = process.env.AI_GATEWAY_MODEL ?? "anthropic/claude-sonnet-4.5";
const model = aisdk(gateway.chatModel(modelId));

export default model;
