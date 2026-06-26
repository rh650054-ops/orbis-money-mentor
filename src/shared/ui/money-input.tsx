import * as React from "react";
import { Input } from "@/shared/ui/input";

/**
 * Campo de valor em Real (R$) com máscara brasileira em tempo real.
 *
 * - decimals=2 (padrão): estilo banco/iFood. Digita só números e os 2 últimos viram
 *   centavos. Ex.: "450" -> R$ 4,50 ; "3000000" -> R$ 30.000,00.
 * - decimals=0: reais inteiros (ex.: metas). Digita "30000" -> 30.000 (sem centavos).
 *
 * Sempre devolve um NÚMERO em reais no onChange. Aceita só dígitos, então o bug do
 * "ponto de milhar" (4.200 virar 4,2) não acontece mais.
 */
interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  decimals?: 0 | 2;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

function format(n: number, decimals: number): string {
  if (!n) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function MoneyInput({
  value,
  onChange,
  decimals = 2,
  placeholder,
  className,
  id,
  disabled,
  autoFocus,
  onKeyDown,
}: MoneyInputProps) {
  const display = format(value || 0, decimals);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      onChange(0);
      return;
    }
    const n = parseInt(digits, 10);
    onChange(decimals === 2 ? n / 100 : n);
  };

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? (decimals === 2 ? "0,00" : "0")}
      className={className}
      disabled={disabled}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
    />
  );
}
