export const GLOBAL_PROMPT_STORAGE_KEY = "agent-spaces:globalPrompt";
export const DEFAULT_GLOBAL_PROMPT = "结果使用中文回复";

export function readGlobalPrompt(): string {
  try {
    return localStorage.getItem(GLOBAL_PROMPT_STORAGE_KEY) ?? DEFAULT_GLOBAL_PROMPT;
  } catch {
    return DEFAULT_GLOBAL_PROMPT;
  }
}
