import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get("ALLOWED_ORIGIN") ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateDemoUserRequest {
  email: string;
  nickname?: string;
  note?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Iniciando criação/conversão de conta demo ===');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Autorização necessária');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se o usuário é admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: requestingUser.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      throw new Error('Acesso negado. Apenas administradores podem criar contas demo.');
    }

    const { email, nickname, note }: CreateDemoUserRequest = await req.json();

    if (!email) {
      throw new Error('Email é obrigatório');
    }

    // Verificar se já existe um usuário com esse e-mail
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;
    let password: string | null = null;

    if (existingUser) {
      console.log('Usuário já existe, convertendo para demo:', existingUser.id);
      userId = existingUser.id;
    } else {
      // Criar novo usuário
      password = crypto.randomUUID().slice(0, 12) + 'Aa1!';
      console.log('Criando novo usuário demo:', email);

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nickname: nickname || email.split('@')[0],
        }
      });

      if (createError) throw createError;
      userId = newUser.user.id;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Perfil demo: UPSERT, não update. Conta criada aqui (por e-mail, fora do cadastro do app)
    // não tem perfil — o update batia em 0 linhas e respondia "criada com sucesso" (23/10/2026).
    const { data: perfil, error: updateError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        email,
        is_demo: true,
        demo_created_by: requestingUser.id,
        demo_note: note || 'Conta de demonstração',
        billing_exempt: true,
        plan_status: 'active',
        plan_type: 'demo',
        trial_start: null,
        trial_end: null,
        is_trial_active: false,
        nickname: nickname || email.split('@')[0],
        // Conta NOVA (revisor das lojas / demonstração): fora do ranking e sem cair no onboarding.
        // Conta existente convertida (gente da equipe) continua como estava nesses pontos.
        ...(existingUser ? {} : {
          ranking_hidden: true,
          onboarding_completed: true,
          termos_aceitos_versao: '2026-07-28',
          termos_aceitos_em: new Date().toISOString(),
        }),
      }, { onConflict: 'user_id' })
      .select('user_id');

    if (updateError) throw updateError;
    if (!perfil || perfil.length === 0) throw new Error('Perfil da conta demo não foi gravado');

    // Conta NOVA vê o app inteiro (produtos/estoque são só Pro): Pro de cortesia sem validade.
    // Conta existente convertida NÃO ganha Pro por aqui.
    if (!existingUser) {
      const { error: proError } = await supabaseAdmin
        .from('orbis_pro')
        .upsert({ user_id: userId, ativo: true, origem: 'cortesia', atualizado_em: new Date().toISOString() }, { onConflict: 'user_id' });
      if (proError) throw proError;
    }

    console.log('Conta demo configurada com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email,
          password: password || '(conta existente — senha não alterada)',
          existing: !!existingUser
        },
        message: existingUser 
          ? 'Conta existente convertida para demo com sucesso!' 
          : 'Conta demo criada com sucesso!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro ao criar/converter conta demo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
