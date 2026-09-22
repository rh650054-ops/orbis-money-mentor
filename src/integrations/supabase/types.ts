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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      financas_guardar_dia: {
        Row: {
          user_id: string
          dia: string
          alvo: number
          guardado: number
          ultimo_guardei: Json | null
          salvo_em: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          dia: string
          alvo?: number
          guardado?: number
          ultimo_guardei?: Json | null
          salvo_em?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          dia?: string
          alvo?: number
          guardado?: number
          ultimo_guardei?: Json | null
          salvo_em?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_access: {
        Row: {
          cpf: string
          created_at: string
          enabled: boolean
          id: string
          is_super_admin: boolean
          notes: string | null
          papel: string
          role: string
          user_id: string | null
        }
        Insert: {
          cpf: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_super_admin?: boolean
          notes?: string | null
          papel?: string
          role?: string
          user_id?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_super_admin?: boolean
          notes?: string | null
          papel?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_brain: {
        Row: {
          content: string
          enabled: boolean
          id: string
          key: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          enabled?: boolean
          id?: string
          key: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          enabled?: boolean
          id?: string
          key?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_conhecimento: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string
          conteudo: string
          criado_em: string
          id: number
          ordem: number
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          conteudo: string
          criado_em?: string
          id?: never
          ordem?: number
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          conteudo?: string
          criado_em?: string
          id?: never
          ordem?: number
          titulo?: string
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
      ai_custos: {
        Row: {
          custo_usd: number
          id: string
          modelo: string | null
          qtd: number
          servico: string
          ts: string
          unidade: string
          user_id: string | null
        }
        Insert: {
          custo_usd?: number
          id?: string
          modelo?: string | null
          qtd?: number
          servico: string
          ts?: string
          unidade?: string
          user_id?: string | null
        }
        Update: {
          custo_usd?: number
          id?: string
          modelo?: string | null
          qtd?: number
          servico?: string
          ts?: string
          unidade?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_diag: {
        Row: {
          id: string
          info: Json | null
          ts: string | null
        }
        Insert: {
          id?: string
          info?: Json | null
          ts?: string | null
        }
        Update: {
          id?: string
          info?: Json | null
          ts?: string | null
        }
        Relationships: []
      }
      ai_limites: {
        Row: {
          atualizado_em: string
          chave: string
          descricao: string | null
          valor: number
        }
        Insert: {
          atualizado_em?: string
          chave: string
          descricao?: string | null
          valor: number
        }
        Update: {
          atualizado_em?: string
          chave?: string
          descricao?: string | null
          valor?: number
        }
        Relationships: []
      }
      ai_memoria: {
        Row: {
          ativo: boolean
          created_at: string
          fato: string
          id: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          fato: string
          id?: string
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          fato?: string
          id?: string
          tipo?: string
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
      ai_usage: {
        Row: {
          count: number
          date: string | null
          dia: string
          feature: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          date?: string | null
          dia?: string
          feature?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          date?: string | null
          dia?: string
          feature?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
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
      auto_detected_sales: {
        Row: {
          amount: number
          bank_connection_id: string | null
          created_at: string
          daily_sale_id: string | null
          description: string | null
          id: string
          status: string
          transaction_date: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_connection_id?: string | null
          created_at?: string
          daily_sale_id?: string | null
          description?: string | null
          id?: string
          status?: string
          transaction_date: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_connection_id?: string | null
          created_at?: string
          daily_sale_id?: string | null
          description?: string | null
          id?: string
          status?: string
          transaction_date?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_detected_sales_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          created_at: string
          id: string
          institution_logo: string | null
          institution_name: string
          item_id: string
          last_synced_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_logo?: string | null
          institution_name: string
          item_id: string
          last_synced_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_logo?: string | null
          institution_name?: string
          item_id?: string
          last_synced_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_statements: {
        Row: {
          ai_result: Json | null
          approved_value: number | null
          competition_id: string | null
          context_type: string
          created_at: string
          file_path: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          statement_date: string
          status: string
          user_id: string
          x1_id: string | null
        }
        Insert: {
          ai_result?: Json | null
          approved_value?: number | null
          competition_id?: string | null
          context_type: string
          created_at?: string
          file_path: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement_date?: string
          status?: string
          user_id: string
          x1_id?: string | null
        }
        Update: {
          ai_result?: Json | null
          approved_value?: number | null
          competition_id?: string | null
          context_type?: string
          created_at?: string
          file_path?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement_date?: string
          status?: string
          user_id?: string
          x1_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_x1_id_fkey"
            columns: ["x1_id"]
            isOneToOne: false
            referencedRelation: "x1_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      caca_sinais: {
        Row: {
          atualizado_em: string
          cidade: string | null
          criado_em: string
          fonte: string
          id: string
          lat: number
          lng: number
          osm_id: number | null
          uf: string | null
          vias: string | null
        }
        Insert: {
          atualizado_em?: string
          cidade?: string | null
          criado_em?: string
          fonte?: string
          id?: string
          lat: number
          lng: number
          osm_id?: number | null
          uf?: string | null
          vias?: string | null
        }
        Update: {
          atualizado_em?: string
          cidade?: string | null
          criado_em?: string
          fonte?: string
          id?: string
          lat?: number
          lng?: number
          osm_id?: number | null
          uf?: string | null
          vias?: string | null
        }
        Relationships: []
      }
      caca_sinal_duracoes: {
        Row: {
          created_at: string
          duracao: string
          osm_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          duracao: string
          osm_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          duracao?: string
          osm_id?: number
          user_id?: string
        }
        Relationships: []
      }
      cadastro_freio: {
        Row: {
          chave: string
          janela_em: string
          tentativas: number
        }
        Insert: {
          chave: string
          janela_em?: string
          tentativas?: number
        }
        Update: {
          chave?: string
          janela_em?: string
          tentativas?: number
        }
        Relationships: []
      }
      caixa_movimentos: {
        Row: {
          cat: string | null
          created_at: string
          data: string
          descricao: string | null
          id: string
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          cat?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          cat?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          tipo?: string
          user_id?: string
          valor?: number
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
          sales_count: number | null
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
          sales_count?: number | null
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
          sales_count?: number | null
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
          distance_meters: number
          ended_at: string | null
          id: string
          origem: string | null
          paused_seconds: number
          sinal_compartilha: boolean
          sinal_duracao: string | null
          sinal_lat: number | null
          sinal_lng: number | null
          sinal_osm_id: number | null
          sinal_rating: string | null
          started_at: string
          status: string
          total_blocks: number
          total_sold: number
          updated_at: string
          user_id: string
          worked_minutes: number | null
        }
        Insert: {
          created_at?: string
          current_block_index?: number
          daily_goal: number
          date?: string
          distance_meters?: number
          ended_at?: string | null
          id?: string
          origem?: string | null
          paused_seconds?: number
          sinal_compartilha?: boolean
          sinal_duracao?: string | null
          sinal_lat?: number | null
          sinal_lng?: number | null
          sinal_osm_id?: number | null
          sinal_rating?: string | null
          started_at?: string
          status?: string
          total_blocks?: number
          total_sold?: number
          updated_at?: string
          user_id: string
          worked_minutes?: number | null
        }
        Update: {
          created_at?: string
          current_block_index?: number
          daily_goal?: number
          date?: string
          distance_meters?: number
          ended_at?: string | null
          id?: string
          origem?: string | null
          paused_seconds?: number
          sinal_compartilha?: boolean
          sinal_duracao?: string | null
          sinal_lat?: number | null
          sinal_lng?: number | null
          sinal_osm_id?: number | null
          sinal_rating?: string | null
          started_at?: string
          status?: string
          total_blocks?: number
          total_sold?: number
          updated_at?: string
          user_id?: string
          worked_minutes?: number | null
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
      clima_cache: {
        Row: {
          chave: string
          criado_em: string
          payload: Json
        }
        Insert: {
          chave: string
          criado_em?: string
          payload: Json
        }
        Update: {
          chave?: string
          criado_em?: string
          payload?: Json
        }
        Relationships: []
      }
      clima_celula: {
        Row: {
          atualizado_em: string
          cell: string
          payload: Json
        }
        Insert: {
          atualizado_em?: string
          cell: string
          payload: Json
        }
        Update: {
          atualizado_em?: string
          cell?: string
          payload?: Json
        }
        Relationships: []
      }
      clima_dia: {
        Row: {
          alerta: boolean
          atualizado_em: string
          chuva_mm: number | null
          cidade: string | null
          data: string
          estado: string
          temp: number | null
          uf: string | null
          user_id: string
        }
        Insert: {
          alerta?: boolean
          atualizado_em?: string
          chuva_mm?: number | null
          cidade?: string | null
          data: string
          estado: string
          temp?: number | null
          uf?: string | null
          user_id: string
        }
        Update: {
          alerta?: boolean
          atualizado_em?: string
          chuva_mm?: number | null
          cidade?: string | null
          data?: string
          estado?: string
          temp?: number | null
          uf?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          abate_calote: boolean
          cliente_nome: string | null
          cliente_telefone: string | null
          criada_em: string
          data: string
          defcon_client_id: string | null
          descricao: string | null
          enviada_em: string | null
          expira_em: string | null
          external_ref: string
          id: string
          lancada: boolean
          link_url: string | null
          paga_em: string | null
          pix_copia_cola: string | null
          provedor: string
          provider_payment_id: string | null
          qr_base64: string | null
          status: string
          user_id: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          abate_calote?: boolean
          cliente_nome?: string | null
          cliente_telefone?: string | null
          criada_em?: string
          data?: string
          defcon_client_id?: string | null
          descricao?: string | null
          enviada_em?: string | null
          expira_em?: string | null
          external_ref: string
          id?: string
          lancada?: boolean
          link_url?: string | null
          paga_em?: string | null
          pix_copia_cola?: string | null
          provedor?: string
          provider_payment_id?: string | null
          qr_base64?: string | null
          status?: string
          user_id: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          abate_calote?: boolean
          cliente_nome?: string | null
          cliente_telefone?: string | null
          criada_em?: string
          data?: string
          defcon_client_id?: string | null
          descricao?: string | null
          enviada_em?: string | null
          expira_em?: string | null
          external_ref?: string
          id?: string
          lancada?: boolean
          link_url?: string | null
          paga_em?: string | null
          pix_copia_cola?: string | null
          provedor?: string
          provider_payment_id?: string | null
          qr_base64?: string | null
          status?: string
          user_id?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          avatar_url: string | null
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          nickname: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          nickname?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          nickname?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_likes: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          avatar_url: string | null
          channel: string
          city: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_deleted: boolean
          nickname: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          channel: string
          city?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          nickname?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          channel?: string
          city?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          nickname?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      competition_participants: {
        Row: {
          approved_score: number | null
          competition_id: string
          id: string
          joined_at: string
          last_statement_id: string | null
          paid: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          score_approved: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_score?: number | null
          competition_id: string
          id?: string
          joined_at?: string
          last_statement_id?: string | null
          paid?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          score_approved?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_score?: number | null
          competition_id?: string
          id?: string
          joined_at?: string
          last_statement_id?: string | null
          paid?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          score_approved?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_participants_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_winners: {
        Row: {
          awarded_at: string
          claim_acknowledged_at: string | null
          claimed: boolean
          competition_id: string
          id: string
          notes: string | null
          prize_label: string
          prize_value: number
          user_id: string
        }
        Insert: {
          awarded_at?: string
          claim_acknowledged_at?: string | null
          claimed?: boolean
          competition_id: string
          id?: string
          notes?: string | null
          prize_label: string
          prize_value?: number
          user_id: string
        }
        Update: {
          awarded_at?: string
          claim_acknowledged_at?: string | null
          claimed?: boolean
          competition_id?: string
          id?: string
          notes?: string | null
          prize_label?: string
          prize_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_winners_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          audience_cities: string[]
          audience_type: string
          bilhete_config: Json | null
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string
          entry_fee: number | null
          entry_instructions: string | null
          entry_rule: string
          id: string
          invited_user_ids: string[]
          metric: string
          name: string
          period_type: string
          pinned: boolean
          prize_label: string
          prize_value: number
          recurrence_note: string | null
          starts_at: string
          status: string
          updated_at: string
          winner_user_id: string | null
        }
        Insert: {
          audience_cities?: string[]
          audience_type?: string
          bilhete_config?: Json | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at: string
          entry_fee?: number | null
          entry_instructions?: string | null
          entry_rule?: string
          id?: string
          invited_user_ids?: string[]
          metric?: string
          name: string
          period_type?: string
          pinned?: boolean
          prize_label: string
          prize_value?: number
          recurrence_note?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Update: {
          audience_cities?: string[]
          audience_type?: string
          bilhete_config?: Json | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string
          entry_fee?: number | null
          entry_instructions?: string | null
          entry_rule?: string
          id?: string
          invited_user_ids?: string[]
          metric?: string
          name?: string
          period_type?: string
          pinned?: boolean
          prize_label?: string
          prize_value?: number
          recurrence_note?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Relationships: []
      }
      compras_mercadoria: {
        Row: {
          created_at: string
          custo_anterior: number | null
          custo_novo: number | null
          custo_unitario: number | null
          data: string
          fornecedor: string
          id: string
          ingredient_id: string | null
          item_tipo: string
          lancar_custo_dia: boolean
          notas: string
          product_id: string | null
          quantidade: number
          total_pago: number
          user_id: string
        }
        Insert: {
          created_at?: string
          custo_anterior?: number | null
          custo_novo?: number | null
          custo_unitario?: number | null
          data?: string
          fornecedor?: string
          id?: string
          ingredient_id?: string | null
          item_tipo: string
          lancar_custo_dia?: boolean
          notas?: string
          product_id?: string | null
          quantidade: number
          total_pago: number
          user_id?: string
        }
        Update: {
          created_at?: string
          custo_anterior?: number | null
          custo_novo?: number | null
          custo_unitario?: number | null
          data?: string
          fornecedor?: string
          id?: string
          ingredient_id?: string | null
          item_tipo?: string
          lancar_custo_dia?: boolean
          notas?: string
          product_id?: string | null
          quantidade?: number
          total_pago?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_mercadoria_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_mercadoria_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_assets: {
        Row: {
          content: string
          id: string
          updated_at: string
        }
        Insert: {
          content: string
          id: string
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_atividades: {
        Row: {
          criado_em: string
          de: string | null
          id: number
          influenciador_id: string | null
          para: string | null
          tipo: string
        }
        Insert: {
          criado_em?: string
          de?: string | null
          id?: never
          influenciador_id?: string | null
          para?: string | null
          tipo: string
        }
        Update: {
          criado_em?: string
          de?: string | null
          id?: never
          influenciador_id?: string | null
          para?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_atividades_influenciador_id_fkey"
            columns: ["influenciador_id"]
            isOneToOne: false
            referencedRelation: "crm_influenciadores"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cartoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          etapa: string
          etapa_desde: string
          fechado_em: string | null
          id: number
          lead_id: number | null
          notas: string | null
          pipeline: string
          ref: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          etapa: string
          etapa_desde?: string
          fechado_em?: string | null
          id?: never
          lead_id?: number | null
          notas?: string | null
          pipeline: string
          ref?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          etapa?: string
          etapa_desde?: string
          fechado_em?: string | null
          id?: never
          lead_id?: number | null
          notas?: string | null
          pipeline?: string
          ref?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_cartoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_config: {
        Row: {
          id: number
          meta_diaria: number
          msg_boas_vindas: string | null
          template_msg: string
          updated_at: string
        }
        Insert: {
          id?: number
          meta_diaria?: number
          msg_boas_vindas?: string | null
          template_msg?: string
          updated_at?: string
        }
        Update: {
          id?: number
          meta_diaria?: number
          msg_boas_vindas?: string | null
          template_msg?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_conversas: {
        Row: {
          cartao_id: number
          criado_em: string
          de: string
          id: number
          origem: string
          por: string | null
          texto: string
        }
        Insert: {
          cartao_id: number
          criado_em?: string
          de: string
          id?: number
          origem?: string
          por?: string | null
          texto: string
        }
        Update: {
          cartao_id?: number
          criado_em?: string
          de?: string
          id?: number
          origem?: string
          por?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_conversas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "crm_cartoes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_etapas: {
        Row: {
          cor: string
          etapa: string
          ordem: number
          pipeline: string
          titulo: string
        }
        Insert: {
          cor?: string
          etapa: string
          ordem: number
          pipeline: string
          titulo: string
        }
        Update: {
          cor?: string
          etapa?: string
          ordem?: number
          pipeline?: string
          titulo?: string
        }
        Relationships: []
      }
      crm_influenciadores: {
        Row: {
          codigo_afiliado: string | null
          created_at: string
          data_ultimo_contato: string
          id: string
          link_afiliado: string | null
          link_perfil: string
          nome: string
          notas: string
          seguidores: number
          status: Database["public"]["Enums"]["crm_funil_status"]
          updated_at: string
        }
        Insert: {
          codigo_afiliado?: string | null
          created_at?: string
          data_ultimo_contato?: string
          id?: string
          link_afiliado?: string | null
          link_perfil?: string
          nome: string
          notas?: string
          seguidores?: number
          status?: Database["public"]["Enums"]["crm_funil_status"]
          updated_at?: string
        }
        Update: {
          codigo_afiliado?: string | null
          created_at?: string
          data_ultimo_contato?: string
          id?: string
          link_afiliado?: string | null
          link_perfil?: string
          nome?: string
          notas?: string
          seguidores?: number
          status?: Database["public"]["Enums"]["crm_funil_status"]
          updated_at?: string
        }
        Relationships: []
      }
      crm_suporte: {
        Row: {
          atividade_em: string | null
          atualizado_em: string
          chave: string
          estagio: string | null
          notas: string | null
          por: string | null
        }
        Insert: {
          atividade_em?: string | null
          atualizado_em?: string
          chave: string
          estagio?: string | null
          notas?: string | null
          por?: string | null
        }
        Update: {
          atividade_em?: string | null
          atualizado_em?: string
          chave?: string
          estagio?: string | null
          notas?: string | null
          por?: string | null
        }
        Relationships: []
      }
      crm_tarefas_feitas: {
        Row: {
          cartao_id: number
          feito_em: string
          feito_por: string | null
          tarefa_id: number
        }
        Insert: {
          cartao_id: number
          feito_em?: string
          feito_por?: string | null
          tarefa_id: number
        }
        Update: {
          cartao_id?: number
          feito_em?: string
          feito_por?: string | null
          tarefa_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_tarefas_feitas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "crm_cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tarefas_feitas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "crm_tarefas_modelo"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tarefas_modelo: {
        Row: {
          etapa: string
          id: number
          obrigatoria: boolean
          ordem: number
          pipeline: string
          titulo: string
        }
        Insert: {
          etapa: string
          id?: never
          obrigatoria?: boolean
          ordem: number
          pipeline: string
          titulo: string
        }
        Update: {
          etapa?: string
          id?: never
          obrigatoria?: boolean
          ordem?: number
          pipeline?: string
          titulo?: string
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
      daily_distributions: {
        Row: {
          amount: number
          created_at: string
          date: string
          goal_id: string
          goal_name: string
          id: string
          liquido_base: number
          percentual: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          goal_id: string
          goal_name: string
          id?: string
          liquido_base: number
          percentual: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          goal_id?: string
          goal_name?: string
          id?: string
          liquido_base?: number
          percentual?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_distributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "financial_goals"
            referencedColumns: ["id"]
          },
        ]
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
          porcentagem_meta?: number
          ritmo_medio?: number
          session_id: string
          total_vendido?: number
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
          food_cost: number | null
          id: string
          notes: string | null
          pix_sales: number | null
          reinvestment: number | null
          tip_sales: number | null
          total_debt: number | null
          total_profit: number | null
          transport_cost: number | null
          units_carried: number
          unpaid_sales: number | null
          unpaid_units: number
          updated_at: string
          user_id: string
        }
        Insert: {
          card_sales?: number | null
          cash_sales?: number | null
          cost?: number | null
          created_at?: string
          date?: string
          food_cost?: number | null
          id?: string
          notes?: string | null
          pix_sales?: number | null
          reinvestment?: number | null
          tip_sales?: number | null
          total_debt?: number | null
          total_profit?: number | null
          transport_cost?: number | null
          units_carried?: number
          unpaid_sales?: number | null
          unpaid_units?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          card_sales?: number | null
          cash_sales?: number | null
          cost?: number | null
          created_at?: string
          date?: string
          food_cost?: number | null
          id?: string
          notes?: string | null
          pix_sales?: number | null
          reinvestment?: number | null
          tip_sales?: number | null
          total_debt?: number | null
          total_profit?: number | null
          transport_cost?: number | null
          units_carried?: number
          unpaid_sales?: number | null
          unpaid_units?: number
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
      defcon_clients: {
        Row: {
          amount: number
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          date: string
          id: string
          method: string
          notes: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          date?: string
          id?: string
          method?: string
          notes?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          date?: string
          id?: string
          method?: string
          notes?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      defcon_daily_loadout: {
        Row: {
          created_at: string
          date: string
          id: string
          product_id: string
          product_name: string
          qty_initial: number
          qty_sold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          product_id: string
          product_name: string
          qty_initial?: number
          qty_sold?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          product_id?: string
          product_name?: string
          qty_initial?: number
          qty_sold?: number
          updated_at?: string
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
      defcon_pausas: {
        Row: {
          created_at: string
          fim: string | null
          id: string
          inicio: string
          motivo: string
          segundos: number | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string
          motivo?: string
          segundos?: number | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string
          motivo?: string
          segundos?: number | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      defcon_sales: {
        Row: {
          amount: number
          block_index: number | null
          created_at: string
          id: string
          late: boolean
          method: string | null
          product_id: string | null
          qty: number
          session_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          block_index?: number | null
          created_at?: string
          id?: string
          late?: boolean
          method?: string | null
          product_id?: string | null
          qty?: number
          session_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          block_index?: number | null
          created_at?: string
          id?: string
          late?: boolean
          method?: string | null
          product_id?: string | null
          qty?: number
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defcon_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      estudio_geracoes: {
        Row: {
          baixou: boolean
          baixou_em: string | null
          com_referencia: boolean
          cores: string | null
          criado_em: string
          estilo: string | null
          extras: string | null
          id: string
          imagem_url: string | null
          marca: string | null
          modelo_id: string | null
          origem: string
          plano: string
          produto: string | null
          provedor: string | null
          user_id: string
        }
        Insert: {
          baixou?: boolean
          baixou_em?: string | null
          com_referencia?: boolean
          cores?: string | null
          criado_em?: string
          estilo?: string | null
          extras?: string | null
          id?: string
          imagem_url?: string | null
          marca?: string | null
          modelo_id?: string | null
          origem?: string
          plano?: string
          produto?: string | null
          provedor?: string | null
          user_id: string
        }
        Update: {
          baixou?: boolean
          baixou_em?: string | null
          com_referencia?: boolean
          cores?: string | null
          criado_em?: string
          estilo?: string | null
          extras?: string | null
          id?: string
          imagem_url?: string | null
          marca?: string | null
          modelo_id?: string | null
          origem?: string
          plano?: string
          produto?: string | null
          provedor?: string | null
          user_id?: string
        }
        Relationships: []
      }
      estudio_modelos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          id: string
          imagem_b64: string | null
          imagem_url: string | null
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          id?: string
          imagem_b64?: string | null
          imagem_url?: string | null
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
          imagem_b64?: string | null
          imagem_url?: string | null
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      extrato_uploads: {
        Row: {
          created_at: string
          dia: string
          edicao_suspeita: boolean
          id: string
          motivo_edicao: string | null
          motor: string | null
          qtd_vendas: number
          tipo: string
          total_ignorado: number
          total_verificado: number
          updated_at: string
          user_id: string
          vendas: Json
        }
        Insert: {
          created_at?: string
          dia: string
          edicao_suspeita?: boolean
          id?: string
          motivo_edicao?: string | null
          motor?: string | null
          qtd_vendas?: number
          tipo: string
          total_ignorado?: number
          total_verificado?: number
          updated_at?: string
          user_id: string
          vendas?: Json
        }
        Update: {
          created_at?: string
          dia?: string
          edicao_suspeita?: boolean
          id?: string
          motivo_edicao?: string | null
          motor?: string | null
          qtd_vendas?: number
          tipo?: string
          total_ignorado?: number
          total_verificado?: number
          updated_at?: string
          user_id?: string
          vendas?: Json
        }
        Relationships: []
      }
      financas_dias: {
        Row: {
          alvo: number
          created_at: string
          data: string
          guardado: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alvo?: number
          created_at?: string
          data: string
          guardado?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alvo?: number
          created_at?: string
          data?: string
          guardado?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_goals: {
        Row: {
          created_at: string
          current_amount: number
          deadline: string | null
          icon: string | null
          id: string
          name: string
          percentual_distribuicao: number
          prazo: string | null
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
          percentual_distribuicao?: number
          prazo?: string | null
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
          percentual_distribuicao?: number
          prazo?: string | null
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
      hotmart_eventos: {
        Row: {
          afiliado_codigo: string | null
          afiliado_nome: string | null
          buyer_cpf: string | null
          buyer_email: string | null
          buyer_nome: string | null
          eh_renovacao: boolean | null
          event_id: string | null
          event_type: string | null
          id: string
          moeda: string | null
          origem_src: string | null
          payload: Json | null
          purchase_id: string | null
          recebido_em: string
          subscription_id: string | null
          user_id: string | null
          valor: number | null
        }
        Insert: {
          afiliado_codigo?: string | null
          afiliado_nome?: string | null
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_nome?: string | null
          eh_renovacao?: boolean | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          moeda?: string | null
          origem_src?: string | null
          payload?: Json | null
          purchase_id?: string | null
          recebido_em?: string
          subscription_id?: string | null
          user_id?: string | null
          valor?: number | null
        }
        Update: {
          afiliado_codigo?: string | null
          afiliado_nome?: string | null
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_nome?: string | null
          eh_renovacao?: boolean | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          moeda?: string | null
          origem_src?: string | null
          payload?: Json | null
          purchase_id?: string | null
          recebido_em?: string
          subscription_id?: string | null
          user_id?: string | null
          valor?: number | null
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
          ritmo_ideal_hora?: number
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
          lunch_ends_at: string | null
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
          valor_gorjeta: number | null
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
          lunch_ends_at?: string | null
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
          valor_gorjeta?: number | null
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
          lunch_ends_at?: string | null
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
          valor_gorjeta?: number | null
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
      ingredients: {
        Row: {
          alerts_enabled: boolean
          cost_per_unit: number
          created_at: string
          id: string
          name: string
          notes: string | null
          photo_url: string | null
          stock_min: number
          stock_quantity: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          cost_per_unit?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          photo_url?: string | null
          stock_min?: number
          stock_quantity?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
          cost_per_unit?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          photo_url?: string | null
          stock_min?: number
          stock_quantity?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      late_pix_entries: {
        Row: {
          amount: number
          created_at: string
          id: string
          metodo: string
          sale_date: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metodo?: string
          sale_date: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metodo?: string
          sale_date?: string
          user_id?: string
        }
        Relationships: []
      }
      leaderboard_stats: {
        Row: {
          avatar_url: string | null
          constancia_maior_streak: number
          constancia_streak_atual: number
          created_at: string
          dias_trabalhados_mes: number
          faturamento_pix_mes: number
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
          faturamento_pix_mes?: number
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
          faturamento_pix_mes?: number
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
      leads: {
        Row: {
          created_at: string | null
          email: string
          id: number
          nome: string
          ref: string | null
          whatsapp: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: number
          nome: string
          ref?: string | null
          whatsapp: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: number
          nome?: string
          ref?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      login_tentativas: {
        Row: {
          chave: string
          janela: string
          tentativas: number
        }
        Insert: {
          chave: string
          janela?: string
          tentativas?: number
        }
        Update: {
          chave?: string
          janela?: string
          tentativas?: number
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
      mp_conexoes: {
        Row: {
          access_token: string
          apelido: string | null
          ativo: boolean
          conectado_em: string
          expira_em: string
          mp_user_id: string
          provedor: string
          refresh_token: string | null
          ultima_sync_em: string | null
          ultimo_erro: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          apelido?: string | null
          ativo?: boolean
          conectado_em?: string
          expira_em: string
          mp_user_id: string
          provedor?: string
          refresh_token?: string | null
          ultima_sync_em?: string | null
          ultimo_erro?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          apelido?: string | null
          ativo?: boolean
          conectado_em?: string
          expira_em?: string
          mp_user_id?: string
          provedor?: string
          refresh_token?: string | null
          ultima_sync_em?: string | null
          ultimo_erro?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mp_interesse: {
        Row: {
          criado_em: string
          provedor: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          provedor: string
          user_id: string
        }
        Update: {
          criado_em?: string
          provedor?: string
          user_id?: string
        }
        Relationships: []
      }
      mp_oauth_states: {
        Row: {
          criado_em: string
          provedor: string
          state: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          provedor?: string
          state: string
          user_id: string
        }
        Update: {
          criado_em?: string
          provedor?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      mp_vendas: {
        Row: {
          criado_em: string
          data: string
          defcon_sale_id: string | null
          descricao: string | null
          ignorado: boolean
          lancado: boolean
          liquido: number | null
          metodo: string | null
          origem: string | null
          pago_em: string
          payment_id: string
          provedor: string
          status: string
          user_id: string
          valor: number
        }
        Insert: {
          criado_em?: string
          data: string
          defcon_sale_id?: string | null
          descricao?: string | null
          ignorado?: boolean
          lancado?: boolean
          liquido?: number | null
          metodo?: string | null
          origem?: string | null
          pago_em: string
          payment_id: string
          provedor?: string
          status: string
          user_id: string
          valor: number
        }
        Update: {
          criado_em?: string
          data?: string
          defcon_sale_id?: string | null
          descricao?: string | null
          ignorado?: boolean
          lancado?: boolean
          liquido?: number | null
          metodo?: string | null
          origem?: string | null
          pago_em?: string
          payment_id?: string
          provedor?: string
          status?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      onboarding_contatos: {
        Row: {
          chave: string
          contatado_em: string
          por: string | null
        }
        Insert: {
          chave: string
          contatado_em?: string
          por?: string | null
        }
        Update: {
          chave?: string
          contatado_em?: string
          por?: string | null
        }
        Relationships: []
      }
      onboarding_planos: {
        Row: {
          atualizado_em: string
          criado_em: string
          dias_semana: number
          hora_inicio: number | null
          horas_dia: number
          meta_mensal: number
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dias_semana: number
          hora_inicio?: number | null
          horas_dia: number
          meta_mensal: number
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dias_semana?: number
          hora_inicio?: number | null
          horas_dia?: number
          meta_mensal?: number
          user_id?: string
        }
        Relationships: []
      }
      orbis_bugs: {
        Row: {
          ai_analisado_em: string | null
          ai_causa: string | null
          ai_correcao: string | null
          ai_diagnostico: string | null
          ai_erro: string | null
          ai_severidade: string | null
          ai_status: string
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          reporter: string | null
          severidade: string
          status: string
          tela: string | null
          titulo: string
        }
        Insert: {
          ai_analisado_em?: string | null
          ai_causa?: string | null
          ai_correcao?: string | null
          ai_diagnostico?: string | null
          ai_erro?: string | null
          ai_severidade?: string | null
          ai_status?: string
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          reporter?: string | null
          severidade?: string
          status?: string
          tela?: string | null
          titulo: string
        }
        Update: {
          ai_analisado_em?: string | null
          ai_causa?: string | null
          ai_correcao?: string | null
          ai_diagnostico?: string | null
          ai_erro?: string | null
          ai_severidade?: string | null
          ai_status?: string
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          reporter?: string | null
          severidade?: string
          status?: string
          tela?: string | null
          titulo?: string
        }
        Relationships: []
      }
      orbis_correcoes: {
        Row: {
          campo: string | null
          de: string | null
          id: number
          motivo: string
          para: string | null
          quando: string
          registro: string
          tabela: string
        }
        Insert: {
          campo?: string | null
          de?: string | null
          id?: number
          motivo: string
          para?: string | null
          quando?: string
          registro: string
          tabela: string
        }
        Update: {
          campo?: string | null
          de?: string | null
          id?: number
          motivo?: string
          para?: string | null
          quando?: string
          registro?: string
          tabela?: string
        }
        Relationships: []
      }
      orbis_ficha: {
        Row: {
          abordagens_dia: number | null
          abordagens_por_venda: number | null
          atualizada_em: string
          calote_mes: number | null
          calote_pct: number | null
          constancia_pct: number | null
          conversao: number | null
          conversao_antes: number | null
          dias_com_calote: number | null
          dias_de_rua: number | null
          faturamento_dia: number | null
          faturamento_mes: number | null
          faturamento_semana: number | null
          gargalo: string | null
          horas_dia: number | null
          melhor_dia_semana: string | null
          melhor_dia_valor: number | null
          melhor_hora: number | null
          melhor_hora_conv: number | null
          nivel: string | null
          pct_cartao: number | null
          pct_dinheiro: number | null
          pct_pix: number | null
          ranking_antes: number | null
          ranking_direcao: string | null
          ranking_posicao: number | null
          resumo: string | null
          tendencia: string | null
          ticket: number | null
          user_id: string
          vendas_dia: number | null
        }
        Insert: {
          abordagens_dia?: number | null
          abordagens_por_venda?: number | null
          atualizada_em?: string
          calote_mes?: number | null
          calote_pct?: number | null
          constancia_pct?: number | null
          conversao?: number | null
          conversao_antes?: number | null
          dias_com_calote?: number | null
          dias_de_rua?: number | null
          faturamento_dia?: number | null
          faturamento_mes?: number | null
          faturamento_semana?: number | null
          gargalo?: string | null
          horas_dia?: number | null
          melhor_dia_semana?: string | null
          melhor_dia_valor?: number | null
          melhor_hora?: number | null
          melhor_hora_conv?: number | null
          nivel?: string | null
          pct_cartao?: number | null
          pct_dinheiro?: number | null
          pct_pix?: number | null
          ranking_antes?: number | null
          ranking_direcao?: string | null
          ranking_posicao?: number | null
          resumo?: string | null
          tendencia?: string | null
          ticket?: number | null
          user_id: string
          vendas_dia?: number | null
        }
        Update: {
          abordagens_dia?: number | null
          abordagens_por_venda?: number | null
          atualizada_em?: string
          calote_mes?: number | null
          calote_pct?: number | null
          constancia_pct?: number | null
          conversao?: number | null
          conversao_antes?: number | null
          dias_com_calote?: number | null
          dias_de_rua?: number | null
          faturamento_dia?: number | null
          faturamento_mes?: number | null
          faturamento_semana?: number | null
          gargalo?: string | null
          horas_dia?: number | null
          melhor_dia_semana?: string | null
          melhor_dia_valor?: number | null
          melhor_hora?: number | null
          melhor_hora_conv?: number | null
          nivel?: string | null
          pct_cartao?: number | null
          pct_dinheiro?: number | null
          pct_pix?: number | null
          ranking_antes?: number | null
          ranking_direcao?: string | null
          ranking_posicao?: number | null
          resumo?: string | null
          tendencia?: string | null
          ticket?: number | null
          user_id?: string
          vendas_dia?: number | null
        }
        Relationships: []
      }
      orbis_pro: {
        Row: {
          assinante_codigo: string | null
          ativo: boolean
          atualizado_em: string
          cancelado_em: string | null
          expira_em: string | null
          iniciado_em: string
          origem: string
          produto_id: string | null
          user_id: string
        }
        Insert: {
          assinante_codigo?: string | null
          ativo?: boolean
          atualizado_em?: string
          cancelado_em?: string | null
          expira_em?: string | null
          iniciado_em?: string
          origem?: string
          produto_id?: string | null
          user_id: string
        }
        Update: {
          assinante_codigo?: string | null
          ativo?: boolean
          atualizado_em?: string
          cancelado_em?: string | null
          expira_em?: string | null
          iniciado_em?: string
          origem?: string
          produto_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      orbis_pulso: {
        Row: {
          detalhe: string | null
          dia: string
          em: string
          id: number
          segundos: number | null
          sessao: string
          tela: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          detalhe?: string | null
          dia?: string
          em?: string
          id?: number
          segundos?: number | null
          sessao: string
          tela?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          detalhe?: string | null
          dia?: string
          em?: string
          id?: number
          segundos?: number | null
          sessao?: string
          tela?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      painel_tokens: {
        Row: {
          criado_em: string
          nome: string
          token: string
          trocado_em: string | null
        }
        Insert: {
          criado_em?: string
          nome: string
          token: string
          trocado_em?: string | null
        }
        Update: {
          criado_em?: string
          nome?: string
          token?: string
          trocado_em?: string | null
        }
        Relationships: []
      }
      parceiros: {
        Row: {
          code: string
          comissao: number
          created_at: string | null
          id: string
          nome: string
          recorrente: boolean
          tipo: string
          token: string
        }
        Insert: {
          code: string
          comissao?: number
          created_at?: string | null
          id?: string
          nome: string
          recorrente?: boolean
          tipo?: string
          token?: string
        }
        Update: {
          code?: string
          comissao?: number
          created_at?: string | null
          id?: string
          nome?: string
          recorrente?: boolean
          tipo?: string
          token?: string
        }
        Relationships: []
      }
      pb_aplicacao: {
        Row: {
          account_id: string | null
          ambiente: string
          atualizada_em: string
          bruto: Json | null
          client_id: string | null
          client_secret: string | null
          criada_em: string
          id: string
          redirect_uri: string | null
        }
        Insert: {
          account_id?: string | null
          ambiente?: string
          atualizada_em?: string
          bruto?: Json | null
          client_id?: string | null
          client_secret?: string | null
          criada_em?: string
          id?: string
          redirect_uri?: string | null
        }
        Update: {
          account_id?: string | null
          ambiente?: string
          atualizada_em?: string
          bruto?: Json | null
          client_id?: string | null
          client_secret?: string | null
          criada_em?: string
          id?: string
          redirect_uri?: string | null
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
      planned_bills: {
        Row: {
          amount: number
          created_at: string
          cycles_paid: number
          due_date: string | null
          duration_months: number | null
          file_path: string | null
          id: string
          installments: number | null
          is_credit_card: boolean
          name: string
          paid: boolean
          paid_cycle: string | null
          payment_code: string | null
          recurring: boolean | null
          risco: string
          saved_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          cycles_paid?: number
          due_date?: string | null
          duration_months?: number | null
          file_path?: string | null
          id?: string
          installments?: number | null
          is_credit_card?: boolean
          name: string
          paid?: boolean
          paid_cycle?: string | null
          payment_code?: string | null
          recurring?: boolean | null
          risco?: string
          saved_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          cycles_paid?: number
          due_date?: string | null
          duration_months?: number | null
          file_path?: string | null
          id?: string
          installments?: number | null
          is_credit_card?: boolean
          name?: string
          paid?: boolean
          paid_cycle?: string | null
          payment_code?: string | null
          recurring?: boolean | null
          risco?: string
          saved_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_config: {
        Row: {
          atualizado_em: string
          id: string
          webhook_id: string | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          atualizado_em?: string
          id?: string
          webhook_id?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          atualizado_em?: string
          id?: string
          webhook_id?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      processed_hotmart_events: {
        Row: {
          event_id: string
          event_type: string | null
          processed_at: string
          purchase_id: string | null
        }
        Insert: {
          event_id: string
          event_type?: string | null
          processed_at?: string
          purchase_id?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string | null
          processed_at?: string
          purchase_id?: string | null
        }
        Relationships: []
      }
      product_price_tiers: {
        Row: {
          created_at: string
          id: string
          price: number
          product_id: string
          qty: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price: number
          product_id: string
          qty: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          product_id?: string
          qty?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipes: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: []
      }
      product_sales_log: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          total_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      production_batches: {
        Row: {
          batches_count: number
          created_at: string
          id: string
          notes: string | null
          product_id: string
          units_produced: number
          user_id: string
        }
        Insert: {
          batches_count?: number
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          units_produced?: number
          user_id: string
        }
        Update: {
          batches_count?: number
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          units_produced?: number
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          batch_yield: number
          cost: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          low_stock_alerts_enabled: boolean
          name: string
          open_price: boolean
          photo_url: string | null
          pix_account_id: string | null
          recipe_mode: string
          sale_price: number
          stock_min: number
          stock_quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_yield?: number
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          low_stock_alerts_enabled?: boolean
          name: string
          open_price?: boolean
          photo_url?: string | null
          pix_account_id?: string | null
          recipe_mode?: string
          sale_price?: number
          stock_min?: number
          stock_quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_yield?: number
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          low_stock_alerts_enabled?: boolean
          name?: string
          open_price?: boolean
          photo_url?: string | null
          pix_account_id?: string | null
          recipe_mode?: string
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
          avatar_url: string | null
          base_daily_goal: number | null
          billing_exempt: boolean | null
          bio: string | null
          check_in_focus: string | null
          check_in_mood: string | null
          check_in_start_time: string | null
          city: string | null
          comp_label: string | null
          compartilha_pontos: boolean | null
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
          instagram: string | null
          is_demo: boolean | null
          is_trial_active: boolean | null
          last_check_in_date: string | null
          last_payment_date: string | null
          metas_modo: string
          missed_days_this_week: number | null
          monthly_goal: number | null
          must_change_password: boolean | null
          next_payment_date: string | null
          nickname: string | null
          onboarding_completed: boolean
          onboarding_step: number
          origem_fixada_em: string | null
          origem_ref: string | null
          payment_status: string | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          pix_merchant_city: string | null
          pix_merchant_name: string | null
          plan_status: string | null
          plan_type: string | null
          ranking_hidden: boolean
          ranking_oculto: boolean
          show_city: boolean
          show_instagram: boolean
          show_whatsapp: boolean
          state: string | null
          streak_days: number | null
          subscription_id: string | null
          tax_atividade: string | null
          tax_cnpj: string | null
          tax_situacao: string | null
          termos_aceitos_em: string | null
          termos_aceitos_versao: string | null
          trial_days_remaining: number | null
          trial_end: string | null
          trial_start: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
          verificado: boolean
          verificado_em: string | null
          verificado_por: string | null
          vision_points: number | null
          week_start_date: string | null
          weekly_goal: number | null
          weekly_work_days: number | null
          what_i_sell: string | null
          whatsapp_public: string | null
          where_i_sell: string | null
          working_days: string[] | null
        }
        Insert: {
          avatar_url?: string | null
          base_daily_goal?: number | null
          billing_exempt?: boolean | null
          bio?: string | null
          check_in_focus?: string | null
          check_in_mood?: string | null
          check_in_start_time?: string | null
          city?: string | null
          comp_label?: string | null
          compartilha_pontos?: boolean | null
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
          instagram?: string | null
          is_demo?: boolean | null
          is_trial_active?: boolean | null
          last_check_in_date?: string | null
          last_payment_date?: string | null
          metas_modo?: string
          missed_days_this_week?: number | null
          monthly_goal?: number | null
          must_change_password?: boolean | null
          next_payment_date?: string | null
          nickname?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          origem_fixada_em?: string | null
          origem_ref?: string | null
          payment_status?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          plan_status?: string | null
          plan_type?: string | null
          ranking_hidden?: boolean
          ranking_oculto?: boolean
          show_city?: boolean
          show_instagram?: boolean
          show_whatsapp?: boolean
          state?: string | null
          streak_days?: number | null
          subscription_id?: string | null
          tax_atividade?: string | null
          tax_cnpj?: string | null
          tax_situacao?: string | null
          termos_aceitos_em?: string | null
          termos_aceitos_versao?: string | null
          trial_days_remaining?: number | null
          trial_end?: string | null
          trial_start?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
          verificado?: boolean
          verificado_em?: string | null
          verificado_por?: string | null
          vision_points?: number | null
          week_start_date?: string | null
          weekly_goal?: number | null
          weekly_work_days?: number | null
          what_i_sell?: string | null
          whatsapp_public?: string | null
          where_i_sell?: string | null
          working_days?: string[] | null
        }
        Update: {
          avatar_url?: string | null
          base_daily_goal?: number | null
          billing_exempt?: boolean | null
          bio?: string | null
          check_in_focus?: string | null
          check_in_mood?: string | null
          check_in_start_time?: string | null
          city?: string | null
          comp_label?: string | null
          compartilha_pontos?: boolean | null
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
          instagram?: string | null
          is_demo?: boolean | null
          is_trial_active?: boolean | null
          last_check_in_date?: string | null
          last_payment_date?: string | null
          metas_modo?: string
          missed_days_this_week?: number | null
          monthly_goal?: number | null
          must_change_password?: boolean | null
          next_payment_date?: string | null
          nickname?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          origem_fixada_em?: string | null
          origem_ref?: string | null
          payment_status?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          plan_status?: string | null
          plan_type?: string | null
          ranking_hidden?: boolean
          ranking_oculto?: boolean
          show_city?: boolean
          show_instagram?: boolean
          show_whatsapp?: boolean
          state?: string | null
          streak_days?: number | null
          subscription_id?: string | null
          tax_atividade?: string | null
          tax_cnpj?: string | null
          tax_situacao?: string | null
          termos_aceitos_em?: string | null
          termos_aceitos_versao?: string | null
          trial_days_remaining?: number | null
          trial_end?: string | null
          trial_start?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
          verificado?: boolean
          verificado_em?: string | null
          verificado_por?: string | null
          vision_points?: number | null
          week_start_date?: string | null
          weekly_goal?: number | null
          weekly_work_days?: number | null
          what_i_sell?: string | null
          whatsapp_public?: string | null
          where_i_sell?: string | null
          working_days?: string[] | null
        }
        Relationships: []
      }
      radar_asset: {
        Row: {
          chunk: string
          id: number
        }
        Insert: {
          chunk: string
          id: number
        }
        Update: {
          chunk?: string
          id?: number
        }
        Relationships: []
      }
      ranking_eventos: {
        Row: {
          created_at: string
          id: string
          mes_referencia: string
          outro_avatar: string | null
          outro_nome: string | null
          outro_user_id: string | null
          posicao_antes: number | null
          posicao_depois: number | null
          tipo: string
          user_id: string
          visto_em: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mes_referencia: string
          outro_avatar?: string | null
          outro_nome?: string | null
          outro_user_id?: string | null
          posicao_antes?: number | null
          posicao_depois?: number | null
          tipo: string
          user_id: string
          visto_em?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mes_referencia?: string
          outro_avatar?: string | null
          outro_nome?: string | null
          outro_user_id?: string | null
          posicao_antes?: number | null
          posicao_depois?: number | null
          tipo?: string
          user_id?: string
          visto_em?: string | null
        }
        Relationships: []
      }
      ranking_moderacao: {
        Row: {
          acao: string
          admin_id: string
          created_at: string
          faturamento_zerado: number | null
          id: string
          motivo: string | null
          user_id: string
        }
        Insert: {
          acao: string
          admin_id: string
          created_at?: string
          faturamento_zerado?: number | null
          id?: string
          motivo?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          admin_id?: string
          created_at?: string
          faturamento_zerado?: number | null
          id?: string
          motivo?: string | null
          user_id?: string
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
      setup_nonces: {
        Row: {
          criado_em: string
          nonce: string
          para: string
          usado_em: string | null
        }
        Insert: {
          criado_em?: string
          nonce: string
          para: string
          usado_em?: string | null
        }
        Update: {
          criado_em?: string
          nonce?: string
          para?: string
          usado_em?: string | null
        }
        Relationships: []
      }
      spot_feedback: {
        Row: {
          city: string | null
          comment: string | null
          created_at: string
          id: string
          place_id: string
          place_name: string
          rating: string
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          place_id: string
          place_name: string
          rating: string
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          place_id?: string
          place_name?: string
          rating?: string
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      spot_finder_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          result: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          result: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          result?: Json
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
      user_presence: {
        Row: {
          last_active_at: string
          user_id: string
        }
        Insert: {
          last_active_at?: string
          user_id: string
        }
        Update: {
          last_active_at?: string
          user_id?: string
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
          meta_dia?: number
          planning_date: string
          ritmo_ideal_inicial?: number
          start_timestamp?: string
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
      x1_challenges: {
        Row: {
          challenger_id: string
          challenger_paid: boolean
          challenger_pix: string | null
          challenger_pix_nome: string | null
          challenger_proof_url: string | null
          challenger_score: number | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          fee_amount: number
          goal_amount: number | null
          id: string
          last_proposed_by: string | null
          liga_min_rank: number | null
          modo: string | null
          money_status: string
          opponent_id: string | null
          opponent_paid: boolean
          opponent_pix: string | null
          opponent_pix_nome: string | null
          opponent_proof_url: string | null
          opponent_score: number | null
          pix_account: string | null
          prize_amount: number
          result_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_date: string | null
          stakes_amount: number
          status: string
          tipo: string
          updated_at: string
          winner_user_id: string | null
        }
        Insert: {
          challenger_id: string
          challenger_paid?: boolean
          challenger_pix?: string | null
          challenger_pix_nome?: string | null
          challenger_proof_url?: string | null
          challenger_score?: number | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          fee_amount?: number
          goal_amount?: number | null
          id?: string
          last_proposed_by?: string | null
          liga_min_rank?: number | null
          modo?: string | null
          money_status?: string
          opponent_id?: string | null
          opponent_paid?: boolean
          opponent_pix?: string | null
          opponent_pix_nome?: string | null
          opponent_proof_url?: string | null
          opponent_score?: number | null
          pix_account?: string | null
          prize_amount?: number
          result_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_date?: string | null
          stakes_amount?: number
          status?: string
          tipo?: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Update: {
          challenger_id?: string
          challenger_paid?: boolean
          challenger_pix?: string | null
          challenger_pix_nome?: string | null
          challenger_proof_url?: string | null
          challenger_score?: number | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          fee_amount?: number
          goal_amount?: number | null
          id?: string
          last_proposed_by?: string | null
          liga_min_rank?: number | null
          modo?: string | null
          money_status?: string
          opponent_id?: string | null
          opponent_paid?: boolean
          opponent_pix?: string | null
          opponent_pix_nome?: string | null
          opponent_proof_url?: string | null
          opponent_score?: number | null
          pix_account?: string | null
          prize_amount?: number
          result_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_date?: string | null
          stakes_amount?: number
          status?: string
          tipo?: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Relationships: []
      }
      x1_deposit_requests: {
        Row: {
          created_at: string
          data_pix: string | null
          e2e_id: string | null
          id: string
          motivo: string | null
          motor: string | null
          remetente: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_pix?: string | null
          e2e_id?: string | null
          id?: string
          motivo?: string | null
          motor?: string | null
          remetente?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data_pix?: string | null
          e2e_id?: string | null
          id?: string
          motivo?: string | null
          motor?: string | null
          remetente?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      x1_missoes_feitas: {
        Row: {
          feita_em: string
          semana: string
          tipo: string
          user_id: string
        }
        Insert: {
          feita_em?: string
          semana: string
          tipo: string
          user_id: string
        }
        Update: {
          feita_em?: string
          semana?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      x1_mp_payments: {
        Row: {
          created_at: string
          credited_at: string | null
          payment_id: string
          status: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          credited_at?: string | null
          payment_id: string
          status?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          credited_at?: string | null
          payment_id?: string
          status?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      x1_settings: {
        Row: {
          fee_flat: number
          fee_percent: number
          id: number
          notes: string | null
          pix_account: string | null
          updated_at: string
        }
        Insert: {
          fee_flat?: number
          fee_percent?: number
          id?: number
          notes?: string | null
          pix_account?: string | null
          updated_at?: string
        }
        Update: {
          fee_flat?: number
          fee_percent?: number
          id?: number
          notes?: string | null
          pix_account?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      x1_torcida: {
        Row: {
          challenge_id: string
          created_at: string
          lado: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          lado: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          lado?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "x1_torcida_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "x1_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      x1_wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          tipo: string
          user_id: string
          x1_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          tipo: string
          user_id: string
          x1_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          tipo?: string
          user_id?: string
          x1_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "x1_wallet_transactions_x1_id_fkey"
            columns: ["x1_id"]
            isOneToOne: false
            referencedRelation: "x1_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      x1_wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      x1_withdraw_requests: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          pix_key: string
          pix_nome: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          pix_key: string
          pix_nome?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          pix_key?: string
          pix_nome?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      crm_lead_pessoa: {
        Row: {
          chave: string | null
          emails: string[] | null
          envios: number | null
          lead_id_recente: number | null
          primeiro_contato: string | null
          ref: string | null
          tel8: string | null
          ultimo_contato: string | null
          user_id: string | null
        }
        Relationships: []
      }
      crm_leads_por_ref: {
        Row: {
          leads: number | null
          ref: string | null
        }
        Relationships: []
      }
      orbis_atribuicao: {
        Row: {
          code: string | null
          prova: string | null
          user_id: string | null
        }
        Relationships: []
      }
      orbis_hotmart_assinatura: {
        Row: {
          aprovado_em: string | null
          assinante_codigo: string | null
          cpf: string | null
          dias_pra_cobrar: number | null
          email: string | null
          forma_pagamento: string | null
          nome: string | null
          oferta_codigo: string | null
          origem: string | null
          origem_compra: string | null
          plano: string | null
          proxima_cobranca: string | null
          recorrencia_n: number | null
          situacao: string | null
          status_hotmart: string | null
          subscription_id: string | null
          telefone: string | null
          ultimo_evento: string | null
          ultimo_evento_em: string | null
          user_id: string | null
          valor: number | null
        }
        Relationships: []
      }
      orbis_hotmart_pessoa: {
        Row: {
          aprovado_em: string | null
          assinante_codigo: string | null
          chave: string | null
          cpf: string | null
          dias_pra_cobrar: number | null
          email: string | null
          forma_pagamento: string | null
          nome: string | null
          oferta_codigo: string | null
          origem: string | null
          origem_compra: string | null
          plano: string | null
          prio: number | null
          proxima_cobranca: string | null
          recorrencia_n: number | null
          situacao: string | null
          status_hotmart: string | null
          subscription_id: string | null
          telefone: string | null
          ultimo_evento: string | null
          ultimo_evento_em: string | null
          user_id: string | null
          valor: number | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          instagram: string | null
          nickname: string | null
          show_city: boolean | null
          show_instagram: boolean | null
          show_whatsapp: boolean | null
          state: string | null
          streak_days: number | null
          user_id: string | null
          verificado: boolean | null
          vision_points: number | null
          what_i_sell: string | null
          whatsapp_public: string | null
          where_i_sell: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: never
          instagram?: never
          nickname?: string | null
          show_city?: boolean | null
          show_instagram?: boolean | null
          show_whatsapp?: boolean | null
          state?: never
          streak_days?: number | null
          user_id?: string | null
          verificado?: never
          vision_points?: number | null
          what_i_sell?: string | null
          whatsapp_public?: never
          where_i_sell?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: never
          instagram?: never
          nickname?: string | null
          show_city?: boolean | null
          show_instagram?: boolean | null
          show_whatsapp?: boolean | null
          state?: never
          streak_days?: number | null
          user_id?: string | null
          verificado?: never
          vision_points?: number | null
          what_i_sell?: string | null
          whatsapp_public?: never
          where_i_sell?: string | null
        }
        Relationships: []
      }
      vw_custos_ia_dia: {
        Row: {
          chamadas: number | null
          dia: string | null
          servico: string | null
          usd: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _crm_abriu_o_app: { Args: { p_user: string }; Returns: boolean }
      _crm_ajusta_datas: { Args: never; Returns: number }
      _crm_suporte_lista_interno: { Args: never; Returns: Json }
      admin_approve_statement: {
        Args: { p_statement_id: string; p_value: number }
        Returns: undefined
      }
      admin_corrigir_resultado_dia: {
        Args: { p_novo_total: number; p_sale_id: string }
        Returns: Json
      }
      admin_delete_competition: { Args: { p_id: string }; Returns: undefined }
      admin_delete_x1: { Args: { p_id: string }; Returns: undefined }
      admin_excluir_do_ranking: {
        Args: { motivo?: string; target: string }
        Returns: Json
      }
      admin_ficha_usuario: { Args: { target: string }; Returns: Json }
      admin_remover_resultado_dia: {
        Args: { p_sale_id: string }
        Returns: undefined
      }
      admin_reset_user_password: {
        Args: { p_user_id: string }
        Returns: string
      }
      admin_resync_leaderboard: {
        Args: { p_mes: string; p_user: string }
        Returns: undefined
      }
      admin_set_competition_pin: {
        Args: { p_id: string; p_pinned: boolean }
        Returns: undefined
      }
      admin_set_verificado: {
        Args: { p_target: string; p_valor: boolean }
        Returns: undefined
      }
      admin_update_competition: {
        Args: { p_data: Json; p_id: string }
        Returns: undefined
      }
      apagar_dados_do_usuario: { Args: { p_user: string }; Returns: Json }
      banco_conceder_selo: { Args: { p_user: string }; Returns: boolean }
      banco_pix_do_dia: {
        Args: { p_dia?: string }
        Returns: {
          banco: string
          qtd: number
          status: string
          tem_banco: boolean
          total: number
          ultima_sync: string
        }[]
      }
      beta_vagas_preenchidas: { Args: never; Returns: number }
      brl: { Args: { v: number }; Returns: string }
      bump_ai_usage: {
        Args: { p_feature: string; p_limit: number }
        Returns: Json
      }
      caca_buscar_lugar: {
        Args: { p_city: string; p_termo: string; p_uf: string }
        Returns: {
          exemplo: string
          lat: number
          lng: number
          total: number
        }[]
      }
      caca_cidade_centro: {
        Args: { p_city: string; p_uf: string }
        Returns: {
          lat: number
          lng: number
          total: number
        }[]
      }
      caca_cidades: {
        Args: never
        Returns: {
          cidade: string
          total: number
          uf: string
        }[]
      }
      caca_sinais_proximos: {
        Args: { p_lat: number; p_lng: number; p_raio_km?: number }
        Returns: {
          atualizado_em: string
          cidade: string | null
          criado_em: string
          fonte: string
          id: string
          lat: number
          lng: number
          osm_id: number | null
          uf: string | null
          vias: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "caca_sinais"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      caca_sinais_proximos_nome: {
        Args: { p_lat: number; p_lng: number; p_raio_km?: number }
        Returns: {
          distancia_m: number
          lat: number
          lng: number
          osm_id: number
          vias: string
        }[]
      }
      caca_sinais_quentes: {
        Args: { p_lat: number; p_lng: number; p_raio_km?: number }
        Returns: {
          bom: number
          densidade: number
          distancia_km: number
          duracao: string
          duracao_votos: number
          horas: number[]
          lat: number
          lng: number
          medio: number
          minutos: number
          osm_id: number
          rs_hora: number
          ruim: number
          score: number
          sessoes: number
          total: number
          vendedores: number
          vias: string
        }[]
      }
      caca_sinais_sem_nome: {
        Args: { p_limit?: number }
        Returns: {
          lat: number
          lng: number
          osm_id: number
        }[]
      }
      caca_sinal_meus: {
        Args: never
        Returns: {
          dias: number
          lat: number
          lng: number
          melhor_dia_semana: number
          melhor_hora: number
          minutos: number
          osm_id: number
          rs_hora: number
          total: number
          ultima_data: string
          vias: string
        }[]
      }
      cadastro_pode_tentar: {
        Args: { p_chave: string; p_janela_min?: number; p_teto?: number }
        Returns: boolean
      }
      check_signup_available:
        | { Args: { p_email: string; p_phone: string }; Returns: string }
        | {
            Args: { p_cpf?: string; p_email: string; p_phone: string }
            Returns: string
          }
      check_trial_expired: { Args: { user_uuid: string }; Returns: boolean }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      clima_meu_aprendizado: { Args: never; Returns: Json }
      clima_painel: { Args: never; Returns: Json }
      cobranca_cancelar: { Args: { p_id: string }; Returns: boolean }
      cobranca_registrar_paga: {
        Args: {
          p_id: string
          p_pago_em?: string
          p_payment_id?: string
          p_valor?: number
        }
        Returns: Json
      }
      cobrancas_do_dia: {
        Args: { p_data?: string }
        Returns: {
          client_id: string
          cobranca_id: string
          cobranca_link: string
          cobranca_status: string
          cobranca_valor: number
          hora: string
          metodo: string
          nome: string
          telefone: string
          valor: number
        }[]
      }
      cobrancas_resumo: {
        Args: never
        Returns: {
          pagas_mes: number
          pendentes: number
          pendentes_valor: number
          recuperado_mes: number
        }[]
      }
      cobrancas_vencer: { Args: never; Returns: number }
      competition_ranking: {
        Args: { p_id: string }
        Returns: {
          avatar_url: string
          dias: number
          faturamento: number
          nome_usuario: string
          user_id: string
        }[]
      }
      conexao_conceder_selo: { Args: { p_user: string }; Returns: boolean }
      conexao_revisar_selo: { Args: { p_user: string }; Returns: undefined }
      cpf_valido: { Args: { c: string }; Returns: boolean }
      crm_conversas_lista: { Args: never; Returns: Json }
      crm_faturamento: { Args: never; Returns: Json }
      crm_funil: { Args: { p_pipeline: string }; Returns: Json }
      crm_hotmart_lista: { Args: never; Returns: Json }
      crm_mover: {
        Args: { p_cartao: number; p_etapa: string; p_status?: string }
        Returns: undefined
      }
      crm_msg_gravar: {
        Args: { p_cartao: number; p_de: string; p_texto: string }
        Returns: Json
      }
      crm_nota: {
        Args: { p_cartao: number; p_nota: string }
        Returns: undefined
      }
      crm_numeros: { Args: never; Returns: Json }
      crm_parceiro_salvar: {
        Args: {
          p_code: string
          p_comissao?: number
          p_nome: string
          p_recorrente?: boolean
          p_tipo?: string
        }
        Returns: Json
      }
      crm_parceiros: { Args: never; Returns: Json }
      crm_relatorio_mensal: { Args: never; Returns: Json }
      crm_resumo: { Args: never; Returns: Json }
      crm_suporte_lista: { Args: never; Returns: Json }
      crm_sync: { Args: never; Returns: Json }
      crm_sync_base: { Args: never; Returns: Json }
      crm_tarefa: {
        Args: { p_cartao: number; p_feito: boolean; p_tarefa: number }
        Returns: undefined
      }
      defcon_anomaly_suspects: {
        Args: { p_lookback?: number; p_min_ratio?: number }
        Returns: {
          base_media: number
          dia: string
          nome: string
          ratio: number
          ritmo: number
          user_id: string
          valor_hoje: number
          worked_min: number
        }[]
      }
      defcon_diagnostico: {
        Args: {
          p_abordagens_bloco?: number
          p_bloco?: number
          p_valor_bloco?: number
          p_vendas_bloco?: number
        }
        Returns: Json
      }
      defcon_encerrar_abandonadas: { Args: never; Returns: number }
      defcon_user_history: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          calote: number
          dia: string
          gorjeta: number
          min_intervalo_seg: number
          qtd: number
          ritmo: number
          ticket_medio: number
          valor: number
          worked_min: number
        }[]
      }
      dia_pt: { Args: { d: string }; Returns: string }
      expire_overdue_subscriptions: { Args: never; Returns: number }
      filter_profanity: { Args: { input_text: string }; Returns: string }
      get_user_winnings: { Args: { p_user: string }; Returns: Json }
      get_weekly_ranking:
        | {
            Args: { p_week_start: string }
            Returns: {
              avatar_url: string
              dias_semana: number
              faturamento_semana: number
              nome_usuario: string
              user_id: string
            }[]
          }
        | {
            Args: { p_week_end: string; p_week_start: string }
            Returns: {
              avatar_url: string
              dias_semana: number
              faturamento_semana: number
              nome_usuario: string
              user_id: string
            }[]
          }
      get_weekly_ranking_verified: {
        Args: {
          p_usar_extrato?: boolean
          p_week_end: string
          p_week_start: string
        }
        Returns: {
          avatar_url: string
          dias_semana: number
          faturamento_semana: number
          nome_usuario: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_orbis_admin: { Args: never; Returns: boolean }
      is_orbis_crm: { Args: never; Returns: boolean }
      is_orbis_dono: { Args: never; Returns: boolean }
      is_orbis_super_admin: { Args: never; Returns: boolean }
      leads_assinantes_no_app: { Args: never; Returns: string[] }
      leads_registrados_no_app: { Args: never; Returns: string[] }
      lista_assinantes: {
        Args: never
        Returns: {
          comp_label: string
          email: string
          nome: string
        }[]
      }
      lista_cortesias: {
        Args: never
        Returns: {
          comp_label: string
          email: string
          nome: string
        }[]
      }
      marcar_arte_baixada: {
        Args: { p_id?: string; p_url?: string }
        Returns: boolean
      }
      mp_comprovado: {
        Args: { p_data: string; p_user: string }
        Returns: number
      }
      mp_conciliacao_dia: {
        Args: { p_data?: string }
        Returns: {
          a_mais: number
          cartao_caiu: number
          cartao_declarado: number
          conectado: boolean
          data: string
          dinheiro: number
          gorjeta: number
          nao_caiu: number
          pix_caiu: number
          pix_declarado: number
          total_caiu: number
          total_declarado: number
          ultima_sync_em: string
          vendas_nao_lancadas: number
        }[]
      }
      mp_conciliacao_mes: {
        Args: { p_mes?: string }
        Returns: {
          cartao_caiu: number
          cartao_declarado: number
          conectado: boolean
          dias_com_furo: number
          dinheiro: number
          mes: string
          nao_caiu: number
          pior_dia: string
          pior_valor: number
          pix_caiu: number
          pix_declarado: number
          total_caiu: number
          total_declarado: number
        }[]
      }
      mp_conexoes_lista: {
        Args: never
        Returns: {
          apelido: string
          conectado_em: string
          erro: string
          provedor: string
          ultima_sync_em: string
        }[]
      }
      mp_desconectar: { Args: { p_provedor?: string }; Returns: undefined }
      mp_fila: {
        Args: never
        Returns: {
          eu: boolean
          pessoas: number
          provedor: string
        }[]
      }
      mp_ignorar_venda: { Args: { p_id: string }; Returns: undefined }
      mp_lancar_vendas: { Args: { p_ids: string[] }; Returns: number }
      mp_quero: { Args: { p_provedor: string }; Returns: undefined }
      mp_status: {
        Args: never
        Returns: {
          apelido: string
          conectado: boolean
          conectado_em: string
          erro: string
          pendentes: number
          pendentes_valor: number
          provedores: string[]
          recebido_hoje: number
          ultima_sync_em: string
          vendas_hoje: number
          verificado: boolean
        }[]
      }
      mp_vendas_pendentes: {
        Args: { p_dias?: number }
        Returns: {
          data: string
          descricao: string
          metodo: string
          origem: string
          pago_em: string
          payment_id: string
          provedor: string
          valor: number
        }[]
      }
      orbis_achar_usuario: {
        Args: { p_cpf: string; p_email: string }
        Returns: string
      }
      orbis_alinha_trial: { Args: never; Returns: number }
      orbis_cerebro_noturno: { Args: never; Returns: Json }
      orbis_cofre: { Args: { p_user?: string }; Returns: string }
      orbis_conhecimento: { Args: never; Returns: string }
      orbis_conta_por_cpf: {
        Args: { p_cpf: string }
        Returns: {
          confirmada: boolean
          user_id: string
        }[]
      }
      orbis_dias_trabalhados: { Args: { p_desde?: string }; Returns: string[] }
      orbis_ficha_recalcular: { Args: never; Returns: number }
      orbis_fone_chave: { Args: { p: string }; Returns: string }
      orbis_gasto_global_hoje: { Args: never; Returns: number }
      orbis_gasto_usuario_hoje: { Args: { p_user: string }; Returns: number }
      orbis_is_admin_user: { Args: { p_user: string }; Returns: boolean }
      orbis_limites: { Args: never; Returns: Json }
      orbis_minerar_dados: { Args: never; Returns: Json }
      orbis_padroes_recalcular: { Args: never; Returns: Json }
      orbis_painel_periodo: {
        Args: { p_comissao?: number; p_fim: string; p_inicio: string }
        Returns: Json
      }
      orbis_papel: { Args: never; Returns: string }
      orbis_pro_ativo: { Args: { p_user?: string }; Returns: boolean }
      orbis_pro_status: {
        Args: never
        Returns: {
          ate: string
          bancos: number
          desde: string
          origem: string
          pro: boolean
          verificado: boolean
        }[]
      }
      orbis_public_stats: { Args: never; Returns: Json }
      orbis_pulso_faxina: { Args: never; Returns: number }
      orbis_pulso_leitura: { Args: { p_dias?: number }; Returns: Json }
      orbis_saude_ia: { Args: never; Returns: Json }
      orbis_subir_dia_offline: {
        Args: {
          p_approaches: number
          p_daily_goal: number
          p_date: string
          p_ended_at: string
          p_sales: Json
          p_started_at: string
        }
        Returns: string
      }
      orbis_uso_mes: {
        Args: { p_feature: string; p_user: string }
        Returns: number
      }
      painel_parceiro: {
        Args: { p_fim?: string; p_ini?: string; p_token: string }
        Returns: Json
      }
      parceiros_painel: {
        Args: { p_fim: string; p_ini: string }
        Returns: Json
      }
      parceiros_resumo: { Args: { p_mes?: string }; Returns: Json }
      pro_conceder: {
        Args: {
          p_ate?: string
          p_codigo?: string
          p_origem?: string
          p_produto?: string
          p_user: string
        }
        Returns: boolean
      }
      pro_revogar: { Args: { p_user: string }; Returns: boolean }
      ranking_definir_oculto: { Args: { p_oculto: boolean }; Returns: boolean }
      ranking_suspeitos: {
        Args: never
        Returns: {
          motivo: string
          user_id: string
        }[]
      }
      recalc_custo_produtos_do_ingrediente: {
        Args: { p_ingredient_id: string }
        Returns: undefined
      }
      recalculate_competition_scores: {
        Args: { _competition_id: string }
        Returns: undefined
      }
      recalculate_ranking_positions: {
        Args: { target_month: string }
        Returns: undefined
      }
      registrar_producao: {
        Args: {
          p_custo_total: number
          p_insumos?: Json
          p_product_id: string
          p_unidades: number
        }
        Returns: Json
      }
      resolve_login_email: {
        Args: { p_email: string; p_password: string }
        Returns: string
      }
      resumo_mensal: { Args: { p_preco?: number }; Returns: Json }
      telefone_normalizado: { Args: { t: string }; Returns: string }
      telefone_valido: { Args: { t: string }; Returns: boolean }
      total_assinantes_app: { Args: never; Returns: number }
      usuario_verificado: { Args: { p_user: string }; Returns: boolean }
      x1_aceitar_aberto: { Args: { p_id: string }; Returns: undefined }
      x1_admin_confirm_payment: { Args: { p_id: string }; Returns: undefined }
      x1_admin_estornar_deposit: {
        Args: { p_id: string; p_motivo?: string }
        Returns: undefined
      }
      x1_admin_resolve_deposit: {
        Args: { p_aprovar: boolean; p_id: string; p_motivo?: string }
        Returns: undefined
      }
      x1_admin_resolve_withdraw: {
        Args: { p_acao: string; p_id: string; p_motivo?: string }
        Returns: undefined
      }
      x1_admin_set_result: {
        Args: {
          p_challenger_score: number
          p_fee: number
          p_id: string
          p_notes: string
          p_opponent_score: number
          p_prize: number
          p_winner: string
        }
        Returns: undefined
      }
      x1_admin_void: {
        Args: { p_id: string; p_reason?: string }
        Returns: undefined
      }
      x1_admin_wallet_move: {
        Args: {
          p_amount: number
          p_notes?: string
          p_tipo: string
          p_user: string
        }
        Returns: undefined
      }
      x1_arena_rank: { Args: { p_user: string }; Returns: number }
      x1_cancel: { Args: { p_id: string }; Returns: undefined }
      x1_cancelar_aberto: { Args: { p_id: string }; Returns: undefined }
      x1_chamadas_abertas: {
        Args: never
        Returns: {
          avatar_url: string
          challenger_id: string
          cidade: string
          expires_at: string
          id: string
          liga_min_rank: number
          nome: string
          patente: string
          scheduled_date: string
          stakes_amount: number
          vitorias: number
        }[]
      }
      x1_criar: {
        Args: {
          p_date: string
          p_opponent: string
          p_stakes: number
          p_tipo?: string
        }
        Returns: string
      }
      x1_golpes: {
        Args: { p_id: string }
        Returns: {
          amount: number
          created_at: string
          user_id: string
        }[]
      }
      x1_luta: {
        Args: { p_id: string }
        Returns: {
          ch_avatar: string
          ch_nome: string
          ch_patente: string
          ch_potencia: number
          ch_total: number
          ch_vitorias: number
          challenger_id: string
          expires_at: string
          id: string
          last_proposed_by: string
          minha_torcida: string
          op_avatar: string
          op_nome: string
          op_patente: string
          op_potencia: number
          op_total: number
          op_vitorias: number
          opponent_id: string
          prize_amount: number
          scheduled_date: string
          stakes_amount: number
          status: string
          torcida_ch: number
          torcida_op: number
          winner_user_id: string
        }[]
      }
      x1_lutar: {
        Args: { p_opponent: string; p_stakes?: number }
        Returns: Json
      }
      x1_lutas_ao_vivo: {
        Args: never
        Returns: {
          ch_avatar: string
          ch_nome: string
          ch_total: number
          challenger_id: string
          id: string
          minha_luta: boolean
          op_avatar: string
          op_nome: string
          op_total: number
          opponent_id: string
          prize_amount: number
          stakes_amount: number
          torcida_ch: number
          torcida_op: number
        }[]
      }
      x1_mark_paid: { Args: { p_id: string }; Returns: undefined }
      x1_missoes: {
        Args: never
        Returns: {
          alvo: number
          concluida: boolean
          dica: string
          feito: number
          tipo: string
          titulo: string
        }[]
      }
      x1_na_arena: { Args: { p_user: string }; Returns: boolean }
      x1_negotiate: {
        Args: {
          p_action: string
          p_date?: string
          p_goal?: number
          p_id: string
          p_modo?: string
          p_nome?: string
          p_pix?: string
          p_stakes?: number
        }
        Returns: undefined
      }
      x1_oponentes: {
        Args: { p_busca?: string; p_filtro?: string }
        Returns: {
          avatar_url: string
          derrotas: number
          derrotas_contra: number
          diferenca: number
          na_arena: boolean
          nome: string
          o_que_vende: string
          patente: string
          posicao: number
          potencia: number
          revanche: boolean
          user_id: string
          verificado: boolean
          vitorias: number
          vitorias_contra: number
        }[]
      }
      x1_patente: {
        Args: { p_vitorias: number }
        Returns: {
          aposta_max: number
          nivel: number
          nome: string
          proxima: number
        }[]
      }
      x1_patente_pontos: {
        Args: { p_pontos: number }
        Returns: {
          aposta_max: number
          nivel: number
          nome: string
          proxima: number
        }[]
      }
      x1_placar: {
        Args: { p_id: string }
        Returns: {
          challenger_total: number
          opponent_total: number
        }[]
      }
      x1_potencia: { Args: { p_user: string }; Returns: number }
      x1_recorde: {
        Args: { p_user: string }
        Returns: {
          aposta_max: number
          derrotas: number
          duelos: number
          empates: number
          nivel: number
          patente: string
          pontos: number
          pontos_proxima: number
          potencia: number
          proxima: number
          sequencia: number
          vitorias: number
        }[]
      }
      x1_request_withdraw: {
        Args: { p_nome?: string; p_pix: string; p_valor: number }
        Returns: string
      }
      x1_respond: {
        Args: { p_accept: boolean; p_id: string }
        Returns: undefined
      }
      x1_rivais: {
        Args: never
        Returns: {
          avatar_url: string
          derrotas_contra: number
          diferenca: number
          nome: string
          patente: string
          posicao: number
          user_id: string
          vitorias_contra: number
        }[]
      }
      x1_semana_brt: { Args: never; Returns: string }
      x1_set_proof: {
        Args: { p_id: string; p_url: string }
        Returns: undefined
      }
      x1_settle_due: {
        Args: never
        Returns: {
          resultado: string
          x1_id: string
        }[]
      }
      x1_tesouraria: { Args: never; Returns: Json }
      x1_torcer: { Args: { p_id: string; p_lado: string }; Returns: undefined }
      x1_vizinhos_hoje: {
        Args: never
        Returns: {
          avatar_url: string
          nome: string
          posicao: number
          user_id: string
          vendido_hoje: number
        }[]
      }
      x1_wallet_apply: {
        Args: {
          p_amount: number
          p_by: string
          p_notes: string
          p_tipo: string
          p_user: string
          p_x1: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      crm_funil_status:
        | "mapeado"
        | "mensagem_enviada"
        | "negociando"
        | "fechado"
        | "rejeitado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      crm_funil_status: [
        "mapeado",
        "mensagem_enviada",
        "negociando",
        "fechado",
        "rejeitado",
      ],
    },
  },
} as const
