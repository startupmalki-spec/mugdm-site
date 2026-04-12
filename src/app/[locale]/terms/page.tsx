import Image from 'next/image'
import { Link } from '@/i18n/routing'

export default function TermsOfServicePage() {
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
          <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: April 12, 2026</p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By accessing or using MUGDM (&quot;the Service&quot;), operated by MUGDM (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              MUGDM is a data wallet platform designed for Saudi entrepreneurs. The Service allows users to upload and manage Commercial Registration documents, track compliance deadlines, and manage bookkeeping records. The Service may use artificial intelligence to assist with document analysis and data processing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Account Responsibilities</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating your account. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You shall not:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1 ps-4">
              <li>Upload fraudulent, falsified, or misleading documents</li>
              <li>Use the Service to engage in any illegal activity</li>
              <li>Attempt to gain unauthorized access to other users&apos; data</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Reverse engineer, decompile, or otherwise attempt to extract the source code of the Service</li>
              <li>Use the Service in any manner that could damage, disable, or impair the Service</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Data Ownership</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You retain full ownership of all data, documents, and content you upload to the Service. By using the Service, you grant us a limited license to process your data solely for the purpose of providing and improving the Service. We do not claim ownership over your business documents, financial records, or any other content you submit.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. AI-Powered Features</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Service uses artificial intelligence (including Claude by Anthropic) to assist with document analysis, data extraction, and compliance insights. AI-generated outputs are provided for informational purposes only and should not be considered legal, financial, or professional advice. You are responsible for verifying the accuracy of any AI-generated content before relying on it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Service Availability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We strive to maintain the availability of the Service but do not guarantee uninterrupted access. We may modify, suspend, or discontinue the Service at any time with reasonable notice. Scheduled maintenance windows will be communicated in advance when possible.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To the maximum extent permitted by applicable law, MUGDM and its affiliates, officers, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities, arising out of or in connection with your use of the Service. Our total liability for any claims arising under these Terms shall not exceed the amount paid by you to us in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Termination</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Either party may terminate this agreement at any time. Upon termination, you may request export of your data within thirty (30) days. After this period, we may delete your data in accordance with our data retention policies. We reserve the right to terminate or suspend your access immediately if you violate these Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Changes to Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. We will notify you of any material changes by posting the updated Terms on this page and updating the &quot;Last updated&quot; date. Your continued use of the Service after changes are posted constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">11. Governing Law</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the Kingdom of Saudi Arabia. Any disputes arising out of or relating to these Terms or the Service shall be subject to the exclusive jurisdiction of the competent courts in the Kingdom of Saudi Arabia.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">12. Contact Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{' '}
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
