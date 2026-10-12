/* WhatsApp: a MESMA regra do banco (public.telefone_valido, gatilho profiles_valida_identidade).
   Se o app aceitar e o banco recusar, a conta nasce sem perfil: sem teste, sem onboarding
   (23 contas assim entre 22/09 e 10/10 — quase todas com número de 10 dígitos, sem o 9). */
export function telefoneNormalizado(t: string): string {
  let d = (t || "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

const FALSOS = new Set(["912345678", "987654321", "912345679", "900000000"]);

/** Celular brasileiro: DDD (11–99) + 9 + 8 dígitos, sem número de mentira. */
export function telefoneValido(t: string): boolean {
  const d = telefoneNormalizado(t);
  if (d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d[2] !== "9") return false;
  const num = d.slice(2);
  if (/^(\d)\1+$/.test(num) || FALSOS.has(num)) return false;
  return true;
}
