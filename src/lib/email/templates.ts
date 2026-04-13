type Locale = 'en' | 'ar'

interface TemplateOptions {
  locale?: Locale
}

const ARABIC_FONT = "'Segoe UI', Tahoma, 'Noto Sans Arabic', sans-serif"
const ENGLISH_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

function resolveLocale(options?: TemplateOptions): Locale {
  return options?.locale ?? 'en'
}

function baseLayout(content: string, options?: TemplateOptions): string {
  const locale = resolveLocale(options)
  const isAr = locale === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'
  const font = isAr ? ARABIC_FONT : ENGLISH_FONT
  const tagline = isAr ? 'العقل الثاني لأعمالك' : "Your Business's Second Brain"
  const footerTagline = isAr ? 'مُقدِم &mdash; العقل الثاني لأعمالك' : "Mugdm &mdash; Your Business's Second Brain"
  const unsubscribeLabel = isAr ? 'إلغاء الاشتراك' : 'Unsubscribe'

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isAr ? 'مُقدِم' : 'Mugdm'}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:${font};direction:${dir};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;text-align:center;border-bottom:2px solid #1E40AF;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:1px;">${isAr ? 'مُقدِم' : 'MUGDM'}</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;letter-spacing:${isAr ? '0' : '2px'};text-transform:uppercase;">${tagline}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;background-color:#1e293b;border-radius:0 0 8px 8px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">${footerTagline}</p>
              <p style="margin:0;font-size:12px;color:#475569;">
                <a href="{{unsubscribe_url}}" style="color:#475569;text-decoration:underline;">${unsubscribeLabel}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#f1f5f9;">${text}</h2>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cbd5e1;">${text}</p>`
}

