/* "Dados da conta": private data as a list; editing opens a bottom sheet. */
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "@/shared/hooks/use-toast";
import { avisar } from "@/shared/lib/avisar";
import { useBrazilCities } from "@/shared/hooks/use-brazil-cities";
import type { Conta, DadosConta } from "../types";
import { useSalvarDadosMutation } from "../api/use-conta-mutations";
import { Botao, Campo, Folha, INPUT, LinhaDado, Secao } from "./base";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const fmtTel = (v: string | null) => { const d = (v ?? "").replace(/\D/g, ""); return d.length >= 10 ? d.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : v; };

const dadosSchema = z.object({
  nickname: z.string().trim().min(1, "Coloque seu nome").max(100),
  phone: z.string().refine((v) => { const d = v.replace(/\D/g, ""); return d.length >= 10 && d.length <= 11; }, "WhatsApp inválido (DDD + número)"),
  state: z.string().length(2, "Escolha o estado"),
  city: z.string().trim().min(2, "Escolha a cidade"),
  email: z.string().trim().max(255).email("E-mail inválido").or(z.literal("")),
});

export function DadosContaCard({ conta, onEditar }: { conta: Conta; onEditar: () => void }) {
  return (
    <Secao titulo="DADOS DA CONTA" id="sec-dados" acao={<span className="text-[11px] font-bold text-[#8a8378]">só você vê</span>}>
      <LinhaDado rotulo="Nome" valor={conta.nickname} />
      <LinhaDado rotulo="WhatsApp" valor={fmtTel(conta.phone)} />
      <LinhaDado rotulo="Cidade" valor={[conta.city, conta.state].filter(Boolean).join(" · ") || null} />
      <LinhaDado rotulo="E-mail" valor={conta.email} />
      <Botao className="w-full mt-3" onClick={onEditar}>Editar dados</Botao>
    </Secao>
  );
}

const MSG_UNICO: Record<string, string> = { email: "Esse e-mail", phone: "Esse WhatsApp", cpf: "Esse CPF" };

export function EditarDadosFolha({ aberta, onFechar, conta }: { aberta: boolean; onFechar: () => void; conta: Conta }) {
  const inicial = (): DadosConta => ({ nickname: conta.nickname ?? "", phone: conta.phone ?? "", state: conta.state ?? "", city: conta.city ?? "", email: conta.email ?? "" });
  const [f, setF] = useState<DadosConta>(inicial);
  const salvar = useSalvarDadosMutation(conta.user_id);
  const { cities, loading } = useBrazilCities(f.state);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (aberta) setF(inicial()); }, [aberta]);

  const enviar = () => {
    const v = dadosSchema.safeParse(f);
    if (!v.success) { toast({ title: v.error.errors[0]?.message ?? "Confira os dados", variant: "destructive" }); return; }
    salvar.mutate(f, {
      onSuccess: () => { toast({ title: "Dados atualizados" }); onFechar(); },
      onError: (e) => {
        avisar.erro("conta: salvar dados", e);
        const campo = /profiles_(email|phone|cpf)_unique/.exec(String((e as { message?: string })?.message ?? ""))?.[1];
        toast(campo
          ? { title: `${MSG_UNICO[campo]} já está em outra conta`, description: "Você pode ter um cadastro antigo. Fale com o suporte que a gente junta as contas.", variant: "destructive" }
          : { title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" });
      },
    });
  };

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Dados da conta" sub="Privados: só você e o suporte da VANT veem.">
      <Campo rotulo="NOME"><input className={INPUT} value={f.nickname} maxLength={100} onChange={(e) => setF({ ...f, nickname: e.target.value })} /></Campo>
      <Campo rotulo="WHATSAPP"><input className={INPUT} inputMode="numeric" value={f.phone} maxLength={11} placeholder="11999999999" onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} /></Campo>
      <div className="grid grid-cols-3 gap-2">
        <Campo rotulo="UF">
          <select className={INPUT} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value, city: "" })}>
            <option value="">UF</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Campo>
        <div className="col-span-2">
          <Campo rotulo="CIDADE">
            <select className={INPUT} value={f.city} disabled={!f.state || loading} onChange={(e) => setF({ ...f, city: e.target.value })}>
              <option value="">{!f.state ? "Escolha a UF" : loading ? "Carregando…" : "Escolha a cidade"}</option>
              {f.city && !cities.includes(f.city) && <option value={f.city}>{f.city}</option>}
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
        </div>
      </div>
      <Campo rotulo="E-MAIL (OPCIONAL)"><input className={INPUT} type="email" value={f.email} maxLength={255} placeholder="seu@email.com" onChange={(e) => setF({ ...f, email: e.target.value })} /></Campo>
      <Botao tipo="ouro" className="w-full h-12 text-[15px]" onClick={enviar} disabled={salvar.isPending}>{salvar.isPending ? "Salvando…" : "Salvar dados"}</Botao>
    </Folha>
  );
}
