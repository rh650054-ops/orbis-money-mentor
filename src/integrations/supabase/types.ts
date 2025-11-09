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
      profiles: {
        Row: {
          avatar_url: string | null
          base_daily_goal: number | null
          billing_exempt: boolean | null
          check_in_focus: string | null
          check_in_mood: string | null
          check_in_start_time: string | null
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
          plan_status: string | null
          plan_type: string | null
          streak_days: number | null
          subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
          vision_points: number | null
          week_start_date: string | null
          weekly_goal: number | null
          weekly_work_days: number | null
          working_days: string[] | null
        }
        Insert: {
          avatar_url?: string | null
          base_daily_goal?: number | null
          billing_exempt?: boolean | null
          check_in_focus?: string | null
          check_in_mood?: string | null
          check_in_start_time?: string | null
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
          plan_status?: string | null
          plan_type?: string | null
          streak_days?: number | null
          subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
          vision_points?: number | null
          week_start_date?: string | null
          weekly_goal?: number | null
          weekly_work_days?: number | null
          working_days?: string[] | null
        }
        Update: {
          avatar_url?: string | null
          base_daily_goal?: number | null
          billing_exempt?: boolean | null
          check_in_focus?: string | null
          check_in_mood?: string | null
          check_in_start_time?: string | null
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
          plan_status?: string | null
          plan_type?: string | null
          streak_days?: number | null
          subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_trial_expired: { Args: { user_uuid: string }; Returns: boolean }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
