export type DocumentType =
  | 'CR'
  | 'GOSI_CERT'
  | 'ZAKAT_CLEARANCE'
  | 'INSURANCE'
  | 'CHAMBER'
  | 'BALADY'
  | 'MISA'
  | 'LEASE'
  | 'SAUDIZATION_CERT'
  | 'BANK_STATEMENT'
  | 'TAX_REGISTRATION'
  | 'OTHER'

export type ObligationType =
  | 'CR_CONFIRMATION'
  | 'GOSI'
  | 'ZATCA_VAT'
  | 'CHAMBER'
  | 'ZAKAT'
  | 'BALADY'
  | 'MISA'
  | 'INSURANCE'
  | 'QIWA'
  | 'FOOD_SAFETY'
  | 'SAFETY_CERT'
  | 'HEALTH_LICENSE'
  | 'CUSTOM'

export type ObligationFrequency =
  | 'ONE_TIME'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'ANNUAL'
  | 'CUSTOM'

export type TransactionType = 'INCOME' | 'EXPENSE'

export type TransactionCategory =
  | 'REVENUE'
  | 'OTHER_INCOME'
  | 'GOVERNMENT'
  | 'SALARY'
  | 'RENT'
  | 'UTILITIES'
  | 'SUPPLIES'
  | 'TRANSPORT'
  | 'MARKETING'
  | 'PROFESSIONAL'
  | 'INSURANCE'
  | 'BANK_FEES'
  | 'OTHER_EXPENSE'

export type TransactionSource =
  | 'BANK_STATEMENT_CSV'
  | 'BANK_STATEMENT_PDF'
  | 'RECEIPT_PHOTO'
  | 'MANUAL'

export type BankStatementStatus =
  | 'PROCESSING'
  | 'REVIEW_PENDING'
  | 'COMPLETED'
  | 'FAILED'

export type TeamMemberStatus = 'ACTIVE' | 'TERMINATED'

export type BankStatementFileType = 'CSV' | 'PDF'

export type Business = {
  id: string
  user_id: string
  name_ar: string
  name_en: string | null
  cr_number: string
  activity_type: string | null
  city: string | null
  capital: number | null
  fiscal_year_end: string | null
  owners: Record<string, unknown>[] | null
  contact_phone: string | null
  contact_email: string | null
  contact_address: string | null
  logo_url: string | null
  stamp_url: string | null
  letterhead_config: Record<string, unknown> | null
  cr_issuance_date: string | null
  cr_expiry_date: string | null
  data_sharing_consent: boolean
  profile_history: Record<string, unknown>[] | null
  stripe_customer_id: string | null
  subscription_status: string | null
  subscription_tier: string | null
  cr_source: string | null
  wathq_last_checked_at: string | null
  wathq_cr_status: string | null
  vat_number: string | null
  created_at: string
  updated_at: string
}

export type ZatcaReportQueue = {
  id: string
  business_id: string
  invoice_id: string | null
  status: string
  payload: Record<string, unknown> | null
  error_message: string | null
  attempts: number
  dead_letter: boolean
  next_attempt_at: string | null
  created_at: string
  updated_at: string
}

export type UserProfile = {
  business_id: string | null
  user_id: string
  engagement_score: number | null
  health_score: number | null
  churn_risk_score: number | null
  lifecycle_stage: string | null
  days_since_signup: number | null
  last_active_at: string | null
  features_used_count: number | null
}

export type DetectedIssue = {
  id: string
  business_id: string | null
  issue_type: string
  severity: string
  status: string
  source: string
  title: string
  description: string | null
  feature_area: string | null
  evidence: Record<string, unknown>[] | null
  created_at: string
}

export type FeatureAdoption = {
  feature_name: string
  business_id: string
}

export type InAppNotification = {
  id: string
  business_id: string
  user_id: string | null
  title: string
  body: string | null
  action_url: string | null
  action_label: string | null
  type: string
  is_read: boolean
  dismissed_at: string | null
  created_at: string
}

export type UserEvent = {
  id: string
  user_id: string | null
  business_id: string | null
  event_type: string
  properties: Record<string, unknown> | null
  created_at: string
}

export type AiResponseCache = {
  cache_key: string
  task_type: string
  model: string
  response: unknown
  tokens_saved_in: number
  tokens_saved_out: number
  hit_count: number
  expires_at: string
  created_at: string
}

