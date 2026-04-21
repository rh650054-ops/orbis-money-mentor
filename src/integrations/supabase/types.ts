export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_access: {
        Row: {
          cpf: string
          created_at: string
          enabled: boolean
          id: string
          notes: string | null
          role: string
        }
        Insert: {
          cpf: string
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          role?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          role?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit: {
        Row: {
          cpf: string
          created_at: string
          id: string
          reason: string | null
          result: string
          user_id: string | null
        }
        Insert: {
          cpf: string
          created_at?: string
          id?: string
          reason?: string | null
          result: string
          user_id?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string
          id?: string
          reason?: string | null
          result?: string
          user_id?: string | null
        }
        Relationships: []
      }
      challenge_blocks: {
        Row: {
          approaches_count: number
          block_index: number
          created_at: string
          ended_at: string | null
          id: string
          session_id: string
          sold_amount: number
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approaches_count?: number
          block_index: number
          created_at?: string
          ended_at?: string | null
          id?: string
          session_id: string
          sold_amount?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approaches_count?: number
          block_index?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          session_id?: string
          sold_amount?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_blocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "challenge_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_sessions: {
        Row: {
          created_at: string
          current_block_index: number
          daily_goal: number
          date: string
          ended_at: string | null
          id: string
          started_at: string
          status: string
          total_blocks: number
          total_sold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_block_index?: number
          daily_goal: number
          date?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          total_blocks?: number
          total_sold?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_block_index?: number
          daily_goal?: number
          date?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          total_blocks?: number
          total_sold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          avatar_url: string | null
          channel: string
          city: string | null
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          nickname: string | null
          state: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          channel: string
          city?: string | null
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          nickname?: string | null
          state?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          channel?: string
          city?: string | null
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          nickname?: string | null
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_checklist: {
        Row: {
          activity_name: string
          activity_time: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          date: string
          duration_minutes: number | null
          emoji: string | null
          id: string
          progress: number | null
          started_at: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_name: string
          activity_time?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number | null
          emoji?: string | null
          id?: string
          progress?: number | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_name?: string
          activity_time?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number | null
          emoji?: string | null
          id?: string
          progress?: number | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_goal_plans: {
        Row: {
          created_at: string
          daily_goal: number
          date: string
          hourly_goal: number
          id: string
          mood: string
          updated_at: string
          user_id: string
          work_hours: number
        }
        Insert: {
          created_at?: string
          daily_goal: number
          date?: string
          hourly_goal: number
          id?: string
          mood: string
          updated_at?: string
          user_id: string
          work_hours: number
        }
        Update: {
          created_at?: string
          daily_goal?: number
          date?: string
          hourly_goal?: number
          id?: string
          mood?: string
          updated_at?: string
          user_id?: string
          work_hours?: number
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          conselho: string | null
          created_at: string | null
          id: string
          melhor_hora: number | null
          pior_hora: number | null
          porcentagem_meta: number
          ritmo_medio: number
          session_id: string
          total_vendido: number
          user_id: string
        }
        Insert: {
          conselho?: string | null
          created_at?: string | null
          id?: string
          melhor_hora?: number | null
          pior_hora?: number | null
          porcentagem_meta: number
          ritmo_medio: number
          session_id: string
          total_vendido: number
          user_id: string
        }
        Update: {
          conselho?: string | null
          created_at?: string | null
          id?: string
          melhor_hora?: number | null
          pior_hora?: number | null
          porcentagem_meta?: number
          ritmo_medio?: number
          session_id?: string
          total_vendido?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales: {
        Row: {
          card_sales: number | null
          cash_sales: number | null
          cost: number | null
          created_at: string
          date: string
          id: string
          notes: string | null
          pix_sales: number | null
          reinvestment: number | null
          total_debt: number | null
          total_profit: number | null
          unpaid_sales: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_sales?: number | null
          cash_sales?: number | null
          cost?: number | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          pix_sales?: number | null
          reinvestment?: number | null
          total_debt?: number | null
          total_profit?: number | null
          unpaid_sales?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_sales?: number | null
          cash_sales?: number | null
          cost?: number | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          pix_sales?: number | null
          reinvestment?: number | null
          total_debt?: number | null
          total_profit?: number | null
          unpaid_sales?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_work_log: {
        Row: {
          created_at: string | null
          daily_goal: number | null
          date: string
          goal_achieved: boolean | null
          id: string
          notes: string | null
          percentage_achieved: number | null
          sales_amount: number | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_goal?: number | null
          date: string
          goal_achieved?: boolean | null
          id?: string
          notes?: string | null
          percentage_achieved?: number | null
          sales_amount?: number | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_goal?: number | null
          date?: string
          goal_achieved?: boolean | null
          id?: string
          notes?: string | null
          percentage_achieved?: number | null
          sales_amount?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      defcon_occurrences: {
        Row: {
          block_index: number
          created_at: string
          description: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          block_index: number
          created_at?: string
          description: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          block_index?: number
          created_at?: string
          description?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defcon_occurrences_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "challenge_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          created_at: string
          current_amount: number
          deadline: string | null
          icon: string | null
          id: string
          name: string
          status: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          deadline?: string | null
          icon?: string | null
          id?: string
          name: string
          status?: string
          target_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          deadline?: string | null
          icon?: string | null
          id?: string
          name?: string
          status?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          google_email: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          google_email: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          google_email?: string
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hour_blocks_v2: {
        Row: {
          bloco_index: number
          created_at: string | null
          horario_fim: string
          horario_inicio: string
          id: string
          ritmo_ideal_hora: number
          session_id: string
          updated_at: string | null
          user_id: string
          valor_real: number | null
        }
        Insert: {
          bloco_index: number
          created_at?: string | null
          horario_fim: string
          horario_inicio: string
          id?: string
          ritmo_ideal_hora: number
          session_id: string
          updated_at?: string | null
          user_id: string
          valor_real?: number | null
        }
        Update: {
          bloco_index?: number
          created_at?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          ritmo_ideal_hora?: number
          session_id?: string
          updated_at?: string | null
          user_id?: string
          valor_real?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hour_blocks_v2_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_goal_blocks: {
        Row: {
          achieved_amount: number
          approaches_count: number
          created_at: string
          hour_index: number
          hour_label: string
          id: string
          is_completed: boolean
          manual_adjustment: number | null
          plan_id: string
          target_amount: number
          timer_elapsed_seconds: number | null
          timer_paused_at: string | null
          timer_started_at: string | null
          timer_status: string | null
          updated_at: string
          user_id: string
          valor_calote: number | null
          valor_cartao: number | null
          valor_dinheiro: number | null
          valor_pix: number | null
        }
        Insert: {
          achieved_amount?: number
          approaches_count?: number
          created_at?: string
          hour_index: number
          hour_label: string
          id?: string
          is_completed?: boolean
          manual_adjustment?: number | null
          plan_id: string
          target_amount: number
          timer_elapsed_seconds?: number | null
          timer_paused_at?: string | null
          timer_started_at?: string | null
          timer_status?: string | null
          updated_at?: string
          user_id: string
          valor_calote?: number | null
          valor_cartao?: number | null
          valor_dinheiro?: number | null
          valor_pix?: number | null
        }
        Update: {
          achieved_amount?: number
          approaches_count?: number
          created_at?: string
          hour_index?: number
          hour_label?: string
          id?: string
          is_completed?: boolean
          manual_adjustment?: number | null
          plan_id?: string
          target_amount?: number
          timer_elapsed_seconds?: number | null
          timer_paused_at?: string | null
          timer_started_at?: string | null
          timer_status?: string | null
          updated_at?: string
          user_id?: string
          valor_calote?: number | null
          valor_cartao?: number | null
          valor_dinheiro?: number | null
          valor_pix?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hourly_goal_blocks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "daily_goal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_stats: {
        Row: {
          avatar_url: string | null
          constancia_maior_streak: number
          constancia_streak_atual: number
          created_at: string
          dias_trabalhados_mes: number
          faturamento_total_mes: number
          id: string
          mes_referencia: string
          nome_usuario: string | null
          posicao_constancia: number | null
          posicao_faturamento: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          constancia_maior_streak?: number
          constancia_streak_atual?: number
          created_at?: string
          dias_trabalhados_mes?: number
          faturamento_total_mes?: number
          id?: string
          mes_referencia: string
          nome_usuario?: string | null
          posicao_constancia?: number | null
          posicao_faturamento?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          constancia_maior_streak?: number
          constancia_streak_atual?: number
          created_at?: string
          dias_trabalhados_mes?: number
          faturamento_total_mes?: number
          id?: string
          mes_referencia?: string
          nome_usuario?: string | null
          posicao_constancia?: number | null
          posicao_faturamento?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_challenges: {
        Row: {
          created_at: string
          data_inicio: string
          id: string
          mes_referencia: string
          meta_progresso: number
          nivel_atual: string | null
          progresso_atual: number
          status: string
          tipo_desafio: string
          updated_at: string
          user_id: string
          xp_total: number
        }
        Insert: {
          created_at?: string
          data_inicio?: string
          id?: string
          mes_referencia: string
          meta_progresso?: number
          nivel_atual?: string | null
          progresso_atual?: number
          status?: string
          tipo_desafio?: string
          updated_at?: string
          user_id: string
          xp_total?: number
        }
        Update: {
          created_at?: string
          data_inicio?: string
          id?: string
          mes_referencia?: string
          meta_progresso?: number
          nivel_atual?: string | null
          progresso_atual?: number
          status?: string
          tipo_desafio?: string
          updated_at?: string
          user_id?: string
          xp_total?: number
        }
        Relationships: []
      }
      personal_expenses: {
        Row: {
          amount: number
          category: string
          color: string | null
          created_at: string
          date: string
          icon: string | null
          id: string
          name: string
          notes: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          color?: string | null
          created_at?: string
          date?: string
          icon?: string | null
          id?: string
          name: string
          notes?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          color?: string | null
          created_at?: string
          date?: string
          icon?: string | null
          id?: string
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pix_accounts: {
        Row: {
          bank_name: string
          created_at: string
          id: string
          is_default: boolean
          merchant_city: string
          merchant_name: string
          pix_key: string
          pix_key_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          merchant_city: string
          merchant_name: string
          pix_key: string
          pix_key_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          merchant_city?: string
          merchant_name?: string
          pix_key?: string
          pix_key_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          cost: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          open_price: boolean
          photo_url: string | null
          pix_account_id: string | null
          sale_price: number
          stock_min: number
          stock_quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          open_price?: boolean
          photo_url?: string | null
          pix_account_id?: string | null
          sale_price?: number
          stock_min?: number
          stock_quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          open_price?: boolean
          photo_url?: string | null
          pix_account_id?: string | null
          sale_price?: number
          stock_min?: number
          stock_quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_pix_account_id_fkey"
            columns: ["pix_account_id"]
            isOneToOne: false
            referencedRelation: "pix_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          audio_input_enabled: boolean | null
          audio_output_enabled: boolean | null
          avatar_url: string | null
          base_daily_goal: number | null
          billing_exempt: boolean | null
          check_in_focus: string | null
          check_in_mood: string | null
          check_in_start_time: string | null
          city: string | null
          cpf: string | null
          created_at: string
          daily_sales_goal: number | null
          demo_created_by: string | null
          demo_note: string | null
          email: string | null
          freeze_used_this_week: boolean | null
          goal_hours: number | null
          goal_timer_active: boolean | null
          goal_timer_started_at: string | null
          id: string
          is_demo: boolean | null
          is_trial_active: boolean | null
          last_check_in_date: string | null
          last_payment_date: string | null
          missed_days_this_week: number | null
          monthly_goal: number | null
          next_payment_date: string | null
          nickname: string | null
          payment_status: string | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          pix_merchant_city: string | null
          pix_merchant_name: string | null
          plan_status: string | null
          plan_type: string | null
          speech_rate: string | null
          speech_volume: string | null
          state: string | null
          streak_days: number | null
          subscription_id: string | null
          trial_days_remaining: number | null
          trial_end: string | null
          trial_start: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
          vision_points: number | null
          week_start_date: string | null
          weekly_goal: number | null
          weekly_work_days: number | null
          working_days: string[] | null
        }
        Insert: {
          audio_input_enabled?: boolean | null
          audio_output_enabled?: boolean | null
          avatar_url?: string | null
          base_daily_goal?: number | null
          billing_exempt?: boolean | null
          check_in_focus?: string | null
          check_in_mood?: string | null
          check_in_start_time?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          daily_sales_goal?: number | null
          demo_created_by?: string | null
          demo_note?: string | null
          email?: string | null
          freeze_used_this_week?: boolean | null
          goal_hours?: number | null
          goal_timer_active?: boolean | null
          goal_timer_started_at?: string | null
          id?: string
          is_demo?: boolean | null
          is_trial_active?: boolean | null
          last_check_in_date?: string | null
          last_payment_date?: string | null
          missed_days_this_week?: number | null
          monthly_goal?: number | null
          next_payment_date?: string | null
          nickname?: string | null
          payment_status?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          plan_status?: string | null
          plan_type?: string | null
          speech_rate?: string | null
          speech_volume?: string | null
          state?: string | null
          streak_days?: number | null
          subscription_id?: string | null
          trial_days_remaining?: number | null
          trial_end?: string | null
          trial_start?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
          vision_points?: number | null
          week_start_date?: string | null
          weekly_goal?: number | null
          weekly_work_days?: number | null
          working_days?: string[] | null
        }
        Update: {
          audio_input_enabled?: boolean | null
          audio_output_enabled?: boolean | null
          avatar_url?: string | null
          base_daily_goal?: number | null
          billing_exempt?: boolean | null
          check_in_focus?: string | null
          check_in_mood?: string | null
          check_in_start_time?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          daily_sales_goal?: number | null
          demo_created_by?: string | null
          demo_note?: string | null
          email?: string | null
          freeze_used_this_week?: boolean | null
          goal_hours?: number | null
          goal_timer_active?: boolean | null
          goal_timer_started_at?: string | null
          id?: string
          is_demo?: boolean | null
          is_trial_active?: boolean | null
          last_check_in_date?: string | null
          last_payment_date?: string | null
          missed_days_this_week?: number | null
          monthly_goal?: number | null
          next_payment_date?: string | null
          nickname?: string | null
          payment_status?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          plan_status?: string | null
          plan_type?: string | null
          speech_rate?: string | null
          speech_volume?: string | null
          state?: string | null
          streak_days?: number | null
          subscription_id?: string | null
          trial_days_remaining?: number | null
          trial_end?: string | null
          trial_start?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
          vision_points?: number | null
          week_start_date?: string | null
          weekly_goal?: number | null
          weekly_work_days?: number | null
          working_days?: string[] | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      routine_activities: {
        Row: {
          category: string | null
          created_at: string
          display_order: number | null
          emoji: string | null
          end_time: string
          id: string
          name: string
          notes: string | null
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          display_order?: number | null
          emoji?: string | null
          end_time: string
          id?: string
          name: string
          notes?: string | null
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          display_order?: number | null
          emoji?: string | null
          end_time?: string
          id?: string
          name?: string
          notes?: string | null
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      routines: {
        Row: {
          created_at: string
          daily_debt: number | null
          daily_profit: number | null
          id: string
          lunch_time: string
          notes: string | null
          sleep_time: string
          updated_at: string
          user_id: string
          wake_time: string
          work_end: string
          work_start: string
        }
        Insert: {
          created_at?: string
          daily_debt?: number | null
          daily_profit?: number | null
          id?: string
          lunch_time: string
          notes?: string | null
          sleep_time: string
          updated_at?: string
          user_id: string
          wake_time: string
          work_end: string
          work_start: string
        }
        Update: {
          created_at?: string
          daily_debt?: number | null
          daily_profit?: number | null
          id?: string
          lunch_time?: string
          notes?: string | null
          sleep_time?: string
          updated_at?: string
          user_id?: string
          wake_time?: string
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          grace_until: string | null
          hotmart_purchase_id: string | null
          hotmart_subscription_id: string | null
          id: string
          last_event_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          grace_until?: string | null
          hotmart_purchase_id?: string | null
          hotmart_subscription_id?: string | null
          id?: string
          last_event_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          grace_until?: string | null
          hotmart_purchase_id?: string | null
          hotmart_subscription_id?: string | null
          id?: string
          last_event_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unlinked_purchases: {
        Row: {
          buyer_cpf: string | null
          buyer_email: string | null
          created_at: string
          event_type: string
          hotmart_purchase_id: string | null
          hotmart_subscription_id: string | null
          id: string
          linked_at: string | null
          linked_to_user_id: string | null
          payload: Json
        }
        Insert: {
          buyer_cpf?: string | null
          buyer_email?: string | null
          created_at?: string
          event_type: string
          hotmart_purchase_id?: string | null
          hotmart_subscription_id?: string | null
          id?: string
          linked_at?: string | null
          linked_to_user_id?: string | null
          payload?: Json
        }
        Update: {
          buyer_cpf?: string | null
          buyer_email?: string | null
          created_at?: string
          event_type?: string
          hotmart_purchase_id?: string | null
          hotmart_subscription_id?: string | null
          id?: string
          linked_at?: string | null
          linked_to_user_id?: string | null
          payload?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          constancia_dia: boolean | null
          created_at: string | null
          end_timestamp: string | null
          id: string
          meta_dia: number
          planning_date: string
          ritmo_ideal_inicial: number
          start_timestamp: string
          status: string
          total_vendido: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          constancia_dia?: boolean | null
          created_at?: string | null
          end_timestamp?: string | null
          id?: string
          meta_dia: number
          planning_date: string
          ritmo_ideal_inicial: number
          start_timestamp: string
          status?: string
          total_vendido?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          constancia_dia?: boolean | null
          created_at?: string | null
          end_timestamp?: string | null
          id?: string
          meta_dia?: number
          planning_date?: string
          ritmo_ideal_inicial?: number
          start_timestamp?: string
          status?: string
          total_vendido?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_trial_expired: { Args: { user_uuid: string }; Returns: boolean }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      filter_profanity: { Args: { input_text: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalculate_ranking_positions: {
        Args: { target_month: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