function badge(text: string, color: 'blue' | 'amber' | 'red' | 'green'): string {
  const colors = {
    blue: 'background-color:#1E40AF;color:#dbeafe;',
    amber: 'background-color:#92400e;color:#fef3c7;',
    red: 'background-color:#991b1b;color:#fee2e2;',
    green: 'background-color:#166534;color:#dcfce7;',
  }
  return `<span style="display:inline-block;padding:4px 12px;border-radius:4px;font-size:13px;font-weight:600;${colors[color]}">${text}</span>`
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:#1E40AF;border-radius:6px;">
        <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`
}

// --- Email Templates ---

export function welcomeEmail(
  userName: string,
  options: TemplateOptions = {}
): { subject: string; html: string } {
  const locale = resolveLocale(options)
  const isAr = locale === 'ar'

  const content = isAr ? `
    ${heading(`أهلاً بك في مُقدِم، ${userName}!`)}
    ${paragraph('حسابك جاهز. مُقدِم يساعدك في متابعة التزامات نشاطك التجاري والمستندات والشؤون المالية &mdash; كل شيء في مكان واحد.')}
    ${paragraph('إليك ما يمكنك فعله الآن:')}
    <ul style="margin:0 0 16px;padding-right:20px;color:#cbd5e1;font-size:15px;line-height:1.8;">
      <li>أضف بيانات السجل التجاري</li>
      <li>ارفع مستندات الأعمال المهمة</li>
      <li>فعّل تتبع الالتزامات التنظيمية</li>
      <li>اربط كشوفات البنك للمحاسبة</li>
    </ul>
    ${ctaButton('انتقل إلى لوحة التحكم', 'https://mugdm.com/ar/dashboard')}
    ${paragraph('إذا كان لديك أي استفسار، رد على هذا البريد مباشرة. نحن هنا لمساعدتك.')}
  ` : `
    ${heading(`Welcome to Mugdm, ${userName}!`)}
    ${paragraph('Your account is set up and ready to go. Mugdm helps you stay on top of your business compliance, documents, and finances &mdash; all in one place.')}
    ${paragraph('Here\'s what you can do next:')}
    <ul style="margin:0 0 16px;padding-left:20px;color:#cbd5e1;font-size:15px;line-height:1.8;">
      <li>Add your Commercial Registration (CR) details</li>
      <li>Upload key business documents</li>
      <li>Set up compliance obligation tracking</li>
      <li>Connect your bank statements for bookkeeping</li>
    </ul>
    ${ctaButton('Go to Dashboard', 'https://mugdm.com/en/dashboard')}
    ${paragraph('If you have any questions, just reply to this email. We\'re here to help.')}
  `
  return {
    subject: isAr ? 'أهلاً بك في مُقدِم — لننظّم أعمالك' : 'Welcome to Mugdm — Let\'s get your business organized',
    html: baseLayout(content, options),
  }
}

export function complianceReminderEmail(
  obligationName: string,
  dueDate: string,
  daysLeft: number,
  businessName: string,
  options: TemplateOptions = {}
): { subject: string; html: string } {
  const locale = resolveLocale(options)
  const isAr = locale === 'ar'
  const urgency = daysLeft <= 1 ? 'red' : daysLeft <= 7 ? 'amber' : 'blue'
  const urgencyLabel = isAr
    ? (daysLeft <= 0 ? 'متأخر' : daysLeft === 1 ? 'مستحق غداً' : `${daysLeft} يوم متبقي`)
    : (daysLeft <= 0 ? 'OVERDUE' : daysLeft === 1 ? 'Due Tomorrow' : `${daysLeft} days left`)

  const content = `
    ${heading(isAr ? 'تذكير بالتزام' : 'Compliance Reminder')}
    ${paragraph(isAr ? `تذكير لنشاط <strong>${businessName}</strong>:` : `Hi, this is a reminder for <strong>${businessName}</strong>:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#f1f5f9;">${obligationName}</p>
          <p style="margin:0 0 12px;font-size:14px;color:#94a3b8;">${isAr ? 'تاريخ الاستحقاق' : 'Due date'}: <strong style="color:#e2e8f0;">${dueDate}</strong></p>
          ${badge(urgencyLabel, urgency)}
        </td>
      </tr>
    </table>
    ${paragraph(isAr ? 'تأكد من إنجاز هذا الالتزام قبل الموعد النهائي لتفادي الغرامات.' : 'Make sure this obligation is completed before the deadline to avoid penalties.')}
    ${ctaButton(isAr ? 'عرض الالتزامات' : 'View Obligations', `https://mugdm.com/${locale}/calendar`)}
  `
  return {
    subject: `[${urgencyLabel}] ${obligationName} — ${businessName}`,
    html: baseLayout(content, options),
  }
}

export function documentExpiryEmail(
  documentName: string,
  expiryDate: string,
  daysLeft: number,
  businessName: string,
  options: TemplateOptions = {}
): { subject: string; html: string } {
  const locale = resolveLocale(options)
  const isAr = locale === 'ar'
  const urgency = daysLeft <= 7 ? 'red' : daysLeft <= 15 ? 'amber' : 'blue'
  const urgencyLabel = isAr
    ? (daysLeft <= 0 ? 'منتهي' : daysLeft === 1 ? 'ينتهي غداً' : `ينتهي خلال ${daysLeft} يوم`)
    : (daysLeft <= 0 ? 'EXPIRED' : daysLeft === 1 ? 'Expires Tomorrow' : `Expires in ${daysLeft} days`)

  const content = `
    ${heading(isAr ? 'إشعار انتهاء مستند' : 'Document Expiry Notice')}
    ${paragraph(isAr ? `مستند لنشاط <strong>${businessName}</strong> يحتاج انتباهك:` : `A document for <strong>${businessName}</strong> needs your attention:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#f1f5f9;">${documentName}</p>
          <p style="margin:0 0 12px;font-size:14px;color:#94a3b8;">${isAr ? 'تاريخ الانتهاء' : 'Expiry date'}: <strong style="color:#e2e8f0;">${expiryDate}</strong></p>
          ${badge(urgencyLabel, urgency)}
        </td>
      </tr>
    </table>
    ${paragraph(isAr ? 'جدّد هذا المستند في أقرب وقت للحفاظ على الالتزام وتفادي تعطل الأعمال.' : 'Renew this document as soon as possible to maintain compliance and avoid business disruptions.')}
    ${ctaButton(isAr ? 'عرض المستندات' : 'View Documents', `https://mugdm.com/${locale}/vault`)}
  `
  return {
    subject: `[${urgencyLabel}] ${documentName} — ${businessName}`,
    html: baseLayout(content, options),
  }
}

export function weeklyDigestEmail(
  businessName: string,
  stats: {
    upcomingObligations: number
    expiringDocs: number
    totalExpenses: number
    totalIncome: number
  },
  options: TemplateOptions = {}
): { subject: string; html: string } {
  const locale = resolveLocale(options)
  const isAr = locale === 'ar'
  const formatSAR = (amount: number) =>
    `${isAr ? '' : 'SAR '}${amount.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${isAr ? ' ر.س' : ''}`

  const statCell = (value: string, label: string, color = '#f1f5f9') => `
    <td width="50%" style="padding:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:${color};">${value}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">${label}</p>
        </td></tr>
      </table>
    </td>`

  const content = `
    ${heading(isAr ? `الملخص الأسبوعي — ${businessName}` : `Weekly Summary — ${businessName}`)}
    ${paragraph(isAr ? 'إليك نظرة عامة على أعمالك هذا الأسبوع:' : 'Here\'s your business overview for the past week:')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        ${statCell(String(stats.upcomingObligations), isAr ? 'التزامات قادمة' : 'Upcoming Obligations')}
        ${statCell(String(stats.expiringDocs), isAr ? 'مستندات تنتهي' : 'Expiring Documents', stats.expiringDocs > 0 ? '#fbbf24' : '#f1f5f9')}
      </tr>
      <tr>
        ${statCell(formatSAR(stats.totalIncome), isAr ? 'الإيرادات' : 'Income', '#4ade80')}
        ${statCell(formatSAR(stats.totalExpenses), isAr ? 'المصروفات' : 'Expenses', '#f87171')}
      </tr>
    </table>
    ${ctaButton(isAr ? 'عرض لوحة التحكم' : 'View Full Dashboard', `https://mugdm.com/${locale}/dashboard`)}
  `
  return {
    subject: isAr ? `الملخص الأسبوعي — ${businessName}` : `Weekly Digest — ${businessName}`,
    html: baseLayout(content, options),
  }
}

/* ───────── Phase 1 Nudge Templates (PRD_ML §8.2) ───────── */

export function nudgeOnboardingStall(options: TemplateOptions = {}): { subject: string; html: string } {
  const locale = resolveLocale(options)
  const isAr = locale === 'ar'
  const content = isAr ? `
    ${heading('خطوة واحدة وتكمّل التسجيل')}
    ${paragraph('لاحظنا أنك بدأت إعداد حسابك ولم تكمله. أكمل الخطوات الأساسية لتستفيد من لوحة التحكم والتقارير والتنبيهات.')}
    ${ctaButton('أكمل الإعداد', `https://mugdm.com/ar/onboarding`)}
  ` : `
    ${heading('Finish setting up your account')}
    ${paragraph('You started onboarding but haven\'t finished yet. Complete the basics and we\'ll unlock your dashboard, reports, and reminders.')}
    ${ctaButton('Resume setup', `https://mugdm.com/en/onboarding`)}
  `
  return {
    subject: isAr ? 'أكمل إعداد مُقدِم' : 'Finish setting up Mugdm',
    html: baseLayout(content, options),
  }
}

export function nudgeComplianceBoost(
  obligationName: string,
  options: TemplateOptions = {}
): { subject: string; html: string } {
  const locale = resolveLocale(options)
  const isAr = locale === 'ar'
  const content = isAr ? `
    ${heading('التزام متأخر يحتاج إلى متابعة')}
    ${paragraph(`لديك التزام &laquo;${obligationName}&raquo; تجاوز موعد استحقاقه. أكمله اليوم أو أعد جدولته من التقويم.`)}
    ${ctaButton('افتح التقويم', `https://mugdm.com/ar/calendar`)}
  ` : `
    ${heading('An overdue obligation needs your attention')}
    ${paragraph(`Your &ldquo;${obligationName}&rdquo; obligation is past its due date. Close it out today or reschedule it from the calendar.`)}
    ${ctaButton('Open calendar', `https://mugdm.com/en/calendar`)}
  `
  return {
    subject: isAr ? `التزام متأخر: ${obligationName}` : `Overdue: ${obligationName}`,
    html: baseLayout(content, options),
  }
}

export function nudgeReengagement(options: TemplateOptions = {}): { subject: string; html: string } {
  const locale = resolveLocale(options)
  const isAr = locale === 'ar'
  const content = isAr ? `
    ${heading('افتقدناك في مُقدِم')}
    ${paragraph('الأمور تتغيّر بسرعة في عالم الأعمال. ارجع وتحقّق من التزاماتك، مستنداتك، وحساباتك قبل أن تتراكم.')}
    ${ctaButton('افتح لوحة التحكم', `https://mugdm.com/ar/dashboard`)}
  ` : `
    ${heading('We miss you at Mugdm')}
    ${paragraph('A lot changes in business — come back and review your obligations, documents, and books before anything slips.')}
    ${ctaButton('Open dashboard', `https://mugdm.com/en/dashboard`)}
  `
  return {
    subject: isAr ? 'تسجيل دخول سريع إلى مُقدِم' : 'A quick check-in with Mugdm',
    html: baseLayout(content, options),
  }
}

export function nudgeChurnPrevention(options: TemplateOptions = {}): { subject: string; html: string } {
  const locale = resolveLocale(options)
  const isAr = locale === 'ar'
  const content = isAr ? `
    ${heading('هل تحتاج مساعدة؟')}
    ${paragraph('نحن هنا لأي سؤال أو تعثّر. رد مباشرة على هذا البريد وسنساعدك شخصياً في إعداد حسابك أو حل أي مشكلة.')}
    ${ctaButton('تواصل مع الدعم', `https://mugdm.com/ar/chat`)}
  ` : `
    ${heading('Can we help?')}
    ${paragraph('If something isn\'t working or you\'re unsure how to get value from Mugdm, reply to this email and a human from our team will help you personally.')}
    ${ctaButton('Contact support', `https://mugdm.com/en/chat`)}
  `
  return {
    subject: isAr ? 'هل نستطيع مساعدتك في مُقدِم؟' : 'Can we help with Mugdm?',
    html: baseLayout(content, options),
  }
}
