export default {
  service: "codex",
  allowMultipleKeys: true,
  browserAuth: true,
  delegates: [
    { name: "claude", use: "@anthropic-ai/sdk" },
    { name: "gemini", use: "@google/generative-ai" }
  ]
};