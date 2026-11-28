// How this app tells the server it writes the DEFCON through the ledger (ADR 0001).
// supabase-js already sends "X-Client-Info: supabase-js-web/<version>". The key must be spelled
// exactly like that: a lower-case "x-client-info" is a second key in the same object, and the
// browser joins both into "supabase-js-web/2.76.0, vant-livro/2 supabase-js" (bug of build 31).
export const VANT_CLIENTE = "vant-livro/2 supabase-js";
export const CABECALHOS_VANT = { "X-Client-Info": VANT_CLIENTE } as const;
