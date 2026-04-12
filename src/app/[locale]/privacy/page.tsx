import Image from 'next/image'
import { Link } from '@/i18n/routing'

export default function PrivacyPolicyPage() {
  return (
    <div className="relative flex min-h-screen items-start justify-center bg-background px-4 py-12 overflow-hidden">
      {/* Shadda watermark */}
      <div className="pointer-events-none absolute bottom-[-60px] right-[-40px] opacity-[0.04]">
        <Image src="/brand/logo-shadda.png" alt="" width={280} height={280} className="brightness-200" aria-hidden="true" />
      </div>

      <div className="relative z-[1] w-full max-w-2xl space-y-8">
        {/* Brand logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-3 mb-6">
            <Image src="/brand/1-transparent.png" alt="Mugdm" width={200} height={56} className="hidden h-14 w-auto dark:block" />
            <Image src="/brand/2-transparent.png" alt="Mugdm" width={200} height={56} className="h-14 w-auto dark:hidden" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg space-y-6">
          <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: April 12, 2026</p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              MUGDM (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our data wallet platform (&quot;the Service&quot;).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We collect the following types of information:
            </p>
            <h3 className="text-sm font-semibold text-foreground mt-2">Personal Information</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>Full name</li>
              <li>Email address</li>
              <li>Account authentication data</li>
            </ul>
            <h3 className="text-sm font-semibold text-foreground mt-2">Business Documents</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>Commercial Registration (CR) certificates</li>
              <li>Business license documents</li>
              <li>Compliance-related documents and deadlines</li>
            </ul>
            <h3 className="text-sm font-semibold text-foreground mt-2">Financial Records</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>Bookkeeping data and financial records you upload</li>
              <li>Transaction records and invoices</li>
            </ul>
            <h3 className="text-sm font-semibold text-foreground mt-2">Usage Data</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>Log data (IP address, browser type, pages visited)</li>
              <li>Feature usage patterns to improve the Service</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. How We Store Your Data</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your data is stored securely using Supabase, a trusted cloud infrastructure provider. We implement industry-standard security measures including:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Row-level security policies to ensure data isolation between users</li>
              <li>Regular security audits and monitoring</li>
              <li>Secure authentication via magic link (passwordless) login</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. AI Processing</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use artificial intelligence services, including Claude by Anthropic, to provide document analysis, data extraction, and compliance insights. When your documents are processed by AI:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>Document content is sent to the AI provider solely for processing your request</li>
              <li>We do not use your data to train AI models</li>
              <li>AI processing is performed on-demand and data is not retained by the AI provider beyond the processing session</li>
              <li>You may opt out of AI-powered features where applicable</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. How We Use Your Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use your information to:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>Provide and maintain the Service</li>
              <li>Process and analyze your uploaded documents</li>
              <li>Send compliance deadline reminders and notifications</li>
              <li>Improve the Service and develop new features</li>
              <li>Communicate with you about your account and the Service</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Data Sharing</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We do not sell your personal information. We may share your data only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>With service providers who assist in operating the Service (e.g., Supabase for hosting, Anthropic for AI processing)</li>
              <li>When required by law or legal process in the Kingdom of Saudi Arabia</li>
              <li>To protect the rights, safety, or property of MUGDM, our users, or the public</li>
              <li>With your explicit consent</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Data Retention</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide the Service. If you delete your account, we will delete your personal data and uploaded documents within thirty (30) days, except where retention is required by law. Anonymized and aggregated data that cannot identify you may be retained indefinitely for analytical purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Your Rights</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent for data processing where applicable</li>
              <li>Object to certain types of data processing</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:contact@mugdm.com" className="text-primary hover:underline">
                contact@mugdm.com
              </a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Cookies and Tracking</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use essential cookies required for the Service to function, including authentication session cookies. We do not use third-party advertising or tracking cookies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Children&apos;s Privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">11. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the &quot;Last updated&quot; date. We encourage you to review this policy periodically.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">12. Governing Law</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This Privacy Policy is governed by the laws of the Kingdom of Saudi Arabia, including the Personal Data Protection Law (PDPL).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">13. Contact Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at{' '}
              <a href="mailto:contact@mugdm.com" className="text-primary hover:underline">
                contact@mugdm.com
              </a>.
            </p>
          </section>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
