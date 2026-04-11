import type { Transaction, TransactionCategory, TransactionType, TransactionSource } from '@/lib/supabase/types'

interface DemoTransaction {
  date: string
  amount: number
  type: TransactionType
  category: TransactionCategory
  description: string
  vendor_or_client: string
  source: TransactionSource
  vat_amount: number | null
  ai_confidence: number | null
  is_reviewed: boolean
}

const RAW_DEMO_TRANSACTIONS: DemoTransaction[] = [
  // --- INCOME ---
  { date: '2026-03-15', amount: 45000, type: 'INCOME', category: 'REVENUE', description: 'عقد صيانة - شركة الراجحي', vendor_or_client: 'Al Rajhi Trading', source: 'MANUAL', vat_amount: 5869.57, ai_confidence: null, is_reviewed: true },
  { date: '2026-03-08', amount: 23000, type: 'INCOME', category: 'REVENUE', description: 'استشارات تقنية - الربع الأول', vendor_or_client: 'Saudi Telecom Co', source: 'BANK_STATEMENT_CSV', vat_amount: 3000, ai_confidence: 0.95, is_reviewed: true },
  { date: '2026-03-01', amount: 18500, type: 'INCOME', category: 'REVENUE', description: 'خدمات تصميم مواقع', vendor_or_client: 'Elm Company', source: 'MANUAL', vat_amount: 2413.04, ai_confidence: null, is_reviewed: true },
  { date: '2026-02-25', amount: 35000, type: 'INCOME', category: 'REVENUE', description: 'مشروع تطوير تطبيق - المرحلة 2', vendor_or_client: 'Tamkeen Technologies', source: 'BANK_STATEMENT_CSV', vat_amount: 4565.22, ai_confidence: 0.98, is_reviewed: true },
  { date: '2026-02-15', amount: 12000, type: 'INCOME', category: 'REVENUE', description: 'دعم فني شهري', vendor_or_client: 'Al Faisaliah Group', source: 'BANK_STATEMENT_CSV', vat_amount: 1565.22, ai_confidence: 0.92, is_reviewed: true },
  { date: '2026-02-01', amount: 55000, type: 'INCOME', category: 'REVENUE', description: 'عقد سنوي - خدمات سحابية', vendor_or_client: 'NEOM Tech', source: 'MANUAL', vat_amount: 7173.91, ai_confidence: null, is_reviewed: true },
  { date: '2026-01-20', amount: 8000, type: 'INCOME', category: 'OTHER_INCOME', description: 'إيراد إيجار معدات', vendor_or_client: 'Riyadh Equipment', source: 'BANK_STATEMENT_CSV', vat_amount: 1043.48, ai_confidence: 0.88, is_reviewed: true },
  { date: '2026-01-10', amount: 28000, type: 'INCOME', category: 'REVENUE', description: 'مشروع تحليل بيانات', vendor_or_client: 'Saudi Aramco', source: 'BANK_STATEMENT_CSV', vat_amount: 3652.17, ai_confidence: 0.97, is_reviewed: true },
  { date: '2025-12-20', amount: 42000, type: 'INCOME', category: 'REVENUE', description: 'خدمات استشارية - الربع الرابع', vendor_or_client: 'SABIC', source: 'MANUAL', vat_amount: 5478.26, ai_confidence: null, is_reviewed: true },
  { date: '2025-12-05', amount: 15000, type: 'INCOME', category: 'REVENUE', description: 'تدريب موظفين - برنامج متقدم', vendor_or_client: 'Mobily Academy', source: 'BANK_STATEMENT_CSV', vat_amount: 1956.52, ai_confidence: 0.91, is_reviewed: true },
  { date: '2025-11-15', amount: 32000, type: 'INCOME', category: 'REVENUE', description: 'تطوير نظام ERP مخصص', vendor_or_client: 'Al Marai', source: 'MANUAL', vat_amount: 4173.91, ai_confidence: null, is_reviewed: true },
  { date: '2025-10-25', amount: 19000, type: 'INCOME', category: 'REVENUE', description: 'صيانة أنظمة - ربع سنوي', vendor_or_client: 'Jarir Bookstore', source: 'BANK_STATEMENT_CSV', vat_amount: 2478.26, ai_confidence: 0.94, is_reviewed: true },

  // --- EXPENSES ---
  { date: '2026-03-15', amount: 4200, type: 'EXPENSE', category: 'GOVERNMENT', description: 'اشتراكات التأمينات الاجتماعية', vendor_or_client: 'GOSI', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2026-03-10', amount: 8500, type: 'EXPENSE', category: 'RENT', description: 'إيجار المكتب - شهر مارس', vendor_or_client: 'Al Malki Real Estate', source: 'BANK_STATEMENT_CSV', vat_amount: 1108.70, ai_confidence: 0.97, is_reviewed: true },
  { date: '2026-03-05', amount: 15000, type: 'EXPENSE', category: 'SALARY', description: 'رواتب الموظفين - مارس', vendor_or_client: 'Payroll', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2026-03-03', amount: 2800, type: 'EXPENSE', category: 'MARKETING', description: 'حملة إعلانية - Google Ads', vendor_or_client: 'Google Ads', source: 'BANK_STATEMENT_CSV', vat_amount: 365.22, ai_confidence: 0.93, is_reviewed: true },
  { date: '2026-03-01', amount: 750, type: 'EXPENSE', category: 'UTILITIES', description: 'فاتورة الكهرباء - مارس', vendor_or_client: 'SEC', source: 'BANK_STATEMENT_CSV', vat_amount: 97.83, ai_confidence: 0.96, is_reviewed: true },
  { date: '2026-02-28', amount: 450, type: 'EXPENSE', category: 'UTILITIES', description: 'فاتورة الإنترنت', vendor_or_client: 'STC Business', source: 'BANK_STATEMENT_CSV', vat_amount: 58.70, ai_confidence: 0.95, is_reviewed: true },
  { date: '2026-02-25', amount: 3500, type: 'EXPENSE', category: 'PROFESSIONAL', description: 'أتعاب المحاسب القانوني', vendor_or_client: 'KPMG', source: 'MANUAL', vat_amount: 456.52, ai_confidence: null, is_reviewed: true },
  { date: '2026-02-20', amount: 1200, type: 'EXPENSE', category: 'SUPPLIES', description: 'مستلزمات مكتبية', vendor_or_client: 'Jarir Bookstore', source: 'RECEIPT_PHOTO', vat_amount: 156.52, ai_confidence: 0.85, is_reviewed: true },
  { date: '2026-02-15', amount: 4200, type: 'EXPENSE', category: 'GOVERNMENT', description: 'اشتراكات التأمينات الاجتماعية', vendor_or_client: 'GOSI', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2026-02-10', amount: 8500, type: 'EXPENSE', category: 'RENT', description: 'إيجار المكتب - شهر فبراير', vendor_or_client: 'Al Malki Real Estate', source: 'BANK_STATEMENT_CSV', vat_amount: 1108.70, ai_confidence: 0.97, is_reviewed: true },
  { date: '2026-02-05', amount: 15000, type: 'EXPENSE', category: 'SALARY', description: 'رواتب الموظفين - فبراير', vendor_or_client: 'Payroll', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2026-02-01', amount: 6500, type: 'EXPENSE', category: 'INSURANCE', description: 'تأمين طبي - ربع سنوي', vendor_or_client: 'Bupa Arabia', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.94, is_reviewed: true },
  { date: '2026-01-28', amount: 1800, type: 'EXPENSE', category: 'TRANSPORT', description: 'مواصلات ورحلات عمل', vendor_or_client: 'Uber Business', source: 'BANK_STATEMENT_CSV', vat_amount: 234.78, ai_confidence: 0.87, is_reviewed: true },
  { date: '2026-01-15', amount: 4200, type: 'EXPENSE', category: 'GOVERNMENT', description: 'اشتراكات التأمينات الاجتماعية', vendor_or_client: 'GOSI', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2026-01-10', amount: 8500, type: 'EXPENSE', category: 'RENT', description: 'إيجار المكتب - شهر يناير', vendor_or_client: 'Al Malki Real Estate', source: 'BANK_STATEMENT_CSV', vat_amount: 1108.70, ai_confidence: 0.97, is_reviewed: true },
  { date: '2026-01-05', amount: 15000, type: 'EXPENSE', category: 'SALARY', description: 'رواتب الموظفين - يناير', vendor_or_client: 'Payroll', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2026-01-02', amount: 350, type: 'EXPENSE', category: 'BANK_FEES', description: 'رسوم بنكية - يناير', vendor_or_client: 'Al Rajhi Bank', source: 'BANK_STATEMENT_CSV', vat_amount: 45.65, ai_confidence: 0.98, is_reviewed: true },
  { date: '2025-12-15', amount: 4200, type: 'EXPENSE', category: 'GOVERNMENT', description: 'اشتراكات التأمينات الاجتماعية', vendor_or_client: 'GOSI', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2025-12-10', amount: 8500, type: 'EXPENSE', category: 'RENT', description: 'إيجار المكتب - ديسمبر', vendor_or_client: 'Al Malki Real Estate', source: 'BANK_STATEMENT_CSV', vat_amount: 1108.70, ai_confidence: 0.97, is_reviewed: true },
  { date: '2025-12-05', amount: 15000, type: 'EXPENSE', category: 'SALARY', description: 'رواتب الموظفين - ديسمبر', vendor_or_client: 'Payroll', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2025-11-20', amount: 2200, type: 'EXPENSE', category: 'MARKETING', description: 'تصميم مواد تسويقية', vendor_or_client: 'Creative Studio', source: 'RECEIPT_PHOTO', vat_amount: 286.96, ai_confidence: 0.82, is_reviewed: true },
  { date: '2025-11-10', amount: 8500, type: 'EXPENSE', category: 'RENT', description: 'إيجار المكتب - نوفمبر', vendor_or_client: 'Al Malki Real Estate', source: 'BANK_STATEMENT_CSV', vat_amount: 1108.70, ai_confidence: 0.97, is_reviewed: true },
  { date: '2025-11-05', amount: 15000, type: 'EXPENSE', category: 'SALARY', description: 'رواتب الموظفين - نوفمبر', vendor_or_client: 'Payroll', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2025-10-15', amount: 4200, type: 'EXPENSE', category: 'GOVERNMENT', description: 'اشتراكات التأمينات الاجتماعية', vendor_or_client: 'GOSI', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2025-10-10', amount: 8500, type: 'EXPENSE', category: 'RENT', description: 'إيجار المكتب - أكتوبر', vendor_or_client: 'Al Malki Real Estate', source: 'BANK_STATEMENT_CSV', vat_amount: 1108.70, ai_confidence: 0.97, is_reviewed: true },
  { date: '2025-10-05', amount: 15000, type: 'EXPENSE', category: 'SALARY', description: 'رواتب الموظفين - أكتوبر', vendor_or_client: 'Payroll', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: true },
  { date: '2025-10-02', amount: 950, type: 'EXPENSE', category: 'OTHER_EXPENSE', description: 'مصاريف متنوعة', vendor_or_client: 'Various', source: 'MANUAL', vat_amount: 123.91, ai_confidence: null, is_reviewed: true },
]

function toTransaction(demo: DemoTransaction, index: number): Transaction {
  return {
    id: `demo-${String(index + 1).padStart(3, '0')}`,
    business_id: 'demo-business-001',
    date: demo.date,
    amount: demo.amount,
    type: demo.type,
    category: demo.category,
    description: demo.description,
    vendor_or_client: demo.vendor_or_client,
    source: demo.source,
    source_file_id: null,
    receipt_url: null,
    linked_obligation_id: null,
    vat_amount: demo.vat_amount,
    ai_confidence: demo.ai_confidence,
    is_reviewed: demo.is_reviewed,
    created_at: demo.date,
  }
}

export const DEMO_TRANSACTIONS: Transaction[] = RAW_DEMO_TRANSACTIONS.map(toTransaction)

export function getDemoTransactionsForUpload(): Transaction[] {
  const UPLOAD_BASE: DemoTransaction[] = [
    { date: '2026-03-28', amount: 12500, type: 'INCOME', category: 'REVENUE', description: 'دفعة مشروع تصميم', vendor_or_client: 'Design Hub', source: 'BANK_STATEMENT_CSV', vat_amount: 1630.43, ai_confidence: 0.72, is_reviewed: false },
    { date: '2026-03-27', amount: 3200, type: 'EXPENSE', category: 'MARKETING', description: 'إعلانات سوشيال ميديا', vendor_or_client: 'Meta Ads', source: 'BANK_STATEMENT_CSV', vat_amount: 417.39, ai_confidence: 0.88, is_reviewed: false },
    { date: '2026-03-26', amount: 890, type: 'EXPENSE', category: 'SUPPLIES', description: 'حبر طابعات وورق', vendor_or_client: 'Office Depot', source: 'BANK_STATEMENT_CSV', vat_amount: 116.09, ai_confidence: 0.91, is_reviewed: false },
    { date: '2026-03-25', amount: 28000, type: 'INCOME', category: 'REVENUE', description: 'عقد صيانة سنوي', vendor_or_client: 'Rasan', source: 'BANK_STATEMENT_CSV', vat_amount: 3652.17, ai_confidence: 0.96, is_reviewed: false },
    { date: '2026-03-24', amount: 1500, type: 'EXPENSE', category: 'TRANSPORT', description: 'تذاكر طيران داخلي', vendor_or_client: 'Flynas', source: 'BANK_STATEMENT_CSV', vat_amount: 195.65, ai_confidence: 0.85, is_reviewed: false },
    { date: '2026-03-23', amount: 750, type: 'EXPENSE', category: 'UTILITIES', description: 'فاتورة المياه', vendor_or_client: 'NWC', source: 'BANK_STATEMENT_CSV', vat_amount: 97.83, ai_confidence: 0.94, is_reviewed: false },
    { date: '2026-03-22', amount: 5800, type: 'EXPENSE', category: 'PROFESSIONAL', description: 'استشارة قانونية', vendor_or_client: 'Baker McKenzie', source: 'BANK_STATEMENT_CSV', vat_amount: 756.52, ai_confidence: 0.65, is_reviewed: false },
    { date: '2026-03-21', amount: 420, type: 'EXPENSE', category: 'BANK_FEES', description: 'عمولة تحويل دولي', vendor_or_client: 'Al Rajhi Bank', source: 'BANK_STATEMENT_CSV', vat_amount: 54.78, ai_confidence: 0.97, is_reviewed: false },
    { date: '2026-03-20', amount: 16000, type: 'INCOME', category: 'REVENUE', description: 'دفعة استشارات شهرية', vendor_or_client: 'Thiqah', source: 'BANK_STATEMENT_CSV', vat_amount: 2086.96, ai_confidence: 0.93, is_reviewed: false },
    { date: '2026-03-19', amount: 2100, type: 'EXPENSE', category: 'SUPPLIES', description: 'أثاث مكتبي', vendor_or_client: 'IKEA', source: 'BANK_STATEMENT_CSV', vat_amount: 273.91, ai_confidence: 0.78, is_reviewed: false },
    { date: '2026-03-18', amount: 680, type: 'EXPENSE', category: 'OTHER_EXPENSE', description: 'هدايا عملاء', vendor_or_client: 'Gift Shop', source: 'BANK_STATEMENT_CSV', vat_amount: 88.70, ai_confidence: 0.55, is_reviewed: false },
    { date: '2026-03-17', amount: 9200, type: 'INCOME', category: 'OTHER_INCOME', description: 'عمولة إحالة عميل', vendor_or_client: 'Partner Co', source: 'BANK_STATEMENT_CSV', vat_amount: 1200, ai_confidence: 0.61, is_reviewed: false },
    { date: '2026-03-16', amount: 15000, type: 'EXPENSE', category: 'SALARY', description: 'رواتب موظفين - مكمل', vendor_or_client: 'Payroll', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.99, is_reviewed: false },
    { date: '2026-03-15', amount: 4200, type: 'EXPENSE', category: 'GOVERNMENT', description: 'رسوم تجديد السجل التجاري', vendor_or_client: 'MoC', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.92, is_reviewed: false },
    { date: '2026-03-14', amount: 1350, type: 'EXPENSE', category: 'MARKETING', description: 'طباعة بروشورات', vendor_or_client: 'Print House', source: 'BANK_STATEMENT_CSV', vat_amount: 176.09, ai_confidence: 0.83, is_reviewed: false },
    { date: '2026-03-13', amount: 22000, type: 'INCOME', category: 'REVENUE', description: 'مشروع تطوير موقع', vendor_or_client: 'Vision 2030 Fund', source: 'BANK_STATEMENT_CSV', vat_amount: 2869.57, ai_confidence: 0.95, is_reviewed: false },
    { date: '2026-03-12', amount: 3800, type: 'EXPENSE', category: 'INSURANCE', description: 'تأمين مركبات الشركة', vendor_or_client: 'Tawuniya', source: 'BANK_STATEMENT_CSV', vat_amount: null, ai_confidence: 0.89, is_reviewed: false },
  ]

  return UPLOAD_BASE.map((demo, i) => toTransaction(demo, 100 + i))
}

export const SAUDI_BANKS = [
  { id: 'alrajhi', nameEn: 'Al Rajhi Bank', nameAr: 'مصرف الراجحي' },
  { id: 'snb', nameEn: 'Saudi National Bank', nameAr: 'البنك الأهلي السعودي' },
  { id: 'riyad', nameEn: 'Riyad Bank', nameAr: 'بنك الرياض' },
  { id: 'alinma', nameEn: 'Alinma Bank', nameAr: 'مصرف الإنماء' },
  { id: 'albilad', nameEn: 'Bank AlBilad', nameAr: 'بنك البلاد' },
  { id: 'sab', nameEn: 'SAB (HSBC)', nameAr: 'ساب' },
  { id: 'bsf', nameEn: 'Banque Saudi Fransi', nameAr: 'البنك السعودي الفرنسي' },
  { id: 'anb', nameEn: 'Arab National Bank', nameAr: 'البنك العربي الوطني' },
  { id: 'aljazira', nameEn: 'Bank AlJazira', nameAr: 'بنك الجزيرة' },
  { id: 'gib', nameEn: 'Gulf International Bank', nameAr: 'بنك الخليج الدولي' },
  { id: 'saib', nameEn: 'Saudi Investment Bank', nameAr: 'البنك السعودي للاستثمار' },
  { id: 'emi', nameEn: 'Emirates NBD Saudi', nameAr: 'الإمارات دبي الوطني' },
] as const
