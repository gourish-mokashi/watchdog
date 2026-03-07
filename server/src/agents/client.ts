import { groq } from '@ai-sdk/groq';
import { aisdk } from "@openai/agents-extensions";

const modelId = "groq/compound";
const model = aisdk(groq(modelId));

export default model;
