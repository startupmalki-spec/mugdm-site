/**
 * Demo-mode ZATCA Fatoora mock. Returns realistic-shaped clearance and
 * reporting responses without ever touching ZATCA endpoints. Only active
 * when MUGDM_DEMO_MODE=true.
 */
import { createHash, randomUUID } from 'crypto';
import { demoSleep } from '../demo-mode';
import type {
  ZatcaClearanceResponse,
  ZatcaReportingResponse,
} from './api-client';

function fakeBase64(prefix: string, byteLen = 256): string {
  return Buffer.from(`${prefix}-${randomUUID()}-${'x'.repeat(byteLen)}`).toString('base64');
}

function fakeInvoiceHash(invoiceXml: string, uuid: string): string {
  return createHash('sha256').update(invoiceXml + uuid).digest('base64');
}

function fakeQrTlv(uuid: string): string {
  // Real ZATCA QR is TLV-encoded and base64'd. For a demo this just needs to
  // be a base64 blob the UI can display; nothing scans it during the pitch.
  return Buffer.from(`MUGDM-DEMO-QR\u0001\u0024${uuid}`, 'utf8').toString('base64');
}

export async function clearInvoiceMock(
  invoiceXml: string,
  _csid: { binarySecurityToken: string; secret: string },
  options?: { invoiceHash?: string; uuid?: string },
): Promise<ZatcaClearanceResponse> {
  await demoSleep(800, 1500);
  const uuid = options?.uuid ?? randomUUID();
  const invoiceHash = options?.invoiceHash ?? fakeInvoiceHash(invoiceXml, uuid);

  return {
    clearanceStatus: 'CLEARED',
    clearedInvoice: fakeBase64('CLEARED'),
    invoiceHash,
    qrCode: fakeQrTlv(uuid),
    validationResults: {
      status: 'PASS',
      infoMessages: [
        { status: 'PASS', code: 'INF-001', message: 'Invoice cleared (demo mode).' },
      ],
      warningMessages: [],
      errorMessages: [],
    },
    raw: { __mock: true, uuid, clearedAt: new Date().toISOString() },
  };
}

export async function reportInvoiceMock(
  invoiceXml: string,
  _csid: { binarySecurityToken: string; secret: string },
  options?: { invoiceHash?: string; uuid?: string },
): Promise<ZatcaReportingResponse> {
  await demoSleep(800, 1500);
  const uuid = options?.uuid ?? randomUUID();
  return {
    reportingStatus: 'REPORTED',
    validationResults: {
      status: 'PASS',
      infoMessages: [
        { status: 'PASS', code: 'INF-001', message: 'Invoice reported (demo mode).' },
      ],
      warningMessages: [],
      errorMessages: [],
    },
    raw: { __mock: true, uuid, reportedAt: new Date().toISOString(), invoiceHash: options?.invoiceHash ?? fakeInvoiceHash(invoiceXml, uuid) },
  };
}
