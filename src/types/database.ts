export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_queries: {
        Row: {
          answer: string | null;
          chunk_ids: number[];
          citations: NonNullable<Json>;
          created_at: string;
          error: string | null;
          id: string;
          input_tokens: number | null;
          latency_ms: number | null;
          model: string;
          organisation_id: string;
          output_tokens: number | null;
          provider: string;
          question: string;
          status: Database["public"]["Enums"]["ai_query_status"];
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          answer?: string | null;
          chunk_ids?: number[];
          citations?: NonNullable<Json>;
          created_at?: string;
          error?: string | null;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model: string;
          organisation_id: string;
          output_tokens?: number | null;
          provider: string;
          question: string;
          status: Database["public"]["Enums"]["ai_query_status"];
          user_id?: string | null;
        };
        Update: {
          answer?: string | null;
          chunk_ids?: number[];
          citations?: NonNullable<Json>;
          created_at?: string;
          error?: string | null;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model?: string;
          organisation_id?: string;
          output_tokens?: number | null;
          provider?: string;
          question?: string;
          status?: Database["public"]["Enums"]["ai_query_status"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_queries_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_queries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          id: number;
          organisation_id: string | null;
          target_id: string | null;
          target_type: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          organisation_id?: string | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          organisation_id?: string | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          organisation_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          organisation_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          organisation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          organisation_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          organisation_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          organisation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departments_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      document_chunks: {
        Row: {
          chunk_index: number;
          content: string;
          created_at: string;
          document_id: string;
          embedding: string | null;
          embedding_model: string | null;
          fts: unknown;
          id: number;
          organisation_id: string;
          page: number | null;
          version_id: string;
        };
        ComputedFields: never;
        Insert: {
          chunk_index: number;
          content: string;
          created_at?: string;
          document_id: string;
          embedding?: string | null;
          embedding_model?: string | null;
          fts?: never;
          id?: never;
          organisation_id: string;
          page?: number | null;
          version_id: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: string | null;
          embedding_model?: string | null;
          fts?: never;
          id?: never;
          organisation_id?: string;
          page?: number | null;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_organisation_id_fkey";
            columns: ["document_id", "organisation_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id", "organisation_id"];
          },
          {
            foreignKeyName: "document_chunks_version_id_organisation_id_fkey";
            columns: ["version_id", "organisation_id"];
            isOneToOne: false;
            referencedRelation: "document_versions";
            referencedColumns: ["id", "organisation_id"];
          },
        ];
      };
      document_departments: {
        Row: {
          department_id: string;
          document_id: string;
          organisation_id: string;
        };
        ComputedFields: never;
        Insert: {
          department_id: string;
          document_id: string;
          organisation_id: string;
        };
        Update: {
          department_id?: string;
          document_id?: string;
          organisation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_departments_department_id_organisation_id_fkey";
            columns: ["department_id", "organisation_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id", "organisation_id"];
          },
          {
            foreignKeyName: "document_departments_document_id_organisation_id_fkey";
            columns: ["document_id", "organisation_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id", "organisation_id"];
          },
        ];
      };
      document_versions: {
        Row: {
          char_count: number | null;
          chunk_count: number | null;
          created_at: string;
          document_id: string;
          error: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          organisation_id: string;
          processed_at: string | null;
          sha256: string;
          size_bytes: number;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          uploaded_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          char_count?: number | null;
          chunk_count?: number | null;
          created_at?: string;
          document_id: string;
          error?: string | null;
          file_name: string;
          id?: string;
          mime_type: string;
          organisation_id: string;
          processed_at?: string | null;
          sha256: string;
          size_bytes: number;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          uploaded_by?: string | null;
          version: number;
        };
        Update: {
          char_count?: number | null;
          chunk_count?: number | null;
          created_at?: string;
          document_id?: string;
          error?: string | null;
          file_name?: string;
          id?: string;
          mime_type?: string;
          organisation_id?: string;
          processed_at?: string | null;
          sha256?: string;
          size_bytes?: number;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path?: string;
          uploaded_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_organisation_id_fkey";
            columns: ["document_id", "organisation_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id", "organisation_id"];
          },
          {
            foreignKeyName: "document_versions_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          archived_at: string | null;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          current_version: number;
          description: string;
          id: string;
          organisation_id: string;
          processing_error: string | null;
          status: Database["public"]["Enums"]["document_status"];
          tags: string[];
          title: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["document_visibility"];
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_version?: number;
          description?: string;
          id?: string;
          organisation_id: string;
          processing_error?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          tags?: string[];
          title: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["document_visibility"];
        };
        Update: {
          archived_at?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_version?: number;
          description?: string;
          id?: string;
          organisation_id?: string;
          processing_error?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          tags?: string[];
          title?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["document_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "documents_category_id_organisation_id_fkey";
            columns: ["category_id", "organisation_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "organisation_id"];
          },
          {
            foreignKeyName: "documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          department_id: string | null;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          organisation_id: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["invitation_status"];
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          department_id?: string | null;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          organisation_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          department_id?: string | null;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          organisation_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
        };
        Relationships: [
          {
            foreignKeyName: "invitations_department_id_organisation_id_fkey";
            columns: ["department_id", "organisation_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id", "organisation_id"];
          },
          {
            foreignKeyName: "invitations_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      organisations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          department_id: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          organisation_id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          department_id?: string | null;
          email: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          organisation_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department_id?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          organisation_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_organisation_id_fkey";
            columns: ["department_id", "organisation_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id", "organisation_id"];
          },
          {
            foreignKeyName: "profiles_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_chunks: {
        Args: {
          match_count?: number;
          min_similarity?: number;
          query_embedding: string;
          query_text: string;
        };
        Returns: {
          category_name: string;
          chunk_id: number;
          content: string;
          document_id: string;
          keyword_rank: number;
          page: number;
          score: number;
          similarity: number;
          title: string;
          version: number;
        }[];
      };
      search_documents: {
        Args: { max_results?: number; search_query: string };
        Returns: {
          category_name: string;
          document_id: string;
          page: number;
          rank: number;
          snippet: string;
          title: string;
        }[];
      };
    };
    Enums: {
      ai_query_status: "answered" | "no_answer" | "failed";
      app_role: "admin" | "knowledge_manager" | "employee";
      document_status: "uploaded" | "processing" | "indexed" | "failed";
      document_visibility: "organisation" | "departments";
      invitation_status: "pending" | "accepted" | "revoked";
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_query_status: ["answered", "no_answer", "failed"],
      app_role: ["admin", "knowledge_manager", "employee"],
      document_status: ["uploaded", "processing", "indexed", "failed"],
      document_visibility: ["organisation", "departments"],
      invitation_status: ["pending", "accepted", "revoked"],
    },
  },
} as const;
