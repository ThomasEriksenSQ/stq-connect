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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          sf_activity_id: string | null
          subject: string
          type: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          sf_activity_id?: string | null
          subject: string
          type?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          sf_activity_id?: string | null
          subject?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          industry: string | null
          linkedin: string | null
          name: string
          notes: string | null
          org_number: string | null
          owner_id: string | null
          phone: string | null
          sf_account_id: string | null
          status: string
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          linkedin?: string | null
          name: string
          notes?: string | null
          org_number?: string | null
          owner_id?: string | null
          phone?: string | null
          sf_account_id?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          linkedin?: string | null
          name?: string
          notes?: string | null
          org_number?: string | null
          owner_id?: string | null
          phone?: string | null
          sf_account_id?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultants: {
        Row: {
          active: boolean | null
          competences: string[] | null
          created_at: string | null
          description: string | null
          experience_years: number | null
          id: string
          image_url: string | null
          industries: string[] | null
          location: string | null
          name: string
          sort_order: number | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          competences?: string[] | null
          created_at?: string | null
          description?: string | null
          experience_years?: number | null
          id?: string
          image_url?: string | null
          industries?: string[] | null
          location?: string | null
          name: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          competences?: string[] | null
          created_at?: string | null
          description?: string | null
          experience_years?: number | null
          id?: string
          image_url?: string | null
          industries?: string[] | null
          location?: string | null
          name?: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          call_list: boolean
          company_id: string | null
          created_at: string
          created_by: string | null
          cv_email: boolean
          email: string | null
          first_name: string
          id: string
          last_name: string
          linkedin: string | null
          location: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          sf_contact_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          call_list?: boolean
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          cv_email?: boolean
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          linkedin?: string | null
          location?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          sf_contact_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          call_list?: boolean
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          cv_email?: boolean
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          linkedin?: string | null
          location?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          sf_contact_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_consultants: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          cv_tekst: string | null
          cv_url: string | null
          epost: string | null
          erfaring_aar: number | null
          id: string
          innpris_time: number | null
          kapasitet_prosent: number | null
          navn: string | null
          notat: string | null
          rolle: string | null
          selskap_tekst: string | null
          status: string
          teknologier: string[] | null
          telefon: string | null
          tilgjengelig_fra: string | null
          tilgjengelig_til: string | null
          type: string
          updated_at: string
          utpris_time: number | null
          valuta: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          cv_tekst?: string | null
          cv_url?: string | null
          epost?: string | null
          erfaring_aar?: number | null
          id?: string
          innpris_time?: number | null
          kapasitet_prosent?: number | null
          navn?: string | null
          notat?: string | null
          rolle?: string | null
          selskap_tekst?: string | null
          status?: string
          teknologier?: string[] | null
          telefon?: string | null
          tilgjengelig_fra?: string | null
          tilgjengelig_til?: string | null
          type?: string
          updated_at?: string
          utpris_time?: number | null
          valuta?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          cv_tekst?: string | null
          cv_url?: string | null
          epost?: string | null
          erfaring_aar?: number | null
          id?: string
          innpris_time?: number | null
          kapasitet_prosent?: number | null
          navn?: string | null
          notat?: string | null
          rolle?: string | null
          selskap_tekst?: string | null
          status?: string
          teknologier?: string[] | null
          telefon?: string | null
          tilgjengelig_fra?: string | null
          tilgjengelig_til?: string | null
          type?: string
          updated_at?: string
          utpris_time?: number | null
          valuta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_consultants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_consultants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      finn_annonser: {
        Row: {
          created_at: string | null
          dato: string
          id: string
          kontakt_epost: string | null
          kontakt_telefon: string | null
          kontaktnavn: string | null
          lenke: string | null
          lokasjon: string | null
          selskap: string | null
          stillingsrolle: string | null
          teknologier: string | null
          uke: string | null
        }
        Insert: {
          created_at?: string | null
          dato: string
          id?: string
          kontakt_epost?: string | null
          kontakt_telefon?: string | null
          kontaktnavn?: string | null
          lenke?: string | null
          lokasjon?: string | null
          selskap?: string | null
          stillingsrolle?: string | null
          teknologier?: string | null
          uke?: string | null
        }
        Update: {
          created_at?: string | null
          dato?: string
          id?: string
          kontakt_epost?: string | null
          kontakt_telefon?: string | null
          kontaktnavn?: string | null
          lenke?: string | null
          lokasjon?: string | null
          selskap?: string | null
          stillingsrolle?: string | null
          teknologier?: string | null
          uke?: string | null
        }
        Relationships: []
      }
      foresporsler: {
        Row: {
          avdeling: string | null
          created_at: string | null
          created_by: string | null
          frist_dato: string | null
          id: number
          kommentar: string | null
          kontakt_id: string | null
          mottatt_dato: string
          referanse: string | null
          selskap_id: string | null
          selskap_navn: string
          sluttkunde: string | null
          status: string | null
          sted: string | null
          teknologier: string[] | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          avdeling?: string | null
          created_at?: string | null
          created_by?: string | null
          frist_dato?: string | null
          id?: number
          kommentar?: string | null
          kontakt_id?: string | null
          mottatt_dato?: string
          referanse?: string | null
          selskap_id?: string | null
          selskap_navn: string
          sluttkunde?: string | null
          status?: string | null
          sted?: string | null
          teknologier?: string[] | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          avdeling?: string | null
          created_at?: string | null
          created_by?: string | null
          frist_dato?: string | null
          id?: number
          kommentar?: string | null
          kontakt_id?: string | null
          mottatt_dato?: string
          referanse?: string | null
          selskap_id?: string | null
          selskap_navn?: string
          sluttkunde?: string | null
          status?: string | null
          sted?: string | null
          teknologier?: string[] | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foresporsler_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foresporsler_selskap_id_fkey"
            columns: ["selskap_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      foresporsler_konsulenter: {
        Row: {
          ansatt_id: number | null
          created_at: string | null
          ekstern_id: string | null
          foresporsler_id: number
          id: string
          konsulent_type: string
          status: string
          status_updated_at: string
        }
        Insert: {
          ansatt_id?: number | null
          created_at?: string | null
          ekstern_id?: string | null
          foresporsler_id: number
          id?: string
          konsulent_type?: string
          status?: string
          status_updated_at?: string
        }
        Update: {
          ansatt_id?: number | null
          created_at?: string | null
          ekstern_id?: string | null
          foresporsler_id?: number
          id?: string
          konsulent_type?: string
          status?: string
          status_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foresporsler_konsulenter_ansatt_id_fkey"
            columns: ["ansatt_id"]
            isOneToOne: false
            referencedRelation: "stacq_ansatte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foresporsler_konsulenter_ekstern_id_fkey"
            columns: ["ekstern_id"]
            isOneToOne: false
            referencedRelation: "external_consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foresporsler_konsulenter_foresporsler_id_fkey"
            columns: ["foresporsler_id"]
            isOneToOne: false
            referencedRelation: "foresporsler"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          active: boolean
          category: string
          content: string
          created_at: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          category: string
          content: string
          created_at?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stacq_ansatte: {
        Row: {
          ansatt_id: number | null
          bilde_url: string | null
          bio: string | null
          created_at: string | null
          epost: string | null
          erfaring_aar: number | null
          geografi: string | null
          id: number
          kommentar: string | null
          kompetanse: string[] | null
          linkedin: string | null
          navn: string
          slutt_dato: string | null
          start_dato: string | null
          status: string | null
          synlig_web: boolean | null
          tlf: string | null
          updated_at: string | null
        }
        Insert: {
          ansatt_id?: number | null
          bilde_url?: string | null
          bio?: string | null
          created_at?: string | null
          epost?: string | null
          erfaring_aar?: number | null
          geografi?: string | null
          id?: number
          kommentar?: string | null
          kompetanse?: string[] | null
          linkedin?: string | null
          navn: string
          slutt_dato?: string | null
          start_dato?: string | null
          status?: string | null
          synlig_web?: boolean | null
          tlf?: string | null
          updated_at?: string | null
        }
        Update: {
          ansatt_id?: number | null
          bilde_url?: string | null
          bio?: string | null
          created_at?: string | null
          epost?: string | null
          erfaring_aar?: number | null
          geografi?: string | null
          id?: number
          kommentar?: string | null
          kompetanse?: string[] | null
          linkedin?: string | null
          navn?: string
          slutt_dato?: string | null
          start_dato?: string | null
          status?: string | null
          synlig_web?: boolean | null
          tlf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stacq_oppdrag: {
        Row: {
          created_at: string | null
          deal_type: string | null
          ekstra_kostnad: number | null
          er_ansatt: boolean | null
          forny_dato: string | null
          id: number
          kandidat: string
          kommentar: string | null
          kunde: string | null
          oppdrag_id: number | null
          selskap_id: string | null
          slutt_dato: string | null
          start_dato: string | null
          status: string | null
          til_konsulent: number | null
          til_konsulent_override: number | null
          utpris: number | null
        }
        Insert: {
          created_at?: string | null
          deal_type?: string | null
          ekstra_kostnad?: number | null
          er_ansatt?: boolean | null
          forny_dato?: string | null
          id?: number
          kandidat: string
          kommentar?: string | null
          kunde?: string | null
          oppdrag_id?: number | null
          selskap_id?: string | null
          slutt_dato?: string | null
          start_dato?: string | null
          status?: string | null
          til_konsulent?: number | null
          til_konsulent_override?: number | null
          utpris?: number | null
        }
        Update: {
          created_at?: string | null
          deal_type?: string | null
          ekstra_kostnad?: number | null
          er_ansatt?: boolean | null
          forny_dato?: string | null
          id?: number
          kandidat?: string
          kommentar?: string | null
          kunde?: string | null
          oppdrag_id?: number | null
          selskap_id?: string | null
          slutt_dato?: string | null
          start_dato?: string | null
          status?: string | null
          til_konsulent?: number | null
          til_konsulent_override?: number | null
          utpris?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stacq_oppdrag_selskap_id_fkey"
            columns: ["selskap_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          sf_activity_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          sf_activity_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          sf_activity_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_leads: {
        Row: {
          consultant_name: string | null
          created_at: string | null
          email: string
          id: string
          message: string | null
        }
        Insert: {
          consultant_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          message?: string | null
        }
        Update: {
          consultant_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string | null
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
