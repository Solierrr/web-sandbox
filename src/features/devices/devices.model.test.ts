import { describe, expect, it } from "vitest";
import { normalizeFid, sortDevices, validateDevice } from "./devices.model";

const fid = "cXbq7LmPQe2FhZk1aBcDeF";

describe("devices.model", () => {
  it("accepts a well formed installation id and label", () => {
    expect(validateDevice({ fid, label: "Pixel do Davi" })).toBeNull();
  });

  it("trims the installation id before validating", () => {
    expect(normalizeFid(`  ${fid}\n`)).toBe(fid);
    expect(validateDevice({ fid: ` ${fid} `, label: "Pixel" })).toBeNull();
  });

  it("rejects ids with the wrong size or characters", () => {
    expect(validateDevice({ fid: "curto", label: "Pixel" })).toMatch(/22 caracteres/);
    expect(validateDevice({ fid: `${fid.slice(0, 21)}!`, label: "Pixel" })).toMatch(/22 caracteres/);
  });

  it("requires a reasonable label", () => {
    expect(validateDevice({ fid, label: "a" })).toMatch(/apelido/);
    expect(validateDevice({ fid, label: "x".repeat(61) })).toMatch(/máximo/);
  });

  it("sorts devices by label", () => {
    const sorted = sortDevices([
      { fid: "b", label: "Zebra", authorized: true },
      { fid: "a", label: "Alfa", authorized: false },
    ]);
    expect(sorted.map((device) => device.label)).toEqual(["Alfa", "Zebra"]);
  });
});
