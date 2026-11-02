export const usd = (value: number) => `US$ ${value.toFixed(value < 1 ? 4 : 2)}`;
export const tokens = (value: number) => value.toLocaleString("pt-BR");
export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);
