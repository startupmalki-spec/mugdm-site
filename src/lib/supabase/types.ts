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

export interface Business {
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
  created_at: string
  updated_at: string
}

export interface TeamMember {
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

export interface Document {
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

export interface Obligation {
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

export interface Transaction {
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

export interface BankStatementUpload {
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

export interface GeneratedDocument {
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

export interface ChatConversation {
  id: string
  business_id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  role: ChatMessageRole
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: Business
        Insert: Omit<Business, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Business, 'id'>>

      }
      team_members: {
        Row: TeamMember
        Insert: Omit<TeamMember, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<TeamMember, 'id'>>

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

      }
      obligations: {
        Row: Obligation
        Insert: Omit<Obligation, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Obligation, 'id'>>

      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<Transaction, 'id'>>

      }
      bank_statement_uploads: {
        Row: BankStatementUpload
        Insert: Omit<BankStatementUpload, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<BankStatementUpload, 'id'>>

      }
      generated_documents: {
        Row: GeneratedDocument
        Insert: Omit<GeneratedDocument, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<GeneratedDocument, 'id'>>

      }
      chat_conversations: {
        Row: ChatConversation
        Insert: Omit<ChatConversation, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<ChatConversation, 'id'>>

      }
      chat_messages: {
        Row: ChatMessage
        Insert: Omit<ChatMessage, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<ChatMessage, 'id'>>

      }
    }
  }
}
