export type ActionFeedbackState = {
  error: string | null;
};

export const initialActionFeedbackState: ActionFeedbackState = { error: null };

export function userFacingActionError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message?.trim();
  if (!message) return fallback;
  if (/prisma|constraint|database|sql|stack|digest/i.test(message)) return fallback;
  return message;
}
