/**
 * Validates a Brazilian CPF number (check digits algorithm)
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  // Reject all-same-digit CPFs
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;

  return true;
}

/** Mask CPF for display: ***.***.XXX-XX */
export function maskCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `***.***. ${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

/** Convert CPF to internal email for Supabase Auth */
export function cpfToInternalEmail(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  return `${cleaned}@orbis.internal`;
}
