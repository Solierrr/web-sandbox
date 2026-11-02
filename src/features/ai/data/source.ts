import { messengerSource } from "./http";
import { mockSource } from "./mock";
import type { AiDataSource } from "./types";

export function getDataSource(): AiDataSource {
  return import.meta.env.DEV && import.meta.env.VITE_MOCKS === "ALWAYS" ? mockSource : messengerSource;
}
