// Serve o Radar de Lojas: lê os pedaços do banco, descompacta e entrega o HTML.
// Sem cache em memória: atualizar a tabela radar_asset atualiza o site na hora.
async function load(): Promise<string> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(url + "/rest/v1/radar_asset?select=id,chunk&order=id.asc", {
    headers: { apikey: key, Authorization: "Bearer " + key }
  });
  if (!r.ok) throw new Error("DB " + r.status);
  const rows: { id: number; chunk: string }[] = await r.json();
  const b64 = rows.map((x) => x.chunk).join("");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
  ).text();
}

Deno.serve(async () => {
  try {
    const html = await load();
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    return new Response("Erro ao montar a página: " + String(e), { status: 500 });
  }
});
