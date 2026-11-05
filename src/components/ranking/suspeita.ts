/** Short reason for the admin chip: "pico de 2.1x acima da média dele" → "pico 2,1x". */
export function rotuloSuspeita(motivo: string): string {
  const pico = /pico de ([\d.]+)x/.exec(motivo);
  if (pico) return `pico ${pico[1]!.replace(".", ",")}x`;
  if (motivo.startsWith("conta nova")) return "conta nova";
  return "revisar";
}