export type AiUsageLog = {
  id: string
  user_id: string
  business_id: string | null
  model: string
  tokens_in: number
  tokens_out: number
  cost_estimate: number
  task_type: string | null
  purpose: string
  ai_confidence: number | null
  escalated: boolean
  created_at: string
}

export type WathqLookupLog = {
  id: string
  business_id: string | null
  cr_number: string
  status: string
  response: Record<string, unknown> | null
  error_message: string | null
  created_at: string
}

export type TeamMember = {
  id: string
  business_id: string
  name: string
  nationality: string | null
  role: string | null
  iqama_number: string | null
  start_date: string | null
  salary: number | null
  status: TeamMemberStatus
  termination_date: string | null
  created_at: string
  updated_at: string
}

export type Document = {
  id: string
  business_id: string
  type: DocumentType
  name: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  expiry_date: string | null
  is_current: boolean
  extracted_data: Record<string, unknown> | null
  ai_confidence: number | null
  previous_version_id: string | null
  version_number: number
  uploaded_at: string
  archived_at: string | null
}

export type Obligation = {
  id: string
  business_id: string
  type: ObligationType
  name: string
  description: string | null
  frequency: ObligationFrequency
  next_due_date: string
  last_completed_at: string | null
  reminder_30d_sent: boolean
  reminder_15d_sent: boolean
  reminder_7d_sent: boolean
  reminder_1d_sent: boolean
  linked_document_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Transaction = {
  id: string
  business_id: string
  date: string
  amount: number
  type: TransactionType
  category: TransactionCategory | null
  description: string | null
  vendor_or_client: string | null
  source: TransactionSource
  source_file_id: string | null
  receipt_url: string | null
  linked_obligation_id: string | null
  vat_amount: number | null
  ai_confidence: number | null
  is_reviewed: boolean
  created_at: string
}

export type BankStatementUpload = {
  id: string
  business_id: string
  bank_name: string
  file_url: string
  file_type: BankStatementFileType
  period_start: string | null
  period_end: string | null
  transaction_count: number | null
  status: BankStatementStatus
  error_message: string | null
  created_at: string
}

export type GeneratedDocument = {
  id: string
  business_id: string
  type: string
  name: string
  file_url: string
  template_version: string | null
  data_snapshot: Record<string, unknown> | null
  created_at: string
}

export type ChatMessageRole = 'user' | 'assistant'

export type ChatConversation = {
  id: string
  business_id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  conversation_id: string
  role: ChatMessageRole
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

export type InvoiceType = 'standard' | 'simplified'

export type InvoiceSubtype = 'invoice' | 'credit_note' | 'debit_note'

export type InvoiceSource = 'mugdm' | 'imported_xml'

export type InvoiceLanguage = 'ar' | 'en' | 'both'

export type ZatcaStatus =
  | 'draft'
  | 'pending_clearance'
  | 'cleared'
  | 'reported'
  | 'rejected'

export type ZatcaCertType = 'compliance' | 'production'

export type Customer = {
  id: string
  business_id: string
  name: string
  name_en: string | null
  vat_number: string | null
  cr_number: string | null
  address: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export type Invoice = {
  id: string
  business_id: string
  customer_id: string | null
  invoice_number: string
  invoice_type: InvoiceType
  invoice_subtype: InvoiceSubtype
  source: InvoiceSource
  language: InvoiceLanguage
  issue_date: string
  supply_date: string | null
  due_date: string | null
  subtotal: number
  total_vat: number
  total_amount: number
  zatca_status: ZatcaStatus
  zatca_uuid: string | null
  zatca_hash: string | null
  zatca_qr_code: string | null
  zatca_xml: string | null
  zatca_response: Record<string, unknown> | null
  zatca_submitted_at: string | null
  zatca_cleared_at: string | null
  zatca_rejection_reason: string | null
  linked_invoice_id: string | null
  linked_transaction_id: string | null
  notes: string | null
  payment_terms: string | null
  created_at: string
  updated_at: string
}

export type InvoiceLineItem = {
  id: string
  invoice_id: string
  line_number: number
  description: string
  quantity: number
  unit_price: number
  discount_amount: number | null
  vat_rate: number
  vat_amount: number
  line_total: number
}

export type ZatcaCertificate = {
  id: string
  business_id: string
  cert_type: ZatcaCertType
  certificate: string
  private_key_encrypted: string
  issued_at: string
  expires_at: string
  is_active: boolean
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: Business
        Insert: Omit<Business, 'id' | 'created_at' | 'updated_at' | 'stripe_customer_id' | 'subscription_status' | 'subscription_tier'> & {
          id?: string
          created_at?: string
          updated_at?: string
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
        }
        Update: Partial<Omit<Business, 'id'>>
        Relationships: []
      }
      team_members: {
        Row: TeamMember
        Insert: Omit<TeamMember, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<TeamMember, 'id'>>
        Relationships: []
      }
      documents: {
        Row: Document
        Insert: Omit<Document, 'id' | 'uploaded_at' | 'version_number' | 'previous_version_id'> & {
          id?: string
          uploaded_at?: string
          version_number?: number
          previous_version_id?: string | null
        }
        Update: Partial<Omit<Document, 'id'>>
        Relationships: []
      }
      obligations: {
        Row: Obligation
        Insert: Omit<Obligation, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Obligation, 'id'>>
        Relationships: []
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<Transaction, 'id'>>
        Relationships: []
      }
      bank_statement_uploads: {
        Row: BankStatementUpload
        Insert: Omit<BankStatementUpload, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<BankStatementUpload, 'id'>>
        Relationships: []
      }
      generated_documents: {
        Row: GeneratedDocument
        Insert: Omit<GeneratedDocument, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<GeneratedDocument, 'id'>>
        Relationships: []
      }
      chat_conversations: {
        Row: ChatConversation
        Insert: Omit<ChatConversation, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<ChatConversation, 'id'>>
        Relationships: []
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Omit<ChatMessage, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<ChatMessage, 'id'>>
        Relationships: []
      }
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Customer, 'id'>>
        Relationships: []
      }
      invoices: {
        Row: Invoice
        Insert: Omit<Invoice, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Invoice, 'id'>>
        Relationships: []
      }
      invoice_line_items: {
        Row: InvoiceLineItem
        Insert: Omit<InvoiceLineItem, 'id'> & {
          id?: string
        }
        Update: Partial<Omit<InvoiceLineItem, 'id'>>
        Relationships: []
      }
      zatca_certificates: {
        Row: ZatcaCertificate
        Insert: Omit<ZatcaCertificate, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<ZatcaCertificate, 'id'>>
        Relationships: []
      }
      zatca_report_queue: {
        Row: ZatcaReportQueue
        Insert: Omit<ZatcaReportQueue, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<ZatcaReportQueue, 'id'>>
        Relationships: []
      }
      wathq_lookup_log: {
        Row: WathqLookupLog
        Insert: Omit<WathqLookupLog, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<WathqLookupLog, 'id'>>
        Relationships: []
      }
      user_profiles: {
        Row: UserProfile
        Insert: Partial<UserProfile> & { user_id: string }
        Update: Partial<UserProfile>
        Relationships: []
      }
      detected_issues: {
        Row: DetectedIssue
        Insert: Partial<DetectedIssue> & { issue_type: string; severity: string; status: string; source: string; title: string }
        Update: Partial<DetectedIssue>
        Relationships: []
      }
      feature_adoption: {
        Row: FeatureAdoption
        Insert: FeatureAdoption
        Update: Partial<FeatureAdoption>
        Relationships: []
      }
      in_app_notifications: {
        Row: InAppNotification
        Insert: Partial<InAppNotification> & { business_id: string; title: string; type: string }
        Update: Partial<InAppNotification>
        Relationships: []
      }
      user_events: {
        Row: UserEvent
        Insert: Partial<UserEvent> & { event_type: string }
        Update: Partial<UserEvent>
        Relationships: []
      }
      ai_response_cache: {
        Row: AiResponseCache
        Insert: Partial<AiResponseCache> & { cache_key: string; task_type: string; model: string }
        Update: Partial<AiResponseCache>
        Relationships: []
      }
      ai_usage_log: {
        Row: AiUsageLog
        Insert: Partial<AiUsageLog> & { user_id: string; model: string; tokens_in: number; tokens_out: number; cost_estimate: number; purpose: string }
        Update: Partial<AiUsageLog>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
