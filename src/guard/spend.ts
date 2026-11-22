/** Per-process budget of task submissions (ADR 0002). Rejections never change the remaining count. */
export interface SpendGuard {
  remaining(): number;
  /** Reserves `n` submissions if the budget allows. */
  reserve(n: number): { ok: true; remaining: number } | { ok: false; remaining: number };
  /** Gives back a reservation that was certainly not submitted. */
  refund(n: number): void;
}

export function createSpendGuard(budget: number): SpendGuard {
  let used = 0;
  return {
    remaining: () => budget - used,
    reserve(n) {
      if (n > budget - used) return { ok: false, remaining: budget - used };
      used += n;
      return { ok: true, remaining: budget - used };
    },
    refund(n) {
      used = Math.max(0, used - n);
    },
  };
}
