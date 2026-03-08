import { createOllama } from "ai-sdk-ollama"
import { aisdk } from "@openai/agents-extensions";
const modelId = "minimax-m2.5:cloud";

const ollama  = createOllama({
  apiKey: "ollama",
  baseURL: "http://localhost:11434",
});

const model = aisdk(ollama(modelId));

export default model;
