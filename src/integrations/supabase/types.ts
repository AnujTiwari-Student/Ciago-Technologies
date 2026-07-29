export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attendance_records: {
        Row: {
          check_in: string | null;
          check_out: string | null;
          created_at: string;
          hours: number | null;
          id: string;
          regularization_reason: string | null;
          regularized_at: string | null;
          regularized_by: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          work_date: string;
        };
        Insert: {
          check_in?: string | null;
          check_out?: string | null;
          created_at?: string;
          hours?: number | null;
          id?: string;
          regularization_reason?: string | null;
          regularized_at?: string | null;
          regularized_by?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          work_date: string;
        };
        Update: {
          check_in?: string | null;
          check_out?: string | null;
          created_at?: string;
          hours?: number | null;
          id?: string;
          regularization_reason?: string | null;
          regularized_at?: string | null;
          regularized_by?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          work_date?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          details: Json;
          id: string;
          target_resource: string | null;
          timestamp: string;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          details?: Json;
          id?: string;
          target_resource?: string | null;
          timestamp?: string;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          details?: Json;
          id?: string;
          target_resource?: string | null;
          timestamp?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employee_tasks: {
        Row: {
          assigned_by: string | null;
          assignee_id: string;
          created_at: string;
          description: string | null;
          due_date: string | null;
          id: string;
          priority: string;
          project_reference: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_by?: string | null;
          assignee_id: string;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: string;
          project_reference?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_by?: string | null;
          assignee_id?: string;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: string;
          project_reference?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          account_status: string;
          address: string | null;
          background_check_status: string;
          base_salary: number | null;
          contact_number: string | null;
          created_at: string;
          department: Database["public"]["Enums"]["dept_type"] | null;
          designation: string | null;
          doc_verification_status: string;
          doj: string | null;
          employment_type: string | null;
          notes: string | null;
          personal_email: string | null;
          probation_months: number | null;
          probation_status: string;
          reporting_hr_id: string | null;
          reporting_manager_id: string | null;
          salary_currency: string;
          team_name: string | null;
          updated_at: string;
          user_id: string;
          work_email: string | null;
          work_location: string | null;
          work_model: string | null;
        };
        Insert: {
          account_status?: string;
          address?: string | null;
          background_check_status?: string;
          base_salary?: number | null;
          contact_number?: string | null;
          created_at?: string;
          department?: Database["public"]["Enums"]["dept_type"] | null;
          designation?: string | null;
          doc_verification_status?: string;
          doj?: string | null;
          employment_type?: string | null;
          notes?: string | null;
          personal_email?: string | null;
          probation_months?: number | null;
          probation_status?: string;
          reporting_hr_id?: string | null;
          reporting_manager_id?: string | null;
          salary_currency?: string;
          team_name?: string | null;
          updated_at?: string;
          user_id: string;
          work_email?: string | null;
          work_location?: string | null;
          work_model?: string | null;
        };
        Update: {
          account_status?: string;
          address?: string | null;
          background_check_status?: string;
          base_salary?: number | null;
          contact_number?: string | null;
          created_at?: string;
          department?: Database["public"]["Enums"]["dept_type"] | null;
          designation?: string | null;
          doc_verification_status?: string;
          doj?: string | null;
          employment_type?: string | null;
          notes?: string | null;
          personal_email?: string | null;
          probation_months?: number | null;
          probation_status?: string;
          reporting_hr_id?: string | null;
          reporting_manager_id?: string | null;
          salary_currency?: string;
          team_name?: string | null;
          updated_at?: string;
          user_id?: string;
          work_email?: string | null;
          work_location?: string | null;
          work_model?: string | null;
        };
        Relationships: [];
      };
      employment_types: {
        Row: {
          code: string;
          created_at: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      identity_documents: {
        Row: {
          created_at: string;
          doc_number: string | null;
          doc_type: string;
          feedback: string | null;
          id: string;
          status: string;
          storage_path: string | null;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          doc_number?: string | null;
          doc_type: string;
          feedback?: string | null;
          id?: string;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
          user_id: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          doc_number?: string | null;
          doc_type?: string;
          feedback?: string | null;
          id?: string;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
          user_id?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [];
      };
      in_app_notifications: {
        Row: {
          application_id: string | null;
          body: string;
          created_at: string;
          id: string;
          link: string | null;
          read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          application_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          application_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      interview_slots: {
        Row: {
          application_id: string;
          candidate_user_id: string;
          created_at: string;
          id: string;
          is_selected: boolean;
          location: string | null;
          notes: string | null;
          proposed_by: string;
          slot_at: string;
          updated_at: string;
        };
        Insert: {
          application_id: string;
          candidate_user_id: string;
          created_at?: string;
          id?: string;
          is_selected?: boolean;
          location?: string | null;
          notes?: string | null;
          proposed_by: string;
          slot_at: string;
          updated_at?: string;
        };
        Update: {
          application_id?: string;
          candidate_user_id?: string;
          created_at?: string;
          id?: string;
          is_selected?: boolean;
          location?: string | null;
          notes?: string | null;
          proposed_by?: string;
          slot_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_slots_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "job_applications";
            referencedColumns: ["id"];
          },
        ];
      };
      job_applications: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          email: string;
          full_name: string;
          id: string;
          is_soft_deleted: boolean;
          portfolio_url: string | null;
          resume_link: string | null;
          resume_storage_path: string | null;
          role_id: string;
          role_title: string;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          full_name: string;
          id?: string;
          is_soft_deleted?: boolean;
          portfolio_url?: string | null;
          resume_link?: string | null;
          resume_storage_path?: string | null;
          role_id: string;
          role_title: string;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_soft_deleted?: boolean;
          portfolio_url?: string | null;
          resume_link?: string | null;
          resume_storage_path?: string | null;
          role_id?: string;
          role_title?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      job_postings: {
        Row: {
          created_at: string;
          created_by: string | null;
          department: string;
          department_id: string | null;
          description: string;
          employment_type: string;
          id: string;
          internal_only: boolean;
          is_remote: boolean;
          job_code: string | null;
          location: string;
          required_onboarding_docs: string[];
          requirements: string[];
          salary_max_inr: number | null;
          salary_min_inr: number | null;
          status: Database["public"]["Enums"]["job_posting_status"];
          summary: string;
          tags: string[];
          title: string;
          track_type: Database["public"]["Enums"]["job_track_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          department: string;
          department_id?: string | null;
          description: string;
          employment_type?: string;
          id?: string;
          internal_only?: boolean;
          is_remote?: boolean;
          job_code?: string | null;
          location: string;
          required_onboarding_docs?: string[];
          requirements?: string[];
          salary_max_inr?: number | null;
          salary_min_inr?: number | null;
          status?: Database["public"]["Enums"]["job_posting_status"];
          summary: string;
          tags?: string[];
          title: string;
          track_type?: Database["public"]["Enums"]["job_track_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          department?: string;
          department_id?: string | null;
          description?: string;
          employment_type?: string;
          id?: string;
          internal_only?: boolean;
          is_remote?: boolean;
          job_code?: string | null;
          location?: string;
          required_onboarding_docs?: string[];
          requirements?: string[];
          salary_max_inr?: number | null;
          salary_min_inr?: number | null;
          status?: Database["public"]["Enums"]["job_posting_status"];
          summary?: string;
          tags?: string[];
          title?: string;
          track_type?: Database["public"]["Enums"]["job_track_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_postings_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          end_date: string;
          id: string;
          leave_type: string;
          reason: string | null;
          start_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          end_date: string;
          id?: string;
          leave_type?: string;
          reason?: string | null;
          start_date: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          end_date?: string;
          id?: string;
          leave_type?: string;
          reason?: string | null;
          start_date?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      onboarding_documents: {
        Row: {
          created_at: string;
          doc_key: string;
          feedback: string | null;
          id: string;
          onboarding_id: string;
          original_filename: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          storage_path: string;
          superseded_at: string | null;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          doc_key: string;
          feedback?: string | null;
          id?: string;
          onboarding_id: string;
          original_filename?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          storage_path: string;
          superseded_at?: string | null;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          doc_key?: string;
          feedback?: string | null;
          id?: string;
          onboarding_id?: string;
          original_filename?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          storage_path?: string;
          superseded_at?: string | null;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_onboarding_id_fkey";
            columns: ["onboarding_id"];
            isOneToOne: false;
            referencedRelation: "onboarding_records";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_records: {
        Row: {
          application_id: string;
          code_of_conduct_ack: boolean;
          compensation_inr: number | null;
          created_at: string;
          current_step: number;
          department: string | null;
          doj: string | null;
          emergency_contact: Json | null;
          form_state: Json;
          id: string;
          id_ack: boolean;
          offer_accepted_at: string | null;
          offer_declined_at: string | null;
          rejection_feedback: string | null;
          role_title: string;
          start_date: string | null;
          status: string;
          submitted_at: string | null;
          updated_at: string;
          user_id: string;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          application_id: string;
          code_of_conduct_ack?: boolean;
          compensation_inr?: number | null;
          created_at?: string;
          current_step?: number;
          department?: string | null;
          doj?: string | null;
          emergency_contact?: Json | null;
          form_state?: Json;
          id?: string;
          id_ack?: boolean;
          offer_accepted_at?: string | null;
          offer_declined_at?: string | null;
          rejection_feedback?: string | null;
          role_title: string;
          start_date?: string | null;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          user_id: string;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          application_id?: string;
          code_of_conduct_ack?: boolean;
          compensation_inr?: number | null;
          created_at?: string;
          current_step?: number;
          department?: string | null;
          doj?: string | null;
          emergency_contact?: Json | null;
          form_state?: Json;
          id?: string;
          id_ack?: boolean;
          offer_accepted_at?: string | null;
          offer_declined_at?: string | null;
          rejection_feedback?: string | null;
          role_title?: string;
          start_date?: string | null;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          user_id?: string;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_records_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: true;
            referencedRelation: "job_applications";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          full_name: string | null;
          leetcode: string | null;
          linkedin: string | null;
          portfolio: string | null;
          pronouns: string | null;
          public_email: string | null;
          updated_at: string;
          user_id: string;
          website: string | null;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          full_name?: string | null;
          leetcode?: string | null;
          linkedin?: string | null;
          portfolio?: string | null;
          pronouns?: string | null;
          public_email?: string | null;
          updated_at?: string;
          user_id: string;
          website?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          full_name?: string | null;
          leetcode?: string | null;
          linkedin?: string | null;
          portfolio?: string | null;
          pronouns?: string | null;
          public_email?: string | null;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      project_estimates: {
        Row: {
          budget_high: number;
          budget_low: number;
          company: string;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          project_type: string;
          scale: string;
          timeline: string;
        };
        Insert: {
          budget_high: number;
          budget_low: number;
          company: string;
          created_at?: string;
          email: string;
          full_name: string;
          id?: string;
          project_type: string;
          scale: string;
          timeline: string;
        };
        Update: {
          budget_high?: number;
          budget_low?: number;
          company?: string;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          project_type?: string;
          scale?: string;
          timeline?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          bucket: string;
          id: number;
          key: string;
          occurred_at: string;
        };
        Insert: {
          bucket: string;
          id?: number;
          key: string;
          occurred_at?: string;
        };
        Update: {
          bucket?: string;
          id?: number;
          key?: string;
          occurred_at?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          candidate_email: string;
          candidate_name: string;
          created_at: string;
          employee_id: string;
          id: string;
          job_posting_id: string | null;
          notes: string | null;
          referral_status: string;
          updated_at: string;
        };
        Insert: {
          candidate_email: string;
          candidate_name: string;
          created_at?: string;
          employee_id: string;
          id?: string;
          job_posting_id?: string | null;
          notes?: string | null;
          referral_status?: string;
          updated_at?: string;
        };
        Update: {
          candidate_email?: string;
          candidate_name?: string;
          created_at?: string;
          employee_id?: string;
          id?: string;
          job_posting_id?: string | null;
          notes?: string | null;
          referral_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_job_posting_id_fkey";
            columns: ["job_posting_id"];
            isOneToOne: false;
            referencedRelation: "job_postings";
            referencedColumns: ["id"];
          },
        ];
      };
      resignations: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          id: string;
          last_working_day: string;
          reason: string | null;
          status: string;
          submitted_on: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          id?: string;
          last_working_day: string;
          reason?: string | null;
          status?: string;
          submitted_on?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          id?: string;
          last_working_day?: string;
          reason?: string | null;
          status?: string;
          submitted_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      resource_downloads: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          resource_slug: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          resource_slug: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          resource_slug?: string;
        };
        Relationships: [];
      };
      salary_slips: {
        Row: {
          basic: number;
          created_at: string;
          generated_by: string | null;
          gross: number;
          hra: number;
          id: string;
          lwp_days: number;
          net_pay: number;
          period_month: number;
          period_year: number;
          pf_employee: number;
          pt: number;
          special: number;
          tds: number;
          total_deductions: number;
          updated_at: string;
          user_id: string;
          working_days: number;
        };
        Insert: {
          basic?: number;
          created_at?: string;
          generated_by?: string | null;
          gross?: number;
          hra?: number;
          id?: string;
          lwp_days?: number;
          net_pay?: number;
          period_month: number;
          period_year: number;
          pf_employee?: number;
          pt?: number;
          special?: number;
          tds?: number;
          total_deductions?: number;
          updated_at?: string;
          user_id: string;
          working_days?: number;
        };
        Update: {
          basic?: number;
          created_at?: string;
          generated_by?: string | null;
          gross?: number;
          hra?: number;
          id?: string;
          lwp_days?: number;
          net_pay?: number;
          period_month?: number;
          period_year?: number;
          pf_employee?: number;
          pt?: number;
          special?: number;
          tds?: number;
          total_deductions?: number;
          updated_at?: string;
          user_id?: string;
          working_days?: number;
        };
        Relationships: [];
      };
      salary_structures: {
        Row: {
          basic_monthly: number;
          created_at: string;
          created_by: string | null;
          ctc_annual_inr: number;
          effective_from: string;
          hra_monthly: number;
          id: string;
          pf_employee_monthly: number;
          pt_monthly: number;
          special_monthly: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          basic_monthly: number;
          created_at?: string;
          created_by?: string | null;
          ctc_annual_inr: number;
          effective_from?: string;
          hra_monthly?: number;
          id?: string;
          pf_employee_monthly?: number;
          pt_monthly?: number;
          special_monthly?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          basic_monthly?: number;
          created_at?: string;
          created_by?: string | null;
          ctc_annual_inr?: number;
          effective_from?: string;
          hra_monthly?: number;
          id?: string;
          pf_employee_monthly?: number;
          pt_monthly?: number;
          special_monthly?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      status_options: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          kind: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      timesheets: {
        Row: {
          created_at: string;
          date: string;
          employee_id: string;
          hours_logged: number;
          id: string;
          notes: string | null;
          project_reference: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          employee_id: string;
          hours_logged: number;
          id?: string;
          notes?: string | null;
          project_reference: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          employee_id?: string;
          hours_logged?: number;
          id?: string;
          notes?: string | null;
          project_reference?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          department_id: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          department_id?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          department_id?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_set_user_role: {
        Args: {
          _department_id?: string;
          _new_role: Database["public"]["Enums"]["app_role"];
          _target_user_id: string;
        };
        Returns: undefined;
      };
      apply_for_role: {
        Args: {
          _email: string;
          _full_name: string;
          _portfolio_url: string;
          _resume_link: string;
          _resume_storage_path: string;
          _role_id: string;
          _role_title: string;
        };
        Returns: {
          application_id: string;
        }[];
      };
      complete_onboarding: {
        Args: { _onboarding_id: string };
        Returns: undefined;
      };
      finalize_onboarding_role: {
        Args: { _onboarding_id: string };
        Returns: string;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin_user: { Args: { _uid: string }; Returns: boolean };
      list_directory: {
        Args: never;
        Returns: {
          background_check_status: string;
          base_salary: number;
          created_at: string;
          department: Database["public"]["Enums"]["dept_type"];
          designation: string;
          doc_verification_status: string;
          doj: string;
          email: string;
          employment_type: string;
          full_name: string;
          is_admin: boolean;
          probation_status: string;
          reporting_hr_id: string;
          reporting_manager_id: string;
          role: Database["public"]["Enums"]["app_role"];
          salary_currency: string;
          team_name: string;
          user_id: string;
          work_location: string;
          work_model: string;
        }[];
      };
      prune_rate_limits: { Args: never; Returns: undefined };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user" | "employee" | "hr" | "manager";
      dept_type:
        | "engineering"
        | "operations"
        | "human_resource"
        | "management"
        | "product"
        | "design"
        | "finance"
        | "sales"
        | "marketing"
        | "customer_support"
        | "legal"
        | "it_infrastructure";
      job_posting_status: "draft" | "published" | "internal_only" | "closed" | "archived";
      job_track_type: "standard" | "manager_track" | "hr_track";
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
      app_role: ["admin", "moderator", "user", "employee", "hr", "manager"],
      dept_type: [
        "engineering",
        "operations",
        "human_resource",
        "management",
        "product",
        "design",
        "finance",
        "sales",
        "marketing",
        "customer_support",
        "legal",
        "it_infrastructure",
      ],
      job_posting_status: ["draft", "published", "internal_only", "closed", "archived"],
      job_track_type: ["standard", "manager_track", "hr_track"],
    },
  },
} as const;
