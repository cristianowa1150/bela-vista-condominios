/** Arredonda para 2 casas decimais — valores monetários gravados ou expostos. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
