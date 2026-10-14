import type { Prisma } from "@prisma/client";

export class RejectedBusinessResult extends Error {
  constructor(public readonly result: unknown) { super("Business command rejected"); }
}

type Outcome = { kind: "RETURN"; value: Prisma.InputJsonValue } | { kind: "REDIRECT"; digest: string };
const sensitiveKey = /password|secret|token|csrf|verifier|fileData|bytes/i;

/** Receipts contain only the action's successful response, never its submitted form. */
export function actionOutcome(value: unknown): Outcome {
  if (value && typeof value === "object" && "error" in value && value.error) throw new RejectedBusinessResult(value);
  const encode = (item: unknown, depth = 0): Prisma.InputJsonValue => {
    if (depth > 15) throw new Error("Action result too deeply nested");
    if (item === undefined) return { $covex: "undefined" };
    if (item === null) return { $covex: "null" };
    if (item instanceof Date) return { $covex: "date", value: item.toISOString() };
    if (typeof item === "string" || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item)) return item;
    if (Array.isArray(item)) return item.map(v => encode(v, depth + 1));
    if (item && typeof item === "object" && Object.getPrototypeOf(item) === Object.prototype) {
      if ("$covex" in item) throw new Error("Reserved action result key");
      const result: Record<string, Prisma.InputJsonValue> = {};
      for (const [key, field] of Object.entries(item)) {
        if (sensitiveKey.test(key)) throw new Error("Sensitive action response cannot be retained");
        result[key] = encode(field, depth + 1);
      }
      return result;
    }
    throw new Error("Unsupported action response");
  };
  const outcome: Outcome = { kind: "RETURN", value: encode(value) };
  if (JSON.stringify(outcome).length > 65536) throw new Error("Action response too large");
  return outcome;
}

export function redirectOutcome(error: unknown): Outcome | null {
  if (!(error instanceof Error) || !("digest" in error) || typeof error.digest !== "string") return null;
  const match = /^NEXT_REDIRECT;(push|replace);([^\r\n]*);(303|307|308);$/.exec(error.digest);
  // Action redirects are local application navigation, not arbitrary external URLs.
  if (!match || !match[2].startsWith("/") || match[2].startsWith("//")) return null;
  return { kind: "REDIRECT", digest: error.digest };
}

export function replayActionOutcome(outcome: unknown): unknown {
  if (!outcome || typeof outcome !== "object" || !("kind" in outcome)) throw new Error("Missing command response");
  if (outcome.kind === "REDIRECT" && "digest" in outcome && typeof outcome.digest === "string") {
    const error = Object.assign(new Error("NEXT_REDIRECT"), { digest: outcome.digest });
    if (!redirectOutcome(error)) throw new Error("Invalid command redirect");
    throw error;
  }
  if (outcome.kind !== "RETURN" || !("value" in outcome)) throw new Error("Invalid command response");
  const decode = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === "object") {
      if ("$covex" in value) {
        if (value.$covex === "undefined") return undefined;
        if (value.$covex === "null") return null;
        if (value.$covex === "date" && "value" in value && typeof value.value === "string") return new Date(value.value);
        throw new Error("Invalid typed response");
      }
      return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, decode(field)]));
    }
    return value;
  };
  return decode(outcome.value);
}
