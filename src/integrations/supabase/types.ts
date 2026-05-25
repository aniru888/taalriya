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
      admin_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["admin_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["admin_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["admin_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_sounds: {
        Row: {
          bpm: number | null
          category: string | null
          created_at: string
          description: string | null
          duration_ms: number | null
          id: string
          is_featured: boolean
          kind: Database["public"]["Enums"]["library_sound_kind"]
          name: string
          scale: string | null
          storage_path: string
          taal_name: string | null
          tags: string[]
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bpm?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_ms?: number | null
          id?: string
          is_featured?: boolean
          kind: Database["public"]["Enums"]["library_sound_kind"]
          name: string
          scale?: string | null
          storage_path: string
          taal_name?: string | null
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bpm?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_ms?: number | null
          id?: string
          is_featured?: boolean
          kind?: Database["public"]["Enums"]["library_sound_kind"]
          name?: string
          scale?: string | null
          storage_path?: string
          taal_name?: string | null
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      library_taals: {
        Row: {
          beats: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          divisions: string | null
          id: string
          is_featured: boolean
          khali: number[]
          name: string
          sam: number
          steps: Json
          tags: string[]
          updated_at: string
        }
        Insert: {
          beats: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          divisions?: string | null
          id?: string
          is_featured?: boolean
          khali?: number[]
          name: string
          sam?: number
          steps: Json
          tags?: string[]
          updated_at?: string
        }
        Update: {
          beats?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          divisions?: string | null
          id?: string
          is_featured?: boolean
          khali?: number[]
          name?: string
          sam?: number
          steps?: Json
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          favorites: string[]
          id: string
          settings: Json
          tier: Database["public"]["Enums"]["subscription_tier"]
          total_practice_ms: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          favorites?: string[]
          id: string
          settings?: Json
          tier?: Database["public"]["Enums"]["subscription_tier"]
          total_practice_ms?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          favorites?: string[]
          id?: string
          settings?: Json
          tier?: Database["public"]["Enums"]["subscription_tier"]
          total_practice_ms?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_taals: {
        Row: {
          beats: number
          created_at: string
          divisions: string | null
          id: string
          khali: number[]
          name: string
          sam: number
          steps: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          beats: number
          created_at?: string
          divisions?: string | null
          id?: string
          khali?: number[]
          name: string
          sam?: number
          steps: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          beats?: number
          created_at?: string
          divisions?: string | null
          id?: string
          khali?: number[]
          name?: string
          sam?: number
          steps?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      admin_request_status: "pending" | "approved" | "rejected"
      app_role: "owner" | "admin" | "user"
      library_sound_kind: "bol" | "tanpura" | "taal_loop"
      subscription_tier: "free" | "premium"
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
      admin_request_status: ["pending", "approved", "rejected"],
      app_role: ["owner", "admin", "user"],
      library_sound_kind: ["bol", "tanpura", "taal_loop"],
      subscription_tier: ["free", "premium"],
    },
  },
} as const
