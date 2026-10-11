// "YYYY-MM-DD" in UTC; the system prompt and the tools both use it, so the
// model and the tools agree on the date
export const today = (date = new Date()) => date.toISOString().slice(0, 10);
