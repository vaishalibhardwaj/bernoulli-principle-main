// Fake API with artificial latency + occasional network error (for demo).
export function latency(min = 300, max = 600) {
  return new Promise((res) => setTimeout(res, min + Math.random() * (max - min)));
}

let errorBudget = 0;
// ~1 in 12 calls fails once, to showcase the Retry pattern (never on the same call twice)
export async function fakeFetch(fn, { canFail = false } = {}) {
  await latency();
  if (canFail && errorBudget <= 0 && Math.random() < 0.08) {
    errorBudget = 1;
    throw new Error("Network error");
  }
  errorBudget = 0;
  return fn ? fn() : undefined;
}
