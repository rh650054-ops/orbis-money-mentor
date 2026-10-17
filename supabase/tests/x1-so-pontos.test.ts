// @vitest-environment node
/* Runs the real migration 20261015090000_x1_so_pontos.sql on an in-memory
   Postgres (PGlite) with a minimal copy of the X1 tables, and checks the
   server-side guards: no money in new duels, no self-duel, result given once,
   no retroactive change, and no new deposit/withdraw/bet. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const MIGRACAO = readFileSync(resolve(__dirname, "../migrations/20261015090000_x1_so_pontos.sql"), "utf8");

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
const ESTRANHO = "00000000-0000-0000-0000-00000000000c";

const BASE = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  create or replace function public.is_orbis_admin() returns boolean language sql stable as
    $$ select auth.uid() = '${ADMIN}'::uuid $$;

  create table public.x1_challenges (
    id uuid primary key default gen_random_uuid(),
    challenger_id uuid not null, opponent_id uuid,
    status text not null default 'pending',
    stakes_amount numeric default 0, fee_amount numeric default 0, prize_amount numeric default 0,
    money_status text default 'none',
    winner_user_id uuid, challenger_score numeric, opponent_score numeric,
    scheduled_date date default current_date, last_proposed_by uuid
  );
  alter table public.x1_challenges enable row level security;
  create policy "x1 insert as challenger" on public.x1_challenges for insert with check (auth.uid() = challenger_id);
  create table public.x1_salas (
    id uuid primary key default gen_random_uuid(), dono uuid, status text default 'open',
    stakes_amount numeric default 0, fee_amount numeric default 0, pote numeric default 0
  );
  create table public.x1_wallets (user_id uuid primary key, balance numeric not null default 0);
  create table public.x1_wallet_transactions (
    id uuid primary key default gen_random_uuid(), user_id uuid, amount numeric, tipo text, x1_id uuid, notes text, created_by uuid
  );
  create table public.x1_deposit_requests (id uuid primary key default gen_random_uuid(), user_id uuid, valor numeric, status text);
  create table public.x1_withdraw_requests (id uuid primary key default gen_random_uuid(), user_id uuid, valor numeric, pix_key text, status text default 'pendente');
  create table public.x1_mp_payments (payment_id text primary key, user_id uuid, valor numeric, status text, credited_at timestamptz);

  -- same body as production
  create function public.x1_wallet_apply(p_user uuid, p_amount numeric, p_tipo text, p_x1 uuid, p_notes text, p_by uuid)
  returns void language plpgsql security definer as $$
  begin
    insert into public.x1_wallets (user_id, balance) values (p_user, 0) on conflict (user_id) do nothing;
    update public.x1_wallets set balance = balance + p_amount where user_id = p_user;
    if (select balance from public.x1_wallets where user_id = p_user) < 0 then raise exception 'saldo_insuficiente'; end if;
    insert into public.x1_wallet_transactions (user_id, amount, tipo, x1_id, notes, created_by)
    values (p_user, p_amount, p_tipo, p_x1, p_notes, p_by);
  end; $$;
  create function public.x1_mark_paid(p_id uuid) returns void language sql as $$ select $$;
  create function public.x1_set_proof(p_id uuid, p_url text) returns void language sql as $$ select $$;
  create function public.x1_request_withdraw(p_valor numeric, p_pix text, p_nome text) returns uuid language sql as $$ select null::uuid $$;

  -- legacy money that must survive the migration
  insert into public.x1_wallets values ('${A}', 1);
  insert into public.x1_challenges (id, challenger_id, opponent_id, status, stakes_amount, fee_amount, prize_amount, money_status)
  values ('11111111-1111-1111-1111-111111111111', '${A}', '${B}', 'pending', 20, 4, 36, 'awaiting_payment'),
         ('22222222-2222-2222-2222-222222222222', '${A}', '${B}', 'active', 20, 4, 36, 'secured');
  insert into public.x1_mp_payments values ('mp-antigo', '${A}', 30, 'aguardando', null);
`;

let db: PGlite;
const como = (uid: string | null) => db.exec(`select set_config('teste.uid', '${uid ?? ""}', false)`);
const falha = async (sql: string, trecho: string) => {
  await expect(db.exec(sql)).rejects.toThrow(trecho);
};
const duelo = async (extra = "") => {
  const r = await db.query<{ id: string }>(
    `insert into public.x1_challenges (challenger_id, opponent_id, status${extra ? ", " + extra.split("=")[0] : ""})
     values ('${A}', '${B}', 'pending'${extra ? ", " + extra.split("=")[1] : ""}) returning id`,
  );
  return r.rows[0]!.id;
};

beforeEach(async () => {
  db = new PGlite();
  await db.exec(BASE);
  await db.exec(MIGRACAO);
  await como(A);
});

describe("X1 só pontos — duelos", () => {
  it("ciclo completo sem dinheiro: cria, aceita, termina com vencedor", async () => {
    const id = await duelo();
    await db.exec(`update public.x1_challenges set status = 'active' where id = '${id}'`);
    await como(null); // cron x1_settle_due
    await db.exec(`update public.x1_challenges set status = 'finished', winner_user_id = '${A}',
      challenger_score = 300, opponent_score = 120 where id = '${id}' and status = 'active'`);
    const r = await db.query<{ status: string; winner_user_id: string }>(`select status, winner_user_id from public.x1_challenges where id = '${id}'`);
    expect(r.rows[0]).toEqual({ status: "finished", winner_user_id: A });
    const t = await db.query(`select 1 from public.x1_wallet_transactions`);
    expect(t.rows).toHaveLength(0);
  });

  it("bloqueia duelo novo valendo dinheiro (aposta, taxa ou prêmio)", async () => {
    await falha(`insert into public.x1_challenges (challenger_id, opponent_id, stakes_amount) values ('${A}', '${B}', 10)`, "x1_so_pontos");
    await falha(`insert into public.x1_challenges (challenger_id, opponent_id, prize_amount) values ('${A}', '${B}', 18)`, "x1_so_pontos");
    await falha(`insert into public.x1_challenges (challenger_id, opponent_id, fee_amount) values ('${A}', '${B}', 2)`, "x1_so_pontos");
  });

  it("contraproposta não consegue colocar aposta nem prêmio", async () => {
    const id = await duelo();
    await falha(`update public.x1_challenges set stakes_amount = 50 where id = '${id}'`, "x1_so_pontos");
    await falha(`update public.x1_challenges set prize_amount = 90 where id = '${id}'`, "x1_so_pontos");
  });

  it("duelo antigo valendo dinheiro não pode mais ser aceito", async () => {
    await falha(`update public.x1_challenges set status = 'active' where id = '11111111-1111-1111-1111-111111111111'`, "não pode mais começar");
    await como(B);
    await falha(`update public.x1_challenges set status = 'accepted' where id = '11111111-1111-1111-1111-111111111111'`, "não pode mais começar");
    // but it can still be declined/cancelled
    await db.exec(`update public.x1_challenges set status = 'declined' where id = '11111111-1111-1111-1111-111111111111'`);
  });

  it("ninguém duela consigo mesmo", async () => {
    await falha(`insert into public.x1_challenges (challenger_id, opponent_id) values ('${A}', '${A}')`, "x1_proprio");
    const id = await db.query<{ id: string }>(`insert into public.x1_challenges (challenger_id, status) values ('${A}', 'open') returning id`);
    await falha(`update public.x1_challenges set opponent_id = '${A}' where id = '${id.rows[0]!.id}'`, "x1_proprio");
  });

  it("vencedor tem que ser um dos dois lutadores", async () => {
    const id = await duelo();
    await como(null);
    await falha(`update public.x1_challenges set status = 'finished', winner_user_id = '${ESTRANHO}' where id = '${id}'`, "x1_vencedor_invalido");
  });

  it("resultado sai uma vez só: repetir a liquidação não muda nada", async () => {
    const id = await duelo();
    await como(null);
    const fecha = `update public.x1_challenges set status = 'finished', winner_user_id = '${B}' where id = '${id}' and status in ('pending','active')`;
    await db.exec(fecha);
    const segunda = await db.query(fecha); // second cron run or concurrent call: matches nothing
    expect(segunda.affectedRows).toBe(0);
    // replaying the same values is a no-op, not a new result
    await db.exec(`update public.x1_challenges set winner_user_id = '${B}' where id = '${id}'`);
  });

  it("ninguém além do admin altera resultado fechado (nem o sistema)", async () => {
    const id = await duelo();
    await como(null);
    await db.exec(`update public.x1_challenges set status = 'finished', winner_user_id = '${B}' where id = '${id}'`);
    await como(A);
    await falha(`update public.x1_challenges set winner_user_id = '${A}' where id = '${id}'`, "x1_resultado_fechado");
    await falha(`update public.x1_challenges set status = 'active' where id = '${id}'`, "x1_resultado_fechado");
    await como(null);
    await falha(`update public.x1_challenges set challenger_score = 9999 where id = '${id}'`, "x1_resultado_fechado");
    await como(ADMIN);
    await db.exec(`update public.x1_challenges set winner_user_id = null where id = '${id}'`);
  });

  it("empate e cancelamento fecham sem vencedor e sem mexer em carteira", async () => {
    const empate = await duelo();
    const cancelado = await duelo();
    await como(null);
    await db.exec(`update public.x1_challenges set status = 'finished', winner_user_id = null, challenger_score = 100, opponent_score = 100 where id = '${empate}'`);
    await como(A);
    await db.exec(`update public.x1_challenges set status = 'cancelled' where id = '${cancelado}'`);
    const t = await db.query(`select 1 from public.x1_wallet_transactions`);
    expect(t.rows).toHaveLength(0);
  });

  it("acaba a inserção direta pelo app (só pelas funções do servidor)", async () => {
    const p = await db.query(`select 1 from pg_policies where tablename = 'x1_challenges' and policyname = 'x1 insert as challenger'`);
    expect(p.rows).toHaveLength(0);
  });
});

describe("X1 só pontos — salas", () => {
  it("sala nova não aceita aposta e aposta não sobe", async () => {
    await falha(`insert into public.x1_salas (dono, stakes_amount) values ('${A}', 20)`, "x1_so_pontos");
    const s = await db.query<{ id: string }>(`insert into public.x1_salas (dono) values ('${A}') returning id`);
    await falha(`update public.x1_salas set stakes_amount = 10 where id = '${s.rows[0]!.id}'`, "x1_so_pontos");
  });
});

describe("X1 só pontos — dinheiro", () => {
  it("bloqueia aposta na carteira, até pelo sistema", async () => {
    await como(null);
    await falha(`select public.x1_wallet_apply('${A}', -1, 'aposta', null, 'x', null)`, "não aceita mais aposta");
  });

  it("usuário não deposita nem saca sozinho", async () => {
    await falha(`select public.x1_wallet_apply('${A}', 5, 'deposito', null, 'x', '${A}')`, "carteira do X1 encerrada");
    await falha(`select public.x1_wallet_apply('${A}', -1, 'saque', null, 'x', '${A}')`, "carteira do X1 encerrada");
    await falha(`insert into public.x1_withdraw_requests (user_id, valor, pix_key) values ('${A}', 1, 'chave')`, "carteira do X1 encerrada");
    await falha(`insert into public.x1_deposit_requests (user_id, valor) values ('${A}', 10)`, "carteira do X1 encerrada");
  });

  it("não cria cobrança nova do Mercado Pago, nem pelo service role", async () => {
    await como(null);
    await falha(`insert into public.x1_mp_payments values ('mp-novo', '${A}', 10, 'aguardando', null)`, "carteira do X1 encerrada");
  });

  it("webhook ainda reconcilia pagamento antigo e o saldo antigo continua intacto", async () => {
    await como(null); // mp-webhook (service role)
    await db.exec(`update public.x1_mp_payments set status = 'creditado', credited_at = now() where payment_id = 'mp-antigo' and status = 'aguardando'`);
    await db.exec(`select public.x1_wallet_apply('${A}', 30, 'deposito', null, 'MP antigo', null)`);
    const w = await db.query<{ balance: string }>(`select balance::text from public.x1_wallets where user_id = '${A}'`);
    expect(w.rows[0]!.balance).toBe("31");
  });

  it("admin ainda resolve obrigação antiga (devolver saldo / pagar saque)", async () => {
    await como(ADMIN);
    await db.exec(`insert into public.x1_withdraw_requests (user_id, valor, pix_key) values ('${A}', 1, 'chave')`);
    await db.exec(`select public.x1_wallet_apply('${A}', -1, 'saque', null, 'Saque pago pelo admin', '${ADMIN}')`);
    await como(null); // cron settling a legacy paid duel
    await db.exec(`select public.x1_wallet_apply('${B}', 36, 'premio', '22222222-2222-2222-2222-222222222222', 'legado', null)`);
    await db.exec(`update public.x1_challenges set status = 'finished', winner_user_id = '${B}', money_status = 'prize_released' where id = '22222222-2222-2222-2222-222222222222'`);
  });

  it("tira do app as funções de pagar/comprovar/sacar", async () => {
    for (const fn of ["x1_mark_paid(uuid)", "x1_set_proof(uuid,text)", "x1_request_withdraw(numeric,text,text)"]) {
      const r = await db.query<{ ok: boolean }>(`select has_function_privilege('authenticated', 'public.${fn}', 'execute') as ok`);
      expect(r.rows[0]!.ok).toBe(false);
    }
  });
});
