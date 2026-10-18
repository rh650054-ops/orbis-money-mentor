import { z } from "zod";

const texto = z.string().nullable().catch(null);
const flag = (padrao: boolean) => z.boolean().nullable().catch(padrao).transform((v) => v ?? padrao);

/** The account row as this screen needs it (profiles, own row). */
export const contaSchema = z.object({
  user_id: z.string(),
  nickname: texto,
  email: texto,
  phone: texto,
  city: texto,
  state: texto,
  avatar_url: texto,
  created_at: texto,
  plan_status: texto,
  trial_end: texto,
  is_demo: flag(false),
  billing_exempt: flag(false),
  comp_label: texto,
  bio: texto,
  what_i_sell: texto,
  where_i_sell: texto,
  instagram: texto,
  whatsapp_public: texto,
  show_instagram: flag(false),
  show_whatsapp: flag(false),
  show_city: flag(true),
  ranking_oculto: flag(false),
});
export type Conta = z.infer<typeof contaSchema>;

/** orbis_pro_status(): the Pro side of the plan. */
export const proSchema = z.object({
  pro: z.boolean().nullable().catch(false),
  origem: texto,
  ate: texto,
});
export type ProStatus = z.infer<typeof proSchema>;

export interface DadosConta {
  nickname: string;
  phone: string;
  state: string;
  city: string;
  email: string;
}

export interface PerfilPublico {
  nickname: string;
  bio: string;
  what_i_sell: string;
  where_i_sell: string;
  instagram: string;
  whatsapp_public: string;
  show_city: boolean;
  show_instagram: boolean;
  show_whatsapp: boolean;
}

export interface Atividade {
  vendas: number;
  abordagens: number;
  diasAtivos: number;
  faturamento: number;
}
