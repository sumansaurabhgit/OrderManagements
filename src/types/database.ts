export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      inventory: {
        Row: {
          on_hand: number;
          product_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          on_hand?: number;
          product_id: string;
          updated_at?: string;
        };
        Update: {
          on_hand?: number;
          product_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          line_total: number | null;
          order_id: string;
          product_id: string;
          product_name: string;
          product_sku: string;
          quantity: number;
          unit_price: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          line_total?: never;
          order_id: string;
          product_id: string;
          product_name: string;
          product_sku: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          id?: string;
          line_total?: never;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          product_sku?: string;
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          cancelled_at: string | null;
          checkout_expires_at: string | null;
          created_at: string;
          currency: string;
          customer_email: string;
          fulfilled_at: string | null;
          id: string;
          order_number: number;
          paid_at: string | null;
          refunded_at: string | null;
          status: Database["public"]["Enums"]["order_status"];
          status_history: NonNullable<Json>;
          stripe_checkout_url: string | null;
          stripe_payment_intent_id: string | null;
          stripe_refund_id: string | null;
          stripe_session_id: string | null;
          total_amount: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cancelled_at?: string | null;
          checkout_expires_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_email: string;
          fulfilled_at?: string | null;
          id?: string;
          order_number?: never;
          paid_at?: string | null;
          refunded_at?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          status_history?: NonNullable<Json>;
          stripe_checkout_url?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_refund_id?: string | null;
          stripe_session_id?: string | null;
          total_amount: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          checkout_expires_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_email?: string;
          fulfilled_at?: string | null;
          id?: string;
          order_number?: never;
          paid_at?: string | null;
          refunded_at?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          status_history?: NonNullable<Json>;
          stripe_checkout_url?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_refund_id?: string | null;
          stripe_session_id?: string | null;
          total_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          available_stock: number;
          created_at: string;
          description: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          price: number;
          sku: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          available_stock?: number;
          created_at?: string;
          description?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          price: number;
          sku: string;
          updated_at?: string;
        };
        Update: {
          available_stock?: number;
          created_at?: string;
          description?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          price?: number;
          sku?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string;
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email: string;
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string;
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          created_at: string;
          created_by: string | null;
          delta: number;
          id: string;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          on_hand_after: number;
          product_id: string;
          reason: string;
          reference: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          delta: number;
          id?: string;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          on_hand_after: number;
          product_id: string;
          reason: string;
          reference?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          delta?: number;
          id?: string;
          movement_type?: Database["public"]["Enums"]["stock_movement_type"];
          on_hand_after?: number;
          product_id?: string;
          reason?: string;
          reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      storefront_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: number;
          message: string;
          product_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_type: string;
          id?: never;
          message: string;
          product_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: never;
          message?: string;
          product_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "storefront_events_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          duplicate_count: number;
          event_type: string;
          id: string;
          last_duplicate_at: string | null;
          order_id: string | null;
          outcome: string;
          payload: Json | null;
          processed_at: string;
        };
        ComputedFields: never;
        Insert: {
          duplicate_count?: number;
          event_type: string;
          id: string;
          last_duplicate_at?: string | null;
          order_id?: string | null;
          outcome: string;
          payload?: Json | null;
          processed_at?: string;
        };
        Update: {
          duplicate_count?: number;
          event_type?: string;
          id?: string;
          last_duplicate_at?: string | null;
          order_id?: string | null;
          outcome?: string;
          payload?: Json | null;
          processed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_adjust_stock: {
        Args: { p_delta: number; p_product_id: string; p_reason: string };
        Returns: Json;
      };
      admin_transition_order_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["order_status"];
          p_note?: string;
          p_order_id: string;
        };
        Returns: Json;
      };
      attach_checkout_session: {
        Args: {
          p_checkout_url: string;
          p_expires_at: string;
          p_order_id: string;
          p_session_id: string;
        };
        Returns: undefined;
      };
      cancel_own_pending_order: {
        Args: { p_order_id: string; p_reason?: string };
        Returns: Json;
      };
      create_order_and_reserve_stock: {
        Args: { p_items: Json };
        Returns: Json;
      };
      handle_stripe_webhook_atomic: {
        Args: {
          p_action: string;
          p_amount?: number;
          p_currency?: string;
          p_event_id: string;
          p_event_type: string;
          p_note?: string;
          p_order_id?: string;
          p_payload?: Json;
          p_payment_intent_id?: string;
          p_stripe_session_id?: string;
        };
        Returns: Json;
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      record_order_refund_request: {
        Args: { p_order_id: string; p_refund_id: string };
        Returns: Json;
      };
    };
    Enums: {
      order_status:
        | "pending_payment"
        | "paid"
        | "fulfilled"
        | "cancelled"
        | "refunded";
      stock_movement_type:
        | "initial_stock"
        | "order_reserved"
        | "order_released"
        | "order_refunded"
        | "manual_adjustment";
      user_role: "customer" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      order_status: [
        "pending_payment",
        "paid",
        "fulfilled",
        "cancelled",
        "refunded",
      ],
      stock_movement_type: [
        "initial_stock",
        "order_reserved",
        "order_released",
        "order_refunded",
        "manual_adjustment",
      ],
      user_role: ["customer", "admin"],
    },
  },
} as const;
