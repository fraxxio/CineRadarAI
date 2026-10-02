export function formatCurrency(amount: number) {
  if (amount >= 1e9) {
    return "$" + (amount / 1e9).toFixed(1) + "B";
  }
  if (amount >= 1e6) {
    return "$" + (amount / 1e6).toFixed(1) + "M";
  }
  if (amount >= 1e3) {
    return "$" + (amount / 1e3).toFixed(1) + "k";
  }
  return "$" + amount.toString();
}
