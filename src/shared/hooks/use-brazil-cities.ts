import { useEffect, useState } from "react";

const cache = new Map<string, string[]>();

export function useBrazilCities(uf: string) {
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uf) {
      setCities([]);
      return;
    }
    if (cache.has(uf)) {
      setCities(cache.get(uf)!);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
      { signal: ctrl.signal }
    )
      .then((r) => r.json())
      .then((data: Array<{ nome: string }>) => {
        const names = data.map((c) => c.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
        cache.set(uf, names);
        setCities(names);
      })
      .catch(() => setCities([]))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [uf]);

  return { cities, loading };
}
