import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    console.log('=== Iniciando criação de conta demo ===');
    
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

    console.log('Supabase client criado');

    // Verificar se o usuário que está chamando é admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Autorização não fornecida');
      throw new Error('Autorização necessária');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      console.error('Erro de autenticação:', authError);
      throw new Error('Usuário não autenticado');
    }

    console.log('Usuário autenticado:', requestingUser.id);

    // Verificar se o usuário é admin usando a função has_role
    const { data: isAdmin, error: roleError } = await supabaseAdmin
      .rpc('has_role', {
        _user_id: requestingUser.id,
        _role: 'admin'
      });

    if (roleError) {
      console.error('Erro ao verificar role:', roleError);
      throw new Error('Erro ao verificar permissões');
    }

    if (!isAdmin) {
      throw new Error('Acesso negado. Apenas administradores podem criar contas demo.');
    }

    const { email, nickname, note }: CreateDemoUserRequest = await req.json();

    if (!email) {
      throw new Error('Email é obrigatório');
    }

    // Gerar senha aleatória
    const randomPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';

    console.log('Criando usuário demo:', email);

    // Criar usuário
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        nickname: nickname || email.split('@')[0],
      }
    });

    if (createError) {
      console.error('Erro ao criar usuário:', createError);
      throw createError;
    }

    console.log('Usuário criado, atualizando perfil...');

    // Aguardar um pouco para garantir que o perfil foi criado pelo trigger
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Atualizar o perfil com os campos demo
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        is_demo: true,
        demo_created_by: requestingUser.id,
        demo_note: note || 'Conta de demonstração criada manualmente',
        billing_exempt: true,
        plan_status: 'active',
        plan_type: 'demo',
        trial_start: null,
        trial_end: null,
        is_trial_active: false,
        nickname: nickname || email.split('@')[0]
      })
      .eq('user_id', newUser.user.id);

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError);
      throw updateError;
    }

    console.log('Conta demo criada com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          password: randomPassword
        },
        message: 'Conta demo criada com sucesso!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro ao criar conta demo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});