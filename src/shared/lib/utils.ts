import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    // Sempre 2 casas (padrao BRL). Antes era 0-2, entao R$100 aparecia sem centavos
    // e R$100,50 com — inconsistente numa tela de dinheiro.
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
