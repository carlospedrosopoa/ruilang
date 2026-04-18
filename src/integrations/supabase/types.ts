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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      cliente_documentos: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          nome: string
          origem_proposta_id: string | null
          tamanho: number | null
          tipo: string | null
          uploaded_at: string | null
          url: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          nome: string
          origem_proposta_id?: string | null
          tamanho?: number | null
          tipo?: string | null
          uploaded_at?: string | null
          url: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          nome?: string
          origem_proposta_id?: string | null
          tamanho?: number | null
          tipo?: string | null
          uploaded_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_origem_proposta_id_fkey"
            columns: ["origem_proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_propostas: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          proposta_id: string
          tipo_pessoa: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          proposta_id: string
          tipo_pessoa: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          proposta_id?: string
          tipo_pessoa?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_propostas_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cpf: string | null
          created_at: string
          documento_numero: string | null
          documento_tipo: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          imobiliaria_id: string
          nome_completo: string
          origem_proposta_id: string | null
          payload: Json
          telefone: string | null
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          documento_numero?: string | null
          documento_tipo?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          imobiliaria_id: string
          nome_completo: string
          origem_proposta_id?: string | null
          payload?: Json
          telefone?: string | null
          tipo_pessoa: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          documento_numero?: string | null
          documento_tipo?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          imobiliaria_id?: string
          nome_completo?: string
          origem_proposta_id?: string | null
          payload?: Json
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_origem_proposta_id_fkey"
            columns: ["origem_proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      corretores: {
        Row: {
          ativo: boolean
          created_at: string
          creci: string | null
          email: string | null
          id: string
          imobiliaria_id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          imobiliaria_id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          imobiliaria_id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretores_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      imobiliarias: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string
          created_at: string
          creci: string
          email: string | null
          endereco: string | null
          estado: string
          id: string
          nome: string
          numero: string | null
          responsavel: string | null
          telefone: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade: string
          created_at?: string
          creci: string
          email?: string | null
          endereco?: string | null
          estado: string
          id?: string
          nome: string
          numero?: string | null
          responsavel?: string | null
          telefone?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string
          created_at?: string
          creci?: string
          email?: string | null
          endereco?: string | null
          estado?: string
          id?: string
          nome?: string
          numero?: string | null
          responsavel?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      propostas: {
        Row: {
          corretor_id: string | null
          corretor_creci: string | null
          corretor_nome: string | null
          corretor_telefone: string | null
          created_at: string
          dados: Json
          documentos: Json
          first_opened_at: string | null
          id: string
          imobiliaria_id: string | null
          imobiliaria_nome: string | null
          proposta_texto: string | null
          status: string
          submitted_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          corretor_id?: string | null
          corretor_creci?: string | null
          corretor_nome?: string | null
          corretor_telefone?: string | null
          created_at?: string
          dados?: Json
          documentos?: Json
          first_opened_at?: string | null
          id?: string
          imobiliaria_id?: string | null
          imobiliaria_nome?: string | null
          proposta_texto?: string | null
          status?: string
          submitted_at?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          corretor_id?: string | null
          corretor_creci?: string | null
          corretor_nome?: string | null
          corretor_telefone?: string | null
          created_at?: string
          dados?: Json
          documentos?: Json
          first_opened_at?: string | null
          id?: string
          imobiliaria_id?: string | null
          imobiliaria_nome?: string | null
          proposta_texto?: string | null
          status?: string
          submitted_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "propostas_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          corretor_id: string | null
          corretor_nome: string | null
          corretor_telefone: string | null
          created_at: string
          dados: Json
          first_opened_at: string | null
          id: string
          imobiliaria_id: string | null
          proposta_gerada_em: string | null
          proposta_texto: string | null
          status: string
          submitted_at: string | null
          tipo_contrato: string
          token: string
          updated_at: string
        }
        Insert: {
          corretor_id?: string | null
          corretor_nome?: string | null
          corretor_telefone?: string | null
          created_at?: string
          dados?: Json
          first_opened_at?: string | null
          id?: string
          imobiliaria_id?: string | null
          proposta_gerada_em?: string | null
          proposta_texto?: string | null
          status?: string
          submitted_at?: string | null
          tipo_contrato?: string
          token?: string
          updated_at?: string
        }
        Update: {
          corretor_id?: string | null
          corretor_nome?: string | null
          corretor_telefone?: string | null
          created_at?: string
          dados?: Json
          first_opened_at?: string | null
          id?: string
          imobiliaria_id?: string | null
          proposta_gerada_em?: string | null
          proposta_texto?: string | null
          status?: string
          submitted_at?: string | null
          tipo_contrato?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "imobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
