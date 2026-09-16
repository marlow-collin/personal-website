import { normalizeQuestionText } from "./import-validation.js";

const encoder = new TextEncoder();

export async function questionContentHash(text) {
  const normalized = normalizeQuestionText(text);
  const bytes = encoder.encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
