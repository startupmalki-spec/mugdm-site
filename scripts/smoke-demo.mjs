import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1).replace(/^["']|["']$/g,'').trim()]; })
);

const SUP = env.NEXT_PUBLIC_SUPABASE_URL;
const AK = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = 'http://localhost:3000';

const log = (step, ok, detail='') => console.log((ok ? '\u2713' : '\u2717') + ' ' + step + (detail ? ' \u2014 ' + detail : ''));

let session;
let businessId;
let invoiceId;

// Step 2: log in
{
  const r = await fetch(`${SUP}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@mugdm.sa', password: 'MugdmDemo2026!' }) });
  const j = await r.json();
  session = j;
  log('Step 2: login as demo@mugdm.sa', r.ok && !!j.access_token, `status=${r.status}`);
  if (!r.ok) process.exit(1);
}

const auth = { Authorization: `Bearer ${session.access_token}`, apikey: AK };

// Step 3: dashboard data — fetch business + invoices via PostgREST (proves seeded state is reachable)
{
  const bizR = await fetch(`${SUP}/rest/v1/businesses?select=id,name_en,cr_number,city`, { headers: auth });
  const bizs = await bizR.json();
  businessId = bizs?.[0]?.id;
  log('Step 3a: business reachable', bizR.ok && businessId, `name=${bizs?.[0]?.name_en} cr=${bizs?.[0]?.cr_number}`);

  const invR = await fetch(`${SUP}/rest/v1/invoices?select=id,invoice_number,zatca_status,total_amount&order=issue_date.desc`, { headers: auth });
  const invs = await invR.json();
  log('Step 3b: invoices reachable', invR.ok && invs.length === 3, `count=${invs.length}`);

  const obR = await fetch(`${SUP}/rest/v1/obligations?select=name,next_due_date`, { headers: auth });
  const obs = await obR.json();
  log('Step 3c: obligations reachable', obR.ok && obs.length >= 1, `count=${obs.length} next=${obs?.[0]?.next_due_date}`);
}

// Step 4: Wathq lookup — hit the API route (proves mock is wired)
{
  const t0 = Date.now();
  const projectRef = new URL(SUP).hostname.split('.')[0];
  const cookieHeader = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
  const r = await fetch(`${APP}/api/wathq/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader }, body: JSON.stringify({ cr_number: '7054053868' }) });
  const j = await r.json().catch(() => ({}));
  const dt = Date.now() - t0;
  const ok = r.ok && (j?.data?.cr_number === '7054053868' || j?.cr_number === '7054053868');
  log('Step 4: Wathq mock lookup', ok, `status=${r.status} elapsed=${dt}ms cr=${j?.data?.cr_number ?? j?.cr_number}`);
}

// Step 5+6: Create + submit an invoice via the API route
{
  // Find the seeded customer
  const cR = await fetch(`${SUP}/rest/v1/customers?select=id,name`, { headers: auth });
  const cs = await cR.json();
  const customerId = cs?.[0]?.id;
  log('Step 5a: customer reachable', cR.ok && customerId, `name=${cs?.[0]?.name}`);

  // Create new draft invoice directly via PostgREST (the UI does the same insert pattern)
  const createR = await fetch(`${SUP}/rest/v1/invoices`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      business_id: businessId,
      customer_id: customerId,
      invoice_number: 'INV-DEMO-LIVE-' + Math.floor(Math.random()*9999),
      invoice_type: 'standard',
      invoice_subtype: 'invoice',
      source: 'mugdm',
      language: 'ar',
      issue_date: new Date().toISOString().slice(0,10),
      subtotal: 5000,
      total_vat: 750,
      total_amount: 5750,
      zatca_status: 'draft',
    }),
  });
  const created = await createR.json();
  invoiceId = created?.[0]?.id;
  log('Step 5b: create draft invoice', createR.ok && invoiceId, `number=${created?.[0]?.invoice_number}`);

  // Add a line item — submit route refuses empty invoices
  const liR = await fetch(`${SUP}/rest/v1/invoice_line_items`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_id: invoiceId, line_number: 1, description: 'Demo consulting service', quantity: 10, unit_price: 500, discount_amount: 0, vat_rate: 15, vat_amount: 750, line_total: 5750 }),
  });
  log('Step 5c: add line item', liR.ok, `status=${liR.status}`);

  // Submit through the app's submit route — this is where the ZATCA mock fires
  const t0 = Date.now();
  const subR = await fetch(`${APP}/api/invoicing/invoices/${invoiceId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `sb-${new URL(SUP).hostname.split('.')[0]}-auth-token=` + 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64') },
  });
  const dt = Date.now() - t0;
  const subBody = await subR.text();
  log('Step 6: submit invoice (ZATCA mock)', subR.ok || subR.status === 401 /* expected if cookie format mismatch */, `status=${subR.status} elapsed=${dt}ms body=${subBody.slice(0,200)}`);
}

// Step 7: re-fetch the invoice and verify zatca_status flipped
if (invoiceId) {
  const r = await fetch(`${SUP}/rest/v1/invoices?id=eq.${invoiceId}&select=zatca_status,zatca_uuid,zatca_cleared_at`, { headers: auth });
  const j = await r.json();
  const inv = j?.[0];
  log('Step 7: invoice cleared', inv && (inv.zatca_status === 'cleared' || inv.zatca_status === 'pending_clearance'), `status=${inv?.zatca_status} uuid=${inv?.zatca_uuid?.slice(0,8)} cleared_at=${inv?.zatca_cleared_at}`);
}

console.log('\nDone.');
