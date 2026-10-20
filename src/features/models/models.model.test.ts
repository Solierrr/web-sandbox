import { describe, expect, it } from "vitest";
import { modelInput, parsePanelModels } from "./models.model";
const panel = {
  id: "panel",
  brand: "Solar",
  brandId: "018c0000-0000-7000-8000-000000000001",
  model: "550",
  productType: "PANEL",
  type: "MONOCRYSTALLINE",
  powerWp: 550,
  efficiency: 21,
  width: 1,
  length: 2,
  weight: 20,
};
describe("panel model contract", () => {
  it("ignores infrastructure before validating panel attributes", () => {
    expect(
      parsePanelModels([
        panel,
        {
          id: "infra",
          productType: "INFRASTRUCTURE",
          type: null,
          powerWp: null,
        },
      ]),
    ).toEqual([panel]);
  });
  it("rejects malformed panel responses", () => {
    expect(() => parsePanelModels([{ ...panel, powerWp: null }])).toThrow();
  });
  it("sends a registered brand id instead of a brand name", () => {
    const data = new FormData();
    for (const [key, value] of Object.entries(panel))
      data.set(key, String(value));
    const body = modelInput(data, panel.brandId, panel.type);
    expect(body.brandId).toBe(panel.brandId);
    expect(body.productType).toBe("PANEL");
    expect(body).not.toHaveProperty("brand");
    expect(() => modelInput(data, "", panel.type)).toThrow();
    data.set("efficiency", "101");
    expect(() => modelInput(data, panel.brandId, panel.type)).toThrow();
  });
});
