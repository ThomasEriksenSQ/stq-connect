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
      agent_contact_reviews: {
        Row: {
          action_taken: string
          contact_id: string | null
          created_at: string | null
          id: string
          reviewed_at: string
          reviewed_by: string | null
          signals_at_review: Json
        }
        Insert: {
          action_taken: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          reviewed_at?: string
          reviewed_by?: string | null
          signals_at_review?: Json
        }
        Update: {
          action_taken?: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          reviewed_at?: string
          reviewed_by?: string | null
          signals_at_review?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agent_contact_reviews_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ansatt_aktiviteter: {
        Row: {
          ansatt_id: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          subject: string
          type: string
        }
        Insert: {
          ansatt_id: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          subject: string
          type?: string
        }
        Update: {
          ansatt_id?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          subject?: string
          type?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          ikke_relevant: boolean | null
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
          ikke_relevant?: boolean | null
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
          ikke_relevant?: boolean | null
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
      company_aliases: {
        Row: {
          alias_name: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          normalized_alias: string
          source_company_id: string | null
        }
        Insert: {
          alias_name: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_alias: string
          source_company_id?: string | null
        }
        Update: {
          alias_name?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_alias?: string
          source_company_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_aliases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_merge_log: {
        Row: {
          created_at: string
          id: string
          merged_by: string | null
          relation_counts: Json
          source_company_id: string
          source_company_name: string
          source_snapshot: Json
          target_company_id: string
          target_company_name: string
          target_snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          merged_by?: string | null
          relation_counts?: Json
          source_company_id: string
          source_company_name: string
          source_snapshot?: Json
          target_company_id: string
          target_company_name: string
          target_snapshot?: Json
        }
        Update: {
          created_at?: string
          id?: string
          merged_by?: string | null
          relation_counts?: Json
          source_company_id?: string
          source_company_name?: string
          source_snapshot?: Json
          target_company_id?: string
          target_company_name?: string
          target_snapshot?: Json
        }
        Relationships: []
      }
      company_tech_profile: {
        Row: {
          company_id: string | null
          domener: string[] | null
          id: string
          konsulent_hyppighet: number | null
          oppdatert_at: string | null
          senioritet: string | null
          sist_fra_finn: string | null
          sist_oppdatert: string | null
          teknologier: Json | null
        }
        Insert: {
          company_id?: string | null
          domener?: string[] | null
          id?: string
          konsulent_hyppighet?: number | null
          oppdatert_at?: string | null
          senioritet?: string | null
          sist_fra_finn?: string | null
          sist_oppdatert?: string | null
          teknologier?: Json | null
        }
        Update: {
          company_id?: string | null
          domener?: string[] | null
          id?: string
          konsulent_hyppighet?: number | null
          oppdatert_at?: string | null
          senioritet?: string | null
          sist_fra_finn?: string | null
          sist_oppdatert?: string | null
          teknologier?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "company_tech_profile_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      consultants: {
        Row: {
          active: boolean | null
          bilde_posisjon: string | null
          competences: string[] | null
          created_at: string | null
          description: string | null
          education_1: string | null
          education_2: string | null
          experience_years: number | null
          id: string
          ikke_startet: boolean | null
          image_url: string | null
          industries: string[] | null
          kompetanse_nettside: string[] | null
          location: string | null
          name: string
          sort_order: number | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          bilde_posisjon?: string | null
          competences?: string[] | null
          created_at?: string | null
          description?: string | null
          education_1?: string | null
          education_2?: string | null
          experience_years?: number | null
          id?: string
          ikke_startet?: boolean | null
          image_url?: string | null
          industries?: string[] | null
          kompetanse_nettside?: string[] | null
          location?: string | null
          name: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          bilde_posisjon?: string | null
          competences?: string[] | null
          created_at?: string | null
          description?: string | null
          education_1?: string | null
          education_2?: string | null
          experience_years?: number | null
          id?: string
          ikke_startet?: boolean | null
          image_url?: string | null
          industries?: string[] | null
          kompetanse_nettside?: string[] | null
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
          department: string | null
          email: string | null
          first_name: string
          id: string
          ikke_aktuell_kontakt: boolean | null
          last_name: string
          linkedin: string | null
          location: string | null
          locations: string[] | null
          mailchimp_status: string | null
          next_review_at: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          sf_contact_id: string | null
          teknologier: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          call_list?: boolean
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          cv_email?: boolean
          department?: string | null
          email?: string | null
          first_name: string
          id?: string
          ikke_aktuell_kontakt?: boolean | null
          last_name: string
          linkedin?: string | null
          location?: string | null
          locations?: string[] | null
          mailchimp_status?: string | null
          next_review_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          sf_contact_id?: string | null
          teknologier?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          call_list?: boolean
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          cv_email?: boolean
          department?: string | null
          email?: string | null
          first_name?: string
          id?: string
          ikke_aktuell_kontakt?: boolean | null
          last_name?: string
          linkedin?: string | null
          location?: string | null
          locations?: string[] | null
          mailchimp_status?: string | null
          next_review_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          sf_contact_id?: string | null
          teknologier?: string[] | null
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
      cv_access_tokens: {
        Row: {
          ansatt_id: number
          created_at: string | null
          expires_at: string | null
          id: string
          pin_hash: string
          token: string
        }
        Insert: {
          ansatt_id: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          pin_hash: string
          token?: string
        }
        Update: {
          ansatt_id?: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          pin_hash?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_access_tokens_ansatt_id_fkey"
            columns: ["ansatt_id"]
            isOneToOne: false
            referencedRelation: "stacq_ansatte"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_documents: {
        Row: {
          additional_sections: Json
          ansatt_id: number
          competence_groups: Json | null
          created_at: string | null
          education: Json | null
          hero_name: string | null
          hero_title: string | null
          id: string
          intro_paragraphs: Json | null
          portrait_position: string | null
          portrait_url: string | null
          projects: Json | null
          sidebar_sections: Json | null
          title: string | null
          updated_at: string | null
          work_experience: Json | null
        }
        Insert: {
          additional_sections?: Json
          ansatt_id: number
          competence_groups?: Json | null
          created_at?: string | null
          education?: Json | null
          hero_name?: string | null
          hero_title?: string | null
          id?: string
          intro_paragraphs?: Json | null
          portrait_position?: string | null
          portrait_url?: string | null
          projects?: Json | null
          sidebar_sections?: Json | null
          title?: string | null
          updated_at?: string | null
          work_experience?: Json | null
        }
        Update: {
          additional_sections?: Json
          ansatt_id?: number
          competence_groups?: Json | null
          created_at?: string | null
          education?: Json | null
          hero_name?: string | null
          hero_title?: string | null
          id?: string
          intro_paragraphs?: Json | null
          portrait_position?: string | null
          portrait_url?: string | null
          projects?: Json | null
          sidebar_sections?: Json | null
          title?: string | null
          updated_at?: string | null
          work_experience?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cv_documents_ansatt_id_fkey"
            columns: ["ansatt_id"]
            isOneToOne: false
            referencedRelation: "stacq_ansatte"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_versions: {
        Row: {
          created_at: string | null
          cv_id: string
          id: string
          saved_by: string | null
          snapshot: Json
          source: string | null
        }
        Insert: {
          created_at?: string | null
          cv_id: string
          id?: string
          saved_by?: string | null
          snapshot: Json
          source?: string | null
        }
        Update: {
          created_at?: string | null
          cv_id?: string
          id?: string
          saved_by?: string | null
          snapshot?: Json
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cv_versions_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "cv_documents"
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
          matched_company_id: string | null
          selskap: string | null
          stillingsrolle: string | null
          teknologier: string | null
          teknologier_array: string[] | null
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
          matched_company_id?: string | null
          selskap?: string | null
          stillingsrolle?: string | null
          teknologier?: string | null
          teknologier_array?: string[] | null
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
          matched_company_id?: string | null
          selskap?: string | null
          stillingsrolle?: string | null
          teknologier?: string | null
          teknologier_array?: string[] | null
          uke?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finn_annonser_matched_company_id_fkey"
            columns: ["matched_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      outlook_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
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
      salgsagent_bruk: {
        Row: {
          brukt_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          brukt_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          brukt_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      stacq_ansatte: {
        Row: {
          ansatt_id: number | null
          bilde_url: string | null
          bio: string | null
          created_at: string | null
          cv_profil_hentet: boolean | null
          epost: string | null
          erfaring_aar: number | null
          fodselsdato: string | null
          geografi: string | null
          id: number
          kommentar: string | null
          kompetanse: string[] | null
          linkedin: string | null
          navn: string
          oppdrag_slutt: string | null
          slutt_dato: string | null
          start_dato: string | null
          status: string | null
          synlig_web: boolean | null
          tilgjengelig_fra: string | null
          tlf: string | null
          updated_at: string | null
        }
        Insert: {
          ansatt_id?: number | null
          bilde_url?: string | null
          bio?: string | null
          created_at?: string | null
          cv_profil_hentet?: boolean | null
          epost?: string | null
          erfaring_aar?: number | null
          fodselsdato?: string | null
          geografi?: string | null
          id?: number
          kommentar?: string | null
          kompetanse?: string[] | null
          linkedin?: string | null
          navn: string
          oppdrag_slutt?: string | null
          slutt_dato?: string | null
          start_dato?: string | null
          status?: string | null
          synlig_web?: boolean | null
          tilgjengelig_fra?: string | null
          tlf?: string | null
          updated_at?: string | null
        }
        Update: {
          ansatt_id?: number | null
          bilde_url?: string | null
          bio?: string | null
          created_at?: string | null
          cv_profil_hentet?: boolean | null
          epost?: string | null
          erfaring_aar?: number | null
          fodselsdato?: string | null
          geografi?: string | null
          id?: number
          kommentar?: string | null
          kompetanse?: string[] | null
          linkedin?: string | null
          navn?: string
          oppdrag_slutt?: string | null
          slutt_dato?: string | null
          start_dato?: string | null
          status?: string | null
          synlig_web?: boolean | null
          tilgjengelig_fra?: string | null
          tlf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stacq_oppdrag: {
        Row: {
          ansatt_id: number | null
          created_at: string | null
          deal_type: string | null
          ekstern_id: string | null
          ekstra_kostnad: number | null
          er_ansatt: boolean | null
          forny_dato: string | null
          id: number
          kandidat: string
          kommentar: string | null
          kunde: string | null
          lopende_30_dager: boolean | null
          oppdrag_id: number | null
          partner_navn: string | null
          partner_selskap_id: string | null
          selskap_id: string | null
          slutt_dato: string | null
          start_dato: string | null
          status: string | null
          til_konsulent: number | null
          til_konsulent_override: number | null
          utpris: number | null
        }
        Insert: {
          ansatt_id?: number | null
          created_at?: string | null
          deal_type?: string | null
          ekstern_id?: string | null
          ekstra_kostnad?: number | null
          er_ansatt?: boolean | null
          forny_dato?: string | null
          id?: number
          kandidat: string
          kommentar?: string | null
          kunde?: string | null
          lopende_30_dager?: boolean | null
          oppdrag_id?: number | null
          partner_navn?: string | null
          partner_selskap_id?: string | null
          selskap_id?: string | null
          slutt_dato?: string | null
          start_dato?: string | null
          status?: string | null
          til_konsulent?: number | null
          til_konsulent_override?: number | null
          utpris?: number | null
        }
        Update: {
          ansatt_id?: number | null
          created_at?: string | null
          deal_type?: string | null
          ekstern_id?: string | null
          ekstra_kostnad?: number | null
          er_ansatt?: boolean | null
          forny_dato?: string | null
          id?: number
          kandidat?: string
          kommentar?: string | null
          kunde?: string | null
          lopende_30_dager?: boolean | null
          oppdrag_id?: number | null
          partner_navn?: string | null
          partner_selskap_id?: string | null
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
            foreignKeyName: "stacq_oppdrag_ansatt_id_fkey"
            columns: ["ansatt_id"]
            isOneToOne: false
            referencedRelation: "stacq_ansatte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stacq_oppdrag_ekstern_id_fkey"
            columns: ["ekstern_id"]
            isOneToOne: false
            referencedRelation: "external_consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stacq_oppdrag_partner_selskap_id_fkey"
            columns: ["partner_selskap_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          calendar_synced: boolean | null
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          email_notify: boolean | null
          id: string
          priority: string
          sf_activity_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          calendar_synced?: boolean | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          email_notify?: boolean | null
          id?: string
          priority?: string
          sf_activity_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          calendar_synced?: boolean | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          email_notify?: boolean | null
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
      varslingsinnstillinger: {
        Row: {
          aktiv: boolean
          created_at: string | null
          epost_mottakere: string[]
          id: string
          markedsradar_aktiv: boolean
          markedsradar_epost_mottakere: string[]
          markedsradar_inkluder_ai: boolean
          markedsradar_send_etter_import: boolean
          markedsradar_sist_sendt_uke: string | null
          salgsagent_aktiv: boolean | null
          salgsagent_sist_sendt: string | null
          terskel_dager: number
          updated_at: string | null
        }
        Insert: {
          aktiv?: boolean
          created_at?: string | null
          epost_mottakere?: string[]
          id?: string
          markedsradar_aktiv?: boolean
          markedsradar_epost_mottakere?: string[]
          markedsradar_inkluder_ai?: boolean
          markedsradar_send_etter_import?: boolean
          markedsradar_sist_sendt_uke?: string | null
          salgsagent_aktiv?: boolean | null
          salgsagent_sist_sendt?: string | null
          terskel_dager?: number
          updated_at?: string | null
        }
        Update: {
          aktiv?: boolean
          created_at?: string | null
          epost_mottakere?: string[]
          id?: string
          markedsradar_aktiv?: boolean
          markedsradar_epost_mottakere?: string[]
          markedsradar_inkluder_ai?: boolean
          markedsradar_send_etter_import?: boolean
          markedsradar_sist_sendt_uke?: string | null
          salgsagent_aktiv?: boolean | null
          salgsagent_sist_sendt?: string | null
          terskel_dager?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      website_applications: {
        Row: {
          created_at: string | null
          cv_url: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          cv_url?: string | null
          email: string
          full_name: string
          id?: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          cv_url?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
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
      execute_company_merge: {
        Args: {
          p_merged_by?: string
          p_source_company_id: string
          p_target_company_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_company_alias: { Args: { value: string }; Returns: string }
      normalize_contact_phone: {
        Args: { input_value: string }
        Returns: string
      }
      rebuild_company_technical_dna: {
        Args: { target_company_id?: string }
        Returns: number
      }
      rebuild_contact_technical_dna: {
        Args: { target_company_id?: string; target_contact_id?: string }
        Returns: number
      }
      rebuild_technical_dna: {
        Args: { target_company_id?: string; target_contact_id?: string }
        Returns: Json
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
