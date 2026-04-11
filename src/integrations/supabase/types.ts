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
      conversation_states: {
        Row: {
          ai_summary: string | null
          collected_fields: Json | null
          current_stage: string
          handoff_needed: boolean
          id: string
          last_intent: string | null
          lead_id: string
          missing_fields: Json | null
          quoted_options: Json | null
          selected_vehicle_id: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          collected_fields?: Json | null
          current_stage?: string
          handoff_needed?: boolean
          id?: string
          last_intent?: string | null
          lead_id: string
          missing_fields?: Json | null
          quoted_options?: Json | null
          selected_vehicle_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          collected_fields?: Json | null
          current_stage?: string
          handoff_needed?: boolean
          id?: string
          last_intent?: string | null
          lead_id?: string
          missing_fields?: Json | null
          quoted_options?: Json | null
          selected_vehicle_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_states_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_states_selected_vehicle_id_fkey"
            columns: ["selected_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          id: string
          lead_id: string
          mime_type: string | null
          note: string | null
          reservation_id: string | null
          storage_bucket: string
          storage_path: string
          uploaded_by: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          id?: string
          lead_id: string
          mime_type?: string | null
          note?: string | null
          reservation_id?: string | null
          storage_bucket?: string
          storage_path: string
          uploaded_by?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          id?: string
          lead_id?: string
          mime_type?: string | null
          note?: string | null
          reservation_id?: string | null
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_documents_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_entries: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_staff_id: string | null
          created_at: string
          current_stage: string
          first_seen_at: string
          full_name: string | null
          id: string
          last_message_at: string | null
          notes: string | null
          source: string | null
          status: string
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string
          current_stage?: string
          first_seen_at?: string
          full_name?: string | null
          id?: string
          last_message_at?: string | null
          notes?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          whatsapp_number: string
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string
          current_stage?: string
          first_seen_at?: string
          full_name?: string | null
          id?: string
          last_message_at?: string | null
          notes?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel: string
          created_at: string
          detected_intent: string | null
          direction: string
          id: string
          lead_id: string
          message_text: string
          message_type: string
          stage_at_time: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          detected_intent?: string | null
          direction: string
          id?: string
          lead_id: string
          message_text: string
          message_type?: string
          stage_at_time?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          detected_intent?: string | null
          direction?: string
          id?: string
          lead_id?: string
          message_text?: string
          message_type?: string
          stage_at_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          created_by_staff_id: string | null
          customer_name_snapshot: string | null
          customer_phone_snapshot: string | null
          end_datetime: string
          id: string
          internal_note: string | null
          lead_id: string | null
          pickup_location: string | null
          price_note: string | null
          reservation_type: string
          return_location: string | null
          source: string
          start_datetime: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by_staff_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          end_datetime: string
          id?: string
          internal_note?: string | null
          lead_id?: string | null
          pickup_location?: string | null
          price_note?: string | null
          reservation_type?: string
          return_location?: string | null
          source?: string
          start_datetime: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by_staff_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          end_datetime?: string
          id?: string
          internal_note?: string | null
          lead_id?: string | null
          pickup_location?: string | null
          price_note?: string | null
          reservation_type?: string
          return_location?: string | null
          source?: string
          start_datetime?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_images: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          is_primary: boolean
          mime_type: string | null
          sort_order: number
          storage_bucket: string
          storage_path: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string | null
          sort_order?: number
          storage_bucket?: string
          storage_path: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string | null
          sort_order?: number
          storage_bucket?: string
          storage_path?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_images_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          categories: string[] | null
          categories_raw: string | null
          chassis_number: string | null
          color: string | null
          created_at: string
          current_location: string | null
          expected_return_date: string | null
          id: string
          is_active: boolean
          latest_return_date: string | null
          make: string
          model: string
          notes: string | null
          odometer: number | null
          plate_number: string
          source_row_number: number | null
          status: string
          upcoming_reservations_raw: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          categories?: string[] | null
          categories_raw?: string | null
          chassis_number?: string | null
          color?: string | null
          created_at?: string
          current_location?: string | null
          expected_return_date?: string | null
          id?: string
          is_active?: boolean
          latest_return_date?: string | null
          make: string
          model: string
          notes?: string | null
          odometer?: number | null
          plate_number: string
          source_row_number?: number | null
          status?: string
          upcoming_reservations_raw?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          categories?: string[] | null
          categories_raw?: string | null
          chassis_number?: string | null
          color?: string | null
          created_at?: string
          current_location?: string | null
          expected_return_date?: string | null
          id?: string
          is_active?: boolean
          latest_return_date?: string | null
          make?: string
          model?: string
          notes?: string | null
          odometer?: number | null
          plate_number?: string
          source_row_number?: number | null
          status?: string
          upcoming_reservations_raw?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_staff: { Args: never; Returns: boolean }
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
