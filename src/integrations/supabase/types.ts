export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      mess_notifications: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          mess_id: string;
          recipient_id: string | null;
          sender_id: string | null;
          title: string;
          type: "notice" | "reminder" | "alert" | "info";
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          mess_id: string;
          recipient_id?: string | null;
          sender_id?: string | null;
          title: string;
          type?: "notice" | "reminder" | "alert" | "info";
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          mess_id?: string;
          recipient_id?: string | null;
          sender_id?: string | null;
          title?: string;
          type?: "notice" | "reminder" | "alert" | "info";
        };
        Relationships: [
          {
            foreignKeyName: "mess_notifications_mess_id_fkey";
            columns: ["mess_id"];
            isOneToOne: false;
            referencedRelation: "messes";
            referencedColumns: ["id"];
          },
        ];
      };

      deposits: {
        Row: {
          amount: number;
          created_at: string;
          date: string;
          id: string;
          kind: string;
          member_id: string;
          method: string;
          reference: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          date?: string;
          id?: string;
          kind?: string;
          member_id: string;
          method?: string;
          reference?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          date?: string;
          id?: string;
          kind?: string;
          member_id?: string;
          method?: string;
          reference?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposits_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          date: string;
          description: string;
          id: string;
          member_id: string | null;
          method: string;
          type: string;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          date?: string;
          description?: string;
          id?: string;
          member_id?: string | null;
          method?: string;
          type: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          date?: string;
          description?: string;
          id?: string;
          member_id?: string | null;
          method?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      meals: {
        Row: {
          breakfast: number;
          date: string;
          dinner: number;
          id: string;
          lunch: number;
          member_id: string;
        };
        Insert: {
          breakfast?: number;
          date: string;
          dinner?: number;
          id?: string;
          lunch?: number;
          member_id: string;
        };
        Update: {
          breakfast?: number;
          date?: string;
          dinner?: number;
          id?: string;
          lunch?: number;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          created_at: string;
          id: string;
          joined: string;
          name: string;
          phone: string;
          room: string;
          status: string;
          tone: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          joined?: string;
          name: string;
          phone?: string;
          room?: string;
          status?: string;
          tone?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          joined?: string;
          name?: string;
          phone?: string;
          room?: string;
          status?: string;
          tone?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      mess_expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          date: string;
          description: string;
          id: string;
          member_id: string | null;
          mess_id: string;
          method: string;
          type: string;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          date?: string;
          description?: string;
          id?: string;
          member_id?: string | null;
          mess_id?: string;
          method?: string;
          type: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          date?: string;
          description?: string;
          id?: string;
          member_id?: string | null;
          mess_id?: string;
          method?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mess_expenses_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "mess_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mess_expenses_mess_id_fkey";
            columns: ["mess_id"];
            isOneToOne: false;
            referencedRelation: "messes";
            referencedColumns: ["id"];
          },
        ];
      };
      mess_meals: {
        Row: {
          breakfast: number;
          date: string;
          dinner: number;
          id: string;
          lunch: number;
          member_id: string;
          mess_id: string;
        };
        Insert: {
          breakfast?: number;
          date: string;
          dinner?: number;
          id?: string;
          lunch?: number;
          member_id: string;
          mess_id?: string;
        };
        Update: {
          breakfast?: number;
          date?: string;
          dinner?: number;
          id?: string;
          lunch?: number;
          member_id?: string;
          mess_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mess_meals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "mess_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mess_meals_mess_id_fkey";
            columns: ["mess_id"];
            isOneToOne: false;
            referencedRelation: "messes";
            referencedColumns: ["id"];
          },
        ];
      };
      mess_members: {
        Row: {
          created_at: string;
          id: string;
          joined: string;
          mess_id: string;
          name: string;
          phone: string;
          role: string;
          room: string;
          status: string;
          tone: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          joined?: string;
          mess_id?: string;
          name: string;
          phone?: string;
          role?: string;
          room?: string;
          status?: string;
          tone?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          joined?: string;
          mess_id?: string;
          name?: string;
          phone?: string;
          role?: string;
          room?: string;
          status?: string;
          tone?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mess_members_mess_id_fkey";
            columns: ["mess_id"];
            isOneToOne: false;
            referencedRelation: "messes";
            referencedColumns: ["id"];
          },
        ];
      };
      mess_settings: {
        Row: {
          address: string;
          currency: string;
          household_categories: string[];
          id: number;
          invite_code: string;
          manager: string;
          meal_categories: string[];
          name: string;
        };
        Insert: {
          address?: string;
          currency?: string;
          household_categories?: string[];
          id?: number;
          invite_code?: string;
          manager?: string;
          meal_categories?: string[];
          name?: string;
        };
        Update: {
          address?: string;
          currency?: string;
          household_categories?: string[];
          id?: number;
          invite_code?: string;
          manager?: string;
          meal_categories?: string[];
          name?: string;
        };
        Relationships: [];
      };
      mess_user_roles: {
        Row: {
          mess_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          mess_id: string;
          role: string;
          user_id: string;
        };
        Update: {
          mess_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mess_user_roles_mess_id_fkey";
            columns: ["mess_id"];
            isOneToOne: false;
            referencedRelation: "messes";
            referencedColumns: ["id"];
          },
        ];
      };
      messes: {
        Row: {
          address: string;
          created_at: string;
          currency: string;
          household_categories: string[];
          id: string;
          invite_code: string;
          manager: string;
          meal_categories: string[];
          name: string;
          owner_id: string;
          show_invite_to_members: boolean;
          start_day: number;
        };
        Insert: {
          address?: string;
          created_at?: string;
          currency?: string;
          household_categories?: string[];
          id?: string;
          invite_code: string;
          manager?: string;
          meal_categories?: string[];
          name: string;
          owner_id: string;
          show_invite_to_members?: boolean;
          start_day?: number;
        };
        Update: {
          address?: string;
          created_at?: string;
          currency?: string;
          household_categories?: string[];
          id?: string;
          invite_code?: string;
          manager?: string;
          meal_categories?: string[];
          name?: string;
          owner_id?: string;
          show_invite_to_members?: boolean;
          start_day?: number;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          date: string;
          id: string;
          kind: string;
          member_id: string;
          mess_id: string;
          method: string;
          reference: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          date?: string;
          id?: string;
          kind?: string;
          member_id: string;
          mess_id?: string;
          method?: string;
          reference?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          date?: string;
          id?: string;
          kind?: string;
          member_id?: string;
          mess_id?: string;
          method?: string;
          reference?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "mess_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_mess_id_fkey";
            columns: ["mess_id"];
            isOneToOne: false;
            referencedRelation: "messes";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_mess_by_invite_code: {
        Args: { invite_code: string };
        Returns: Json;
      };
      get_workspace_by_invite_code: {
        Args: { invite_code: string; p_month: string };
        Returns: Json;
      };
      send_mess_notification: {
        Args: {
          _message: string;
          _recipient_id: string | null;
          _title: string;
          _type?: string;
        };
        Returns: string;
      };

      create_mess: {
        Args: {
          _address: string;
          _currency: string;
          _manager: string;
          _name: string;
          _start_day: number;
        };
        Returns: Json;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_mess_admin: { Args: { _mess: string }; Returns: boolean };
      join_mess: { Args: { _code: string }; Returns: string };
      join_mess_by_code: { Args: { _code: string }; Returns: Json };
      mess_invite_code: { Args: never; Returns: string };
      mess_month_summary: {
        Args: { _end: string; _start: string };
        Returns: Json;
      };
      month_summary: { Args: { _end: string; _start: string }; Returns: Json };
      my_member_id: { Args: never; Returns: string };
      my_mess_id: { Args: never; Returns: string };
      new_invite_code: { Args: never; Returns: string };
      regenerate_invite_code: { Args: never; Returns: string };
    };
    Enums: {
      app_role: "admin" | "member";
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
      app_role: ["admin", "member"],
    },
  },
} as const;
