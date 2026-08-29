export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      clients: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          tax_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          tax_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          tax_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      document_activity: {
        Row: {
          action: string;
          created_at: string;
          detail: string | null;
          document_id: string;
          document_type: string;
          id: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          detail?: string | null;
          document_id: string;
          document_type: string;
          id?: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          detail?: string | null;
          document_id?: string;
          document_type?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      estimate_items: {
        Row: {
          amount_cents: number;
          description: string;
          estimate_id: string;
          id: string;
          quantity: number;
          rate_cents: number;
          sort_order: number;
        };
        Insert: {
          amount_cents?: number;
          description: string;
          estimate_id: string;
          id?: string;
          quantity?: number;
          rate_cents?: number;
          sort_order?: number;
        };
        Update: {
          amount_cents?: number;
          description?: string;
          estimate_id?: string;
          id?: string;
          quantity?: number;
          rate_cents?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_items_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
        ];
      };
      estimate_photos: {
        Row: {
          caption: string | null;
          created_at: string;
          estimate_id: string;
          id: string;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          estimate_id: string;
          id?: string;
          storage_path: string;
          user_id: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          estimate_id?: string;
          id?: string;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_photos_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
        ];
      };
      estimates: {
        Row: {
          ai_generated: boolean;
          approved_at: string | null;
          client_id: string | null;
          converted_at: string | null;
          converted_invoice_id: string | null;
          created_at: string;
          currency: string;
          estimate_number: string;
          expiry_date: string | null;
          id: string;
          issue_date: string;
          job_description: string | null;
          notes: string | null;
          sent_at: string | null;
          sent_to_email: string | null;
          status: string;
          subtotal_cents: number;
          tax_cents: number;
          tax_rate: number;
          total_cents: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_generated?: boolean;
          approved_at?: string | null;
          client_id?: string | null;
          converted_at?: string | null;
          converted_invoice_id?: string | null;
          created_at?: string;
          currency?: string;
          estimate_number: string;
          expiry_date?: string | null;
          id?: string;
          issue_date?: string;
          job_description?: string | null;
          notes?: string | null;
          sent_at?: string | null;
          sent_to_email?: string | null;
          status?: string;
          subtotal_cents?: number;
          tax_cents?: number;
          tax_rate?: number;
          total_cents?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_generated?: boolean;
          approved_at?: string | null;
          client_id?: string | null;
          converted_at?: string | null;
          converted_invoice_id?: string | null;
          created_at?: string;
          currency?: string;
          estimate_number?: string;
          expiry_date?: string | null;
          id?: string;
          issue_date?: string;
          job_description?: string | null;
          notes?: string | null;
          sent_at?: string | null;
          sent_to_email?: string | null;
          status?: string;
          subtotal_cents?: number;
          tax_cents?: number;
          tax_rate?: number;
          total_cents?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estimates_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_feedback: {
        Row: {
          client_name: string | null;
          comment: string | null;
          created_at: string;
          id: string;
          invoice_id: string;
          rating: number | null;
        };
        Insert: {
          client_name?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          invoice_id: string;
          rating?: number | null;
        };
        Update: {
          client_name?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          invoice_id?: string;
          rating?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_feedback_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          amount_cents: number;
          description: string;
          id: string;
          invoice_id: string;
          quantity: number;
          rate_cents: number;
          sort_order: number;
        };
        Insert: {
          amount_cents?: number;
          description: string;
          id?: string;
          invoice_id: string;
          quantity?: number;
          rate_cents?: number;
          sort_order?: number;
        };
        Update: {
          amount_cents?: number;
          description?: string;
          id?: string;
          invoice_id?: string;
          quantity?: number;
          rate_cents?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          client_id: string | null;
          created_at: string;
          currency: string;
          due_date: string | null;
          feedback_token: string | null;
          id: string;
          invoice_number: string;
          issue_date: string;
          notes: string | null;
          paid_at: string | null;
          payment_link_token: string;
          sent_count: number | null;
          status: string;
          stripe_payment_intent_id: string | null;
          stripe_session_id: string | null;
          subtotal_cents: number;
          tax_cents: number;
          tax_rate: number;
          total_cents: number;
          type: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          currency?: string;
          due_date?: string | null;
          feedback_token?: string | null;
          id?: string;
          invoice_number: string;
          issue_date?: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_link_token?: string;
          sent_count?: number | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string | null;
          subtotal_cents?: number;
          tax_cents?: number;
          tax_rate?: number;
          total_cents?: number;
          type?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          currency?: string;
          due_date?: string | null;
          feedback_token?: string | null;
          id?: string;
          invoice_number?: string;
          issue_date?: string;
          notes?: string | null;
          paid_at?: string | null;
          payment_link_token?: string;
          sent_count?: number | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string | null;
          subtotal_cents?: number;
          tax_cents?: number;
          tax_rate?: number;
          total_cents?: number;
          type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      job_leads: {
        Row: {
          budget_range: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          description: string;
          id: string;
          location: string;
          source: string;
          status: string;
          title: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          budget_range?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          location: string;
          source?: string;
          status?: string;
          title: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          budget_range?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          location?: string;
          source?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          estimated_value_cents: number | null;
          id: string;
          notes: string | null;
          service_needed: string | null;
          source: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          estimated_value_cents?: number | null;
          id?: string;
          notes?: string | null;
          service_needed?: string | null;
          source?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          estimated_value_cents?: number | null;
          id?: string;
          notes?: string | null;
          service_needed?: string | null;
          source?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          id: string;
          invoice_id: string;
          paid_at: string;
          payment_method: string | null;
          reference: string | null;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency?: string;
          id?: string;
          invoice_id: string;
          paid_at?: string;
          payment_method?: string | null;
          reference?: string | null;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          invoice_id?: string;
          paid_at?: string;
          payment_method?: string | null;
          reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_rules: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          notes: string | null;
          rate_cents: number;
          unit: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          notes?: string | null;
          rate_cents?: number;
          unit?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          notes?: string | null;
          rate_cents?: number;
          unit?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          brand_color: string | null;
          business_name: string | null;
          city: string | null;
          col_multiplier: number | null;
          company_name: string | null;
          country: string | null;
          created_at: string;
          default_currency: string | null;
          default_payment_terms: number | null;
          email: string | null;
          estimate_color: string | null;
          estimate_prefix: string | null;
          full_name: string | null;
          id: string;
          invoice_prefix: string | null;
          logo_url: string | null;
          next_estimate_number: number | null;
          next_invoice_number: number | null;
          onboarding_completed: boolean;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          stripe_customer_id: string | null;
          subscription_end: string | null;
          subscription_status: string | null;
          tax_id: string | null;
          updated_at: string;
          zip_code: string | null;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          brand_color?: string | null;
          business_name?: string | null;
          city?: string | null;
          col_multiplier?: number | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          default_currency?: string | null;
          default_payment_terms?: number | null;
          email?: string | null;
          estimate_color?: string | null;
          estimate_prefix?: string | null;
          full_name?: string | null;
          id: string;
          invoice_prefix?: string | null;
          logo_url?: string | null;
          next_estimate_number?: number | null;
          next_invoice_number?: number | null;
          onboarding_completed?: boolean;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          stripe_customer_id?: string | null;
          subscription_end?: string | null;
          subscription_status?: string | null;
          tax_id?: string | null;
          updated_at?: string;
          zip_code?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          brand_color?: string | null;
          business_name?: string | null;
          city?: string | null;
          col_multiplier?: number | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          default_currency?: string | null;
          default_payment_terms?: number | null;
          email?: string | null;
          estimate_color?: string | null;
          estimate_prefix?: string | null;
          full_name?: string | null;
          id?: string;
          invoice_prefix?: string | null;
          logo_url?: string | null;
          next_estimate_number?: number | null;
          next_invoice_number?: number | null;
          onboarding_completed?: boolean;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          stripe_customer_id?: string | null;
          subscription_end?: string | null;
          subscription_status?: string | null;
          tax_id?: string | null;
          updated_at?: string;
          zip_code?: string | null;
        };
        Relationships: [];
      };
      promo_codes: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          duration_days: number;
          expires_at: string | null;
          id: string;
          max_uses: number | null;
          plan: string;
          used_count: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          duration_days: number;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          plan?: string;
          used_count?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          duration_days?: number;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          plan?: string;
          used_count?: number;
        };
        Relationships: [];
      };
      promo_redemptions: {
        Row: {
          created_at: string;
          granted_plan: string;
          granted_until: string;
          id: string;
          promo_code_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted_plan: string;
          granted_until: string;
          id?: string;
          promo_code_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_plan?: string;
          granted_until?: string;
          id?: string;
          promo_code_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      usage_tracking: {
        Row: {
          billing_period_end: string | null;
          billing_period_start: string | null;
          created_at: string | null;
          id: string;
          metric_name: string;
          updated_at: string | null;
          usage_count: number | null;
          user_id: string;
        };
        Insert: {
          billing_period_end?: string | null;
          billing_period_start?: string | null;
          created_at?: string | null;
          id?: string;
          metric_name: string;
          updated_at?: string | null;
          usage_count?: number | null;
          user_id: string;
        };
        Update: {
          billing_period_end?: string | null;
          billing_period_start?: string | null;
          created_at?: string | null;
          id?: string;
          metric_name?: string;
          updated_at?: string | null;
          usage_count?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      webhook_logs: {
        Row: {
          created_at: string;
          id: string;
          payload: Json;
          response: Json | null;
          source: string;
          status: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          payload?: Json;
          response?: Json | null;
          source?: string;
          status?: string;
          type?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          payload?: Json;
          response?: Json | null;
          source?: string;
          status?: string;
          type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      profiles_safe: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          brand_color: string | null;
          business_name: string | null;
          city: string | null;
          company_name: string | null;
          country: string | null;
          created_at: string | null;
          default_currency: string | null;
          default_payment_terms: number | null;
          email: string | null;
          estimate_prefix: string | null;
          full_name: string | null;
          id: string | null;
          invoice_prefix: string | null;
          logo_url: string | null;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          subscription_end: string | null;
          subscription_status: string | null;
          tax_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          brand_color?: string | null;
          business_name?: string | null;
          city?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string | null;
          default_currency?: string | null;
          default_payment_terms?: number | null;
          email?: string | null;
          estimate_prefix?: string | null;
          full_name?: string | null;
          id?: string | null;
          invoice_prefix?: string | null;
          logo_url?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          subscription_end?: string | null;
          subscription_status?: string | null;
          tax_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          brand_color?: string | null;
          business_name?: string | null;
          city?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string | null;
          default_currency?: string | null;
          default_payment_terms?: number | null;
          email?: string | null;
          estimate_prefix?: string | null;
          full_name?: string | null;
          id?: string | null;
          invoice_prefix?: string | null;
          logo_url?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          subscription_end?: string | null;
          subscription_status?: string | null;
          tax_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      check_admin_access: { Args: never; Returns: boolean };
      get_all_feedback: {
        Args: never;
        Returns: {
          client_name: string;
          comment: string;
          created_at: string;
          id: string;
          invoice_id: string;
          invoice_number: string;
          rating: number;
          user_email: string;
        }[];
      };
      get_all_users: {
        Args: never;
        Returns: {
          business_name: string;
          created_at: string;
          email: string;
          id: string;
          invoice_count: number;
          subscription_end: string;
          subscription_status: string;
        }[];
      };
      get_job_leads: {
        Args: never;
        Returns: {
          budget_range: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          description: string;
          id: string;
          location: string;
          source: string;
          status: string;
          title: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "job_leads";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_subscription_stats: {
        Args: never;
        Returns: {
          count: number;
          status: string;
        }[];
      };
      get_system_stats: {
        Args: never;
        Returns: {
          active_subscriptions: number;
          invoices_this_month: number;
          total_clients: number;
          total_invoices: number;
          total_revenue_cents: number;
          total_users: number;
          users_this_month: number;
        }[];
      };
      get_webhook_logs: {
        Args: never;
        Returns: {
          created_at: string;
          id: string;
          payload: Json;
          response: Json | null;
          source: string;
          status: string;
          type: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "webhook_logs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      update_job_lead_status: {
        Args: { lead_id: string; new_status: string };
        Returns: undefined;
      };
      validate_feedback_token: {
        Args: { p_invoice_id: string; p_token: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const;
