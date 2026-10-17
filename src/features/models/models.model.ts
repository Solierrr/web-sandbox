export interface Model {
  id: string;
  brand: string;
  brandId?: string | null;
  model: string;
  type: string;
  powerWp: number;
  efficiency: number;
  width: number;
  length: number;
  weight: number;
  status?: string;
  productType?: string;
}
export interface ModelInput {
  brandId: string;
  productType: "PANEL";
  model: string;
  type: string;
  powerWp: number;
  efficiency: number;
  width: number;
  length: number;
  weight: number;
}
export const measurements = [
  { name: "powerWp", label: "Potência (Wp)" },
  { name: "efficiency", label: "Eficiência (%)" },
  { name: "width", label: "Largura (m)" },
  { name: "length", label: "Comprimento (m)" },
  { name: "weight", label: "Peso (kg)" },
] as const;
function isModel(value: unknown): value is Model {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    ["id", "brand", "model", "type"].every(
      (key) => typeof item[key] === "string",
    ) &&
    measurements.every(
      ({ name }) =>
        typeof item[name] === "number" && Number.isFinite(item[name]),
    )
  );
}
export function parsePanelModels(value: unknown): Model[] {
  if (!Array.isArray(value))
    throw new Error(
      "O serviço retornou uma lista de modelos incompatível com o contrato.",
    );
  const panels = value.filter((item) => item?.productType !== "INFRASTRUCTURE");
  if (!panels.every(isModel))
    throw new Error(
      "O serviço retornou uma lista de modelos incompatível com o contrato.",
    );
  return panels;
}
export function modelInput(
  data: FormData,
  brandId: string,
  type: string,
): ModelInput {
  const body: ModelInput = {
    brandId,
    productType: "PANEL",
    model: String(data.get("model") || "").trim(),
    type,
    powerWp: Number(data.get("powerWp")),
    efficiency: Number(data.get("efficiency")),
    width: Number(data.get("width")),
    length: Number(data.get("length")),
    weight: Number(data.get("weight")),
  };
  if (
    !body.brandId ||
    !body.model ||
    body.efficiency > 100 ||
    measurements.some(
      ({ name }) => !Number.isFinite(body[name]) || body[name] <= 0,
    )
  )
    throw new Error(
      "Escolha uma marca cadastrada e preencha modelo e medidas positivas. A eficiência não pode ultrapassar 100%.",
    );
  return body;
}
