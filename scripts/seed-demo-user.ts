/**
 * Demo seed for pitch.
 *
 * Credentials (also documented in DEMO_MODE.md):
 *   email:    demo@mugdm.sa
 *   password: MugdmDemo2026!
 *
 * Creates / refreshes:
 *   - 1 Supabase auth user (email-confirmed, password-set)
 *   - 1 business record populated with PLACEHOLDER Mugdm CR data
 *     (replace with real values from demo-assets/mugdm-cr.pdf — see
 *      MUGDM_PLACEHOLDER block below)
 *   - 1 pre-seeded customer
 *   - 3 invoices: 1 paid B2B (30d ago), 1 outstanding B2B (7d ago),
 *     1 simplified B2C (2d ago)
 *   - 1 upcoming compliance obligation due this week
 *
 * Run:
 *   npm run demo:seed     # idempotent — upserts on the demo user
 *   npm run demo:reset    # wipes demo user data, re-seeds clean
 *
 * SAFETY:
 *   This script targets whatever NEXT_PUBLIC_SUPABASE_URL +
 *   SUPABASE_SERVICE_ROLE_KEY point at. Refuses to run if that URL
 *   looks like a production project (contains MUGDM_PROD_GUARD env value
 *   or you've explicitly listed it as DEMO_SAFE_PROJECT_REFS=ref1,ref2).
 *
 *   Set DEMO_SAFE_PROJECT_REFS to a comma-separated list of Supabase
 *   project refs (the part before .supabase.co) you've confirmed are
 *   safe to seed against — usually a dedicated staging project.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first (matches Next runtime), fall back to .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DEMO_EMAIL = 'demo@mugdm.sa';
const DEMO_PASSWORD = 'MugdmDemo2026!';

// ── REAL DATA from CrCertificate.pdf + CR extract.png + VAT cert ────
const MUGDM = {
  name_ar: 'مؤسسة محمد محسن مالكي',
  name_en: 'MOHAMMED MOHSEN MALKI Establishment',
  cr_number: '7054053868',           // Saudi MoC Unified National Number
  cr_issuance_date: '2026-04-13',
  cr_expiry_date: '2027-04-12',      // next annual confirmation
  vat_number: '314729836800003',     // VAT reg number — effective 2026-05-01, quarterly filing
  tin: '3147298368',                 // Tax Identification Number (الرقم المميز)
  vat_certificate_no: '100261168778132',
  vat_effective_date: '2026-05-01',
  vat_first_filing_due: '2026-07-31',
  capital: 1,
  city: 'Riyadh',
  fiscal_year_end: '12-31',
  contact_phone: '+966 12 699 8686', // landline from CR extract
  contact_email: 'startupmalki@gmail.com',
  contact_address: 'الرياض، حي النرجس، طريف 13327', // from VAT certificate
  activity_type: 'Systems Integration',
  main_activity_code: '620101',
};
// ──────────────────────────────────────────────────────────────────────

function safetyCheckOrExit(supabaseUrl: string) {
  const safe = (process.env.DEMO_SAFE_PROJECT_REFS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  if (safe.length === 0) {
    console.error(`
[seed-demo-user] REFUSING TO RUN.

You haven't whitelisted any Supabase project ref as safe to seed.
Set DEMO_SAFE_PROJECT_REFS in .env.local to a comma-separated list
of project refs you're sure are NOT production. Example:

  DEMO_SAFE_PROJECT_REFS=${ref}

This script targets: ${supabaseUrl}
`);
    process.exit(2);
  }
  if (!safe.includes(ref)) {
    console.error(`
[seed-demo-user] REFUSING TO RUN.

Project ref "${ref}" is not in DEMO_SAFE_PROJECT_REFS (${safe.join(', ')}).
Either add it explicitly or point NEXT_PUBLIC_SUPABASE_URL at a
demo / staging project before running this seed.
`);
    process.exit(2);
  }
}

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[seed-demo-user] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
    process.exit(2);
  }
  safetyCheckOrExit(url);
  return createClient(url, key, { auth: { persistSession: false } });
}

async function ensureUser(supabase: SupabaseClient): Promise<string> {
  // Look for existing demo user
  const { data: list, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const existing = list.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);

  if (existing) {
    // Reset password + confirm email idempotently
    const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { has_password: true, demo: true },
    });
    if (updErr) throw updErr;
    console.log(`[seed-demo-user] Reused existing auth user ${existing.id}`);
    return existing.id;
  }

  const { data, error: createErr } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { has_password: true, demo: true },
  });
  if (createErr) throw createErr;
  if (!data.user) throw new Error('createUser returned no user');
  console.log(`[seed-demo-user] Created auth user ${data.user.id}`);
  return data.user.id;
}

async function wipeDemoData(supabase: SupabaseClient, userId: string) {
  const { data: bizs } = await supabase.from('businesses').select('id').eq('user_id', userId);
  const ids = (bizs ?? []).map((b: { id: string }) => b.id);
  if (ids.length === 0) return;
  // Cascade through children — invoices, line items, customers, obligations
  await supabase.from('invoice_line_items').delete().in('invoice_id',
    (await supabase.from('invoices').select('id').in('business_id', ids)).data?.map((r: { id: string }) => r.id) ?? []
  );
  await supabase.from('invoices').delete().in('business_id', ids);
  await supabase.from('customers').delete().in('business_id', ids);
  await supabase.from('zatca_certificates').delete().in('business_id', ids);
  await supabase.from('obligations').delete().in('business_id', ids);
  await supabase.from('businesses').delete().in('id', ids);
  console.log(`[seed-demo-user] Wiped ${ids.length} business record(s) and dependents`);
}

async function seedBusiness(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('businesses')
    .insert({
      user_id: userId,
      name_ar: MUGDM.name_ar,
      name_en: MUGDM.name_en,
      cr_number: MUGDM.cr_number,
      activity_type: MUGDM.activity_type,
      city: MUGDM.city,
      capital: MUGDM.capital,
      fiscal_year_end: MUGDM.fiscal_year_end,
      contact_phone: MUGDM.contact_phone,
      contact_email: MUGDM.contact_email,
      contact_address: MUGDM.contact_address,
      cr_issuance_date: MUGDM.cr_issuance_date,
      cr_expiry_date: MUGDM.cr_expiry_date,
      data_sharing_consent: true,
    })
    .select('id')
    .single();
  if (error) throw error;
  console.log(`[seed-demo-user] Seeded business ${data.id}`);
  return data.id;
}

async function seedCustomer(supabase: SupabaseClient, businessId: string): Promise<string> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      business_id: businessId,
      name: 'شركة الاتصالات السعودية',
      name_en: 'Saudi Telecom Company (STC)',
      vat_number: '300055555500003',
      cr_number: '1010002000',
      address: 'King Saud Road, Riyadh',
      city: 'Riyadh',
      country: 'SA',
      phone: '+966 11 444 5555',
      email: 'ap@stc.com.sa',
    })
    .select('id')
    .single();
  if (error) throw error;
  console.log(`[seed-demo-user] Seeded customer ${data.id}`);
  return data.id;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function seedInvoice(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string,
  spec: {
    invoice_number: string;
    invoice_type: 'standard' | 'simplified';
    issue_offset_days: number;
    line: { description: string; qty: number; unit: number };
    status: 'cleared' | 'pending_clearance' | 'reported';
    paid?: boolean;
  },
) {
  const { line } = spec;
  const subtotal = +(line.qty * line.unit).toFixed(2);
  const vat = +(subtotal * 0.15).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);
  const issue = daysAgo(spec.issue_offset_days);
  const due = daysAgo(spec.issue_offset_days - 30);
  const uuid = randomUUID();

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      business_id: businessId,
      customer_id: spec.invoice_type === 'standard' ? customerId : null,
      invoice_number: spec.invoice_number,
      invoice_type: spec.invoice_type,
      invoice_subtype: 'invoice',
      source: 'mugdm',
      language: 'ar',
      issue_date: issue,
      supply_date: issue,
      due_date: due,
      subtotal,
      total_vat: vat,
      total_amount: total,
      zatca_status: spec.status,
      zatca_uuid: uuid,
      zatca_cleared_at: spec.status === 'cleared' || spec.status === 'reported' ? new Date().toISOString() : null,
      zatca_submitted_at: new Date().toISOString(),
      notes: spec.paid ? 'Paid via bank transfer' : null,
    })
    .select('id')
    .single();
  if (error) throw error;

  const { error: liErr } = await supabase.from('invoice_line_items').insert({
    invoice_id: data.id,
    line_number: 1,
    description: line.description,
    quantity: line.qty,
    unit_price: line.unit,
    discount_amount: 0,
    vat_rate: 15,
    vat_amount: vat,
    line_total: total,
  });
  if (liErr) throw liErr;
  console.log(`[seed-demo-user] Seeded invoice ${spec.invoice_number} (${spec.status})`);
}

async function seedZatcaCert(supabase: SupabaseClient, businessId: string) {
  // Fake but well-formed PEM so the submit route's cert-status check passes.
  // The mocked clearInvoice/reportInvoice ignore the cert content entirely.
  const FAKE_PEM = `-----BEGIN CERTIFICATE-----
MIIB1TCCAXugAwIBAgIUF8c5xH0pX1Z+gW0bX1Z+gW0bX1YwCgYIKoZIzj0EAwIw
DEMOCERTIFICATEFORMUGDMDEMOMODEONLYREALCALLSARENEVERMADETOZATCA
DEMOCERTIFICATEFORMUGDMDEMOMODEONLYREALCALLSARENEVERMADETOZATCA
-----END CERTIFICATE-----`;
  const FAKE_KEY = 'demo-mode-private-key-not-real';
  const future = new Date();
  future.setFullYear(future.getFullYear() + 1);
  const past = new Date();
  past.setMonth(past.getMonth() - 1);
  const { error } = await supabase.from('zatca_certificates').insert({
    business_id: businessId,
    cert_type: 'production',
    certificate: FAKE_PEM,
    private_key_encrypted: FAKE_KEY,
    issued_at: past.toISOString(),
    expires_at: future.toISOString(),
    is_active: true,
  });
  if (error) throw error;
  console.log(`[seed-demo-user] Seeded fake ZATCA production cert (demo only)`);
}

async function seedObligation(supabase: SupabaseClient, businessId: string) {
  const due = new Date();
  due.setDate(due.getDate() + 5);
  const { error } = await supabase.from('obligations').insert({
    business_id: businessId,
    type: 'ZATCA_VAT',
    name: 'Quarterly VAT return',
    description: 'File Q-end VAT return with ZATCA',
    frequency: 'QUARTERLY',
    next_due_date: due.toISOString().split('T')[0],
  });
  if (error) throw error;
  console.log(`[seed-demo-user] Seeded upcoming VAT return obligation`);
}

async function main() {
  const reset = process.argv.includes('--reset');
  const supabase = getClient();

  console.log(`[seed-demo-user] Mode: ${reset ? 'RESET (wipe + reseed)' : 'SEED (idempotent upsert)'}`);

  const userId = await ensureUser(supabase);
  if (reset) {
    await wipeDemoData(supabase, userId);
  } else {
    // If a business already exists for this user, skip — leave it intact.
    const { data } = await supabase.from('businesses').select('id').eq('user_id', userId).limit(1);
    if (data && data.length > 0) {
      console.log('[seed-demo-user] Business already seeded. Use --reset to start clean.');
      console.log('\n  Login:');
      console.log(`    email:    ${DEMO_EMAIL}`);
      console.log(`    password: ${DEMO_PASSWORD}\n`);
      return;
    }
  }

  const businessId = await seedBusiness(supabase, userId);
  const customerId = await seedCustomer(supabase, businessId);

  await seedInvoice(supabase, businessId, customerId, {
    invoice_number: 'INV-2026-001',
    invoice_type: 'standard',
    issue_offset_days: 30,
    line: { description: 'Engineering retainer — March', qty: 1, unit: 28000 },
    status: 'cleared',
    paid: true,
  });
  await seedInvoice(supabase, businessId, customerId, {
    invoice_number: 'INV-2026-002',
    invoice_type: 'standard',
    issue_offset_days: 7,
    line: { description: 'Compliance setup — onboarding', qty: 1, unit: 12500 },
    status: 'cleared',
  });
  await seedInvoice(supabase, businessId, customerId, {
    invoice_number: 'INV-2026-003',
    invoice_type: 'simplified',
    issue_offset_days: 2,
    line: { description: 'Consulting — 6 hrs', qty: 6, unit: 750 },
    status: 'reported',
  });

  await seedZatcaCert(supabase, businessId);
  await seedObligation(supabase, businessId);

  console.log('\n[seed-demo-user] Done.');
  console.log('  Login:');
  console.log(`    email:    ${DEMO_EMAIL}`);
  console.log(`    password: ${DEMO_PASSWORD}\n`);
}

main().catch((err) => {
  console.error('[seed-demo-user] FAILED:', err);
  process.exit(1);
});
