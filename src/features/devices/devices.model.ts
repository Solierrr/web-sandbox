export interface QaDevice {
  fid: string;
  label: string;
  authorized: boolean;
  updatedAt?: string;
}

export const FID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function normalizeFid(value: string): string {
  return value.trim();
}

export function validateDevice(input: { fid: string; label: string }): string | null {
  const fid = normalizeFid(input.fid);
  if (!FID_PATTERN.test(fid)) {
    return "O FID deve ter 22 caracteres (letras, números, _ ou -).";
  }
  if (input.label.trim().length < 2) {
    return "Informe um apelido com pelo menos 2 caracteres.";
  }
  if (input.label.trim().length > 60) {
    return "O apelido deve ter no máximo 60 caracteres.";
  }
  return null;
}

export function sortDevices(devices: QaDevice[]): QaDevice[] {
  return [...devices].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
