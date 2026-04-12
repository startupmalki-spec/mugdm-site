interface TemplateOptions {
  locale?: 'en' | 'ar'
}

function baseLayout(content: string, _options?: TemplateOptions): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mugdm</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;text-align:center;border-bottom:2px solid #1E40AF;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:1px;">MUGDM</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;">Your Business's Second Brain</p>
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
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Mugdm &mdash; Your Business's Second Brain</p>
              <p style="margin:0;font-size:12px;color:#475569;">
                <a href="{{unsubscribe_url}}" style="color:#475569;text-decoration:underline;">Unsubscribe</a>
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
  const content = `
    ${heading(`Welcome to Mugdm, ${userName}!`)}
    ${paragraph('Your account is set up and ready to go. Mugdm helps you stay on top of your business compliance, documents, and finances &mdash; all in one place.')}
    ${paragraph('Here\'s what you can do next:')}
    <ul style="margin:0 0 16px;padding-left:20px;color:#cbd5e1;font-size:15px;line-height:1.8;">
      <li>Add your Commercial Registration (CR) details</li>
      <li>Upload key business documents</li>
      <li>Set up compliance obligation tracking</li>
      <li>Connect your bank statements for bookkeeping</li>
    </ul>
    ${ctaButton('Go to Dashboard', 'https://mugdm.com/dashboard')}
    ${paragraph('If you have any questions, just reply to this email. We\'re here to help.')}
  `
  return {
    subject: 'Welcome to Mugdm — Let\'s get your business organized',
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
  const urgency = daysLeft <= 1 ? 'red' : daysLeft <= 7 ? 'amber' : 'blue'
  const urgencyLabel =
    daysLeft <= 0
      ? 'OVERDUE'
      : daysLeft === 1
        ? 'Due Tomorrow'
        : `${daysLeft} days left`

  const content = `
    ${heading('Compliance Reminder')}
    ${paragraph(`Hi, this is a reminder for <strong>${businessName}</strong>:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#f1f5f9;">${obligationName}</p>
          <p style="margin:0 0 12px;font-size:14px;color:#94a3b8;">Due date: <strong style="color:#e2e8f0;">${dueDate}</strong></p>
          ${badge(urgencyLabel, urgency)}
        </td>
      </tr>
    </table>
    ${paragraph('Make sure this obligation is completed before the deadline to avoid penalties.')}
    ${ctaButton('View Obligations', 'https://mugdm.com/dashboard/compliance')}
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
  const urgency = daysLeft <= 7 ? 'red' : daysLeft <= 15 ? 'amber' : 'blue'
  const urgencyLabel =
    daysLeft <= 0
      ? 'EXPIRED'
      : daysLeft === 1
        ? 'Expires Tomorrow'
        : `Expires in ${daysLeft} days`

  const content = `
    ${heading('Document Expiry Notice')}
    ${paragraph(`A document for <strong>${businessName}</strong> needs your attention:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#f1f5f9;">${documentName}</p>
          <p style="margin:0 0 12px;font-size:14px;color:#94a3b8;">Expiry date: <strong style="color:#e2e8f0;">${expiryDate}</strong></p>
          ${badge(urgencyLabel, urgency)}
        </td>
      </tr>
    </table>
    ${paragraph('Renew this document as soon as possible to maintain compliance and avoid business disruptions.')}
    ${ctaButton('View Documents', 'https://mugdm.com/dashboard/documents')}
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
  const formatSAR = (amount: number) =>
    `SAR ${amount.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const content = `
    ${heading(`Weekly Summary — ${businessName}`)}
    ${paragraph('Here\'s your business overview for the past week:')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td width="50%" style="padding:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
            <tr>
              <td style="padding:16px;text-align:center;">
                <p style="margin:0;font-size:28px;font-weight:700;color:#f1f5f9;">${stats.upcomingObligations}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;text-transform:uppercase;">Upcoming Obligations</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="50%" style="padding:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
            <tr>
              <td style="padding:16px;text-align:center;">
                <p style="margin:0;font-size:28px;font-weight:700;color:${stats.expiringDocs > 0 ? '#fbbf24' : '#f1f5f9'};">${stats.expiringDocs}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;text-transform:uppercase;">Expiring Documents</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
            <tr>
              <td style="padding:16px;text-align:center;">
                <p style="margin:0;font-size:20px;font-weight:700;color:#4ade80;">${formatSAR(stats.totalIncome)}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;text-transform:uppercase;">Income</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="50%" style="padding:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
            <tr>
              <td style="padding:16px;text-align:center;">
                <p style="margin:0;font-size:20px;font-weight:700;color:#f87171;">${formatSAR(stats.totalExpenses)}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;text-transform:uppercase;">Expenses</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${ctaButton('View Full Dashboard', 'https://mugdm.com/dashboard')}
  `
  return {
    subject: `Weekly Digest — ${businessName}`,
    html: baseLayout(content, options),
  }
}
