/** Đồng, grouped, with the symbol trailing as it is written in Vietnam. */
export const dong = (n: number) =>
  `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('en-US')} ₫`
