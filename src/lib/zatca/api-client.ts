/**
 * ZATCA Fatoora API client
 *
 * Provides a typed, retrying fetch wrapper around the ZATCA e-invoicing
 * (Fatoora) REST endpoints. Endpoint-specific helpers below are intentionally
 * thin — XML payload construction and signing are implemented in task 54.
 *
 * Reference: PRD_ZATCA_EINVOICING.md, Appendix A.
 */

// ---------------------------------------------------------------------------
// Environment + base URL configuration
// ---------------------------------------------------------------------------

export type ZatcaEnv = 'sandbox' | 'production';

const ZATCA_ENV: ZatcaEnv =
  (process.env.ZATCA_ENV as ZatcaEnv) === 'production' ? 'production' : 'sandbox';

export const ZATCA_BASE_URLS: Record<ZatcaEnv, string> = {
  sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

export function getZatcaBaseUrl(env: ZatcaEnv = ZATCA_ENV): string {
  return ZATCA_BASE_URLS[env];
}

// ---------------------------------------------------------------------------
// Errors + bilingual error message map
// ---------------------------------------------------------------------------

export class ZatcaApiError extends Error {
  public readonly statusCode: number;
  public readonly zatcaErrorCode?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    zatcaErrorCode?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ZatcaApiError';
    this.statusCode = statusCode;
    this.zatcaErrorCode = zatcaErrorCode;
    this.details = details;
  }
}

export interface BilingualMessage {
  en: string;
  ar: string;
}

/**
 * Common ZATCA error codes mapped to bilingual user-facing messages.
 * NOTE: Exact error code strings should be verified against ZATCA's published
 * developer portal error catalogue. The keys below reflect the names used in
 * the PRD; remap as needed once the official codes are confirmed.
 */
export const ZATCA_ERROR_MESSAGES: Record<string, BilingualMessage> = {
  INVALID_VAT_NUMBER: {
    en: 'The VAT registration number is invalid. Please verify with ZATCA.',
    ar: 'رقم التسجيل الضريبي غير صحيح. يرجى التحقق من هيئة الزكاة والضريبة والجمارك.',
  },
  MALFORMED_XML: {
    en: 'The invoice XML is malformed or does not conform to UBL 2.1.',
    ar: 'ملف الفاتورة (XML) غير صالح أو لا يتوافق مع معيار UBL 2.1.',
  },
  EXPIRED_CERTIFICATE: {
    en: 'The ZATCA certificate has expired. Please renew the production CSID.',
    ar: 'انتهت صلاحية شهادة هيئة الزكاة. يرجى تجديد شهادة الإنتاج (CSID).',
  },
  DUPLICATE_INVOICE_NUMBER: {
    en: 'An invoice with this number has already been submitted.',
    ar: 'تم إرسال فاتورة بهذا الرقم مسبقاً.',
  },
  UNAUTHORIZED: {
    en: 'Unauthorized request. Verify the OTP or CSID credentials.',
    ar: 'الطلب غير مصرح به. يرجى التحقق من رمز التحقق أو بيانات الشهادة.',
  },
  INVALID_OTP: {
    en: 'The one-time password (OTP) is invalid or has expired.',
    ar: 'رمز التحقق لمرة واحدة غير صالح أو منتهي الصلاحية.',
  },
  INVALID_CSR: {
    en: 'The Certificate Signing Request (CSR) is invalid.',
    ar: 'طلب توقيع الشهادة (CSR) غير صالح.',
  },
  INVALID_HASH: {
    en: 'Invoice hash mismatch. Re-sign the invoice and try again.',
    ar: 'عدم تطابق بصمة الفاتورة. يرجى إعادة توقيع الفاتورة والمحاولة مرة أخرى.',
  },
  RATE_LIMITED: {
    en: 'Too many requests. Please slow down and retry shortly.',
    ar: 'عدد الطلبات كبير جداً. يرجى التمهل وإعادة المحاولة بعد قليل.',
  },
  SERVER_ERROR: {
    en: 'ZATCA service is temporarily unavailable. Please retry shortly.',
    ar: 'خدمة هيئة الزكاة غير متاحة مؤقتاً. يرجى إعادة المحاولة بعد قليل.',
  },
};

export function getZatcaErrorMessage(
  code: string | undefined,
  locale: 'en' | 'ar' = 'en',
): string {
  if (!code) return ZATCA_ERROR_MESSAGES.SERVER_ERROR[locale];
  return (
    ZATCA_ERROR_MESSAGES[code]?.[locale] ?? ZATCA_ERROR_MESSAGES.SERVER_ERROR[locale]
  );
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

interface ZatcaRequestConfig {
  endpoint: string; // path appended to base URL, e.g. '/compliance'
  method: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** Bearer token (CSID binarySecurityToken) for authenticated calls. */
  authToken?: string;
  /** Basic auth secret paired with `authToken`. ZATCA uses Basic auth for
   *  most CSID-secured endpoints: base64(binarySecurityToken:secret). */
  authSecret?: string;
  /** OTP supplied for the initial compliance CSID request. */
  otp?: string;
  /** Override Accept-Language; defaults to 'en'. */
  acceptLanguage?: 'en' | 'ar';
  /** ZATCA API version header. Defaults to 'V2'. */
  apiVersion?: string;
  /** Timeout in ms. Defaults to 30s. */
  timeoutMs?: number;
  /** Disable retries on 5xx (e.g. for idempotency-sensitive operations). */
  noRetry?: boolean;
}

interface ZatcaRawResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAuthHeader(
  authToken: string | undefined,
  authSecret: string | undefined,
): string | undefined {
  if (!authToken) return undefined;
  if (authSecret) {
    // Basic auth: base64(token:secret)
    const credentials = Buffer.from(`${authToken}:${authSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }
  return `Bearer ${authToken}`;
}

async function zatcaRequest<T = unknown>(
  config: ZatcaRequestConfig,
): Promise<ZatcaRawResponse<T>> {
  const {
    endpoint,
    method,
    body,
    authToken,
    authSecret,
    otp,
    acceptLanguage = 'en',
    apiVersion = 'V2',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    noRetry = false,
  } = config;

  const url = `${getZatcaBaseUrl()}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Language': acceptLanguage,
    'Accept-Version': apiVersion,
  };

  const authHeader = buildAuthHeader(authToken, authSecret);
  if (authHeader) headers.Authorization = authHeader;
  if (otp) headers.OTP = otp;

  const serializedBody = body === undefined ? undefined : JSON.stringify(body);
  const maxAttempts = noRetry ? 1 : MAX_RETRIES;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const startedAt = Date.now();
    console.log(
      `[ZATCA] → ${method} ${url} (attempt ${attempt + 1}/${maxAttempts}, env=${ZATCA_ENV})`,
    );

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: serializedBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const elapsed = Date.now() - startedAt;
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const text = await response.text();
      let parsed: unknown = text;
      if (text && responseHeaders['content-type']?.includes('application/json')) {
        try {
          parsed = JSON.parse(text);
        } catch {
          // keep as text
        }
      }

      console.log(
        `[ZATCA] ← ${response.status} ${method} ${url} (${elapsed}ms)`,
      );

      // Retry on 5xx
      if (response.status >= 500 && response.status < 600 && !noRetry && attempt < maxAttempts - 1) {
        const backoff = RETRY_BACKOFF_MS[attempt] ?? 4_000;
        console.warn(
          `[ZATCA] 5xx response, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxAttempts})`,
        );
        await sleep(backoff);
        continue;
      }

      if (!response.ok) {
        const detail =
          typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
        const zatcaCode =
          (detail.errorCode as string | undefined) ??
          (detail.code as string | undefined) ??
          undefined;
        const message =
          (detail.message as string | undefined) ??
          (detail.error as string | undefined) ??
          getZatcaErrorMessage(zatcaCode, acceptLanguage);

        throw new ZatcaApiError(message, response.status, zatcaCode, parsed);
      }

      return {
        status: response.status,
        data: parsed as T,
        headers: responseHeaders,
      };
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      if (err instanceof ZatcaApiError) {
        // Non-5xx ZatcaApiError: do not retry
        throw err;
      }

      const isAbort = (err as Error)?.name === 'AbortError';
      console.error(
        `[ZATCA] ✗ ${method} ${url} (attempt ${attempt + 1}/${maxAttempts}): ${
          isAbort ? `timeout after ${timeoutMs}ms` : (err as Error)?.message ?? String(err)
        }`,
      );

      if (attempt >= maxAttempts - 1) break;
      const backoff = RETRY_BACKOFF_MS[attempt] ?? 4_000;
      await sleep(backoff);
    }
  }

  if (lastError instanceof ZatcaApiError) throw lastError;
  throw new ZatcaApiError(
    `ZATCA request failed: ${(lastError as Error)?.message ?? 'unknown error'}`,
    0,
    undefined,
    lastError,
  );
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface ZatcaCsidResponse {
  /** Base64-encoded X.509 certificate (binary security token). */
  binarySecurityToken: string;
  /** Paired secret used for Basic auth on subsequent CSID-protected calls. */
  secret: string;
  /** Request correlation ID assigned by ZATCA. */
  requestID: string;
  /** Disposition message returned by ZATCA, when present. */
  dispositionMessage?: string;
  /** Original raw response, for audit/persistence. */
  raw?: unknown;
}

export type ZatcaClearanceStatus = 'CLEARED' | 'CLEARED_WITH_WARNINGS' | 'NOT_CLEARED';

export interface ZatcaValidationResult {
  status: 'PASS' | 'WARNING' | 'ERROR';
  type?: string;
  code?: string;
  category?: string;
  message?: string;
}

export interface ZatcaClearanceResponse {
  /** ZATCA-returned clearance status. */
  clearanceStatus: ZatcaClearanceStatus;
  /** Cleared (signed) UBL XML returned by ZATCA, base64-encoded. */
  clearedInvoice?: string;
  /** Invoice hash echoed back by ZATCA. */
  invoiceHash?: string;
  /** TLV-encoded QR data ZATCA computed (server-side trust). */
  qrCode?: string;
  /** Validation results bundle. */
  validationResults?: {
    infoMessages?: ZatcaValidationResult[];
    warningMessages?: ZatcaValidationResult[];
    errorMessages?: ZatcaValidationResult[];
    status?: 'PASS' | 'WARNING' | 'ERROR';
  };
  raw?: unknown;
}

export type ZatcaReportingStatus = 'REPORTED' | 'REPORTED_WITH_WARNINGS' | 'NOT_REPORTED';

export interface ZatcaReportingResponse {
  reportingStatus: ZatcaReportingStatus;
  validationResults?: ZatcaClearanceResponse['validationResults'];
  raw?: unknown;
}

export interface ZatcaComplianceCheckResponse {
  /** Either clearance or reporting depending on submitted invoice type. */
  clearanceStatus?: ZatcaClearanceStatus;
  reportingStatus?: ZatcaReportingStatus;
  validationResults?: ZatcaClearanceResponse['validationResults'];
  raw?: unknown;
}

// ---------------------------------------------------------------------------
// Endpoint helpers
// ---------------------------------------------------------------------------

/**
 * POST /compliance — request a compliance CSID using an OTP from the ZATCA
 * Fatoora portal and a freshly generated CSR.
 */
export async function requestComplianceCsid(input: {
  otp: string;
  csr: string;
}): Promise<ZatcaCsidResponse> {
  const { otp, csr } = input;
  const { data } = await zatcaRequest<{
    binarySecurityToken: string;
    secret: string;
    requestID: string;
    dispositionMessage?: string;
  }>({
    endpoint: '/compliance',
    method: 'POST',
    otp,
    body: { csr },
  });

  return {
    binarySecurityToken: data.binarySecurityToken,
    secret: data.secret,
    requestID: data.requestID,
    dispositionMessage: data.dispositionMessage,
    raw: data,
  };
}

/**
 * POST /compliance/invoices — submit a test invoice for compliance checks
 * using the compliance CSID.
 */
export async function submitComplianceInvoice(
  invoiceXml: string,
  csid: { binarySecurityToken: string; secret: string },
  options?: { invoiceHash?: string; uuid?: string },
): Promise<ZatcaComplianceCheckResponse> {
  const { data } = await zatcaRequest<ZatcaComplianceCheckResponse>({
    endpoint: '/compliance/invoices',
    method: 'POST',
    authToken: csid.binarySecurityToken,
    authSecret: csid.secret,
    body: {
      invoice: Buffer.from(invoiceXml, 'utf8').toString('base64'),
      invoiceHash: options?.invoiceHash,
      uuid: options?.uuid,
    },
  });

  return { ...data, raw: data };
}

/**
 * POST /production/csids — exchange a compliance CSID for a production CSID
 * (valid ~1 year). Auth is the compliance CSID via Basic auth.
 */
export async function requestProductionCsid(input: {
  complianceCsid: string;
  complianceSecret: string;
  complianceRequestId: string;
}): Promise<ZatcaCsidResponse> {
  const { complianceCsid, complianceSecret, complianceRequestId } = input;

  const { data } = await zatcaRequest<{
    binarySecurityToken: string;
    secret: string;
    requestID: string;
    dispositionMessage?: string;
  }>({
    endpoint: '/production/csids',
    method: 'POST',
    authToken: complianceCsid,
    authSecret: complianceSecret,
    body: { compliance_request_id: complianceRequestId },
  });

  return {
    binarySecurityToken: data.binarySecurityToken,
    secret: data.secret,
    requestID: data.requestID,
    dispositionMessage: data.dispositionMessage,
    raw: data,
  };
}

/**
 * POST /invoices/clearance/single — clear a B2B standard invoice.
 * ZATCA returns the signed/cleared XML, hash, and QR.
 */
export async function clearInvoice(
  invoiceXml: string,
  csid: { binarySecurityToken: string; secret: string },
  options?: { invoiceHash?: string; uuid?: string },
): Promise<ZatcaClearanceResponse> {
  // Demo-mode short-circuit (session-scoped via mugdm_demo cookie).
  const { isDemoModeServer } = await import('@/lib/demo-mode');
  if (await isDemoModeServer()) {
    const { clearInvoiceMock } = await import('./mock-api-client');
    return clearInvoiceMock(invoiceXml, csid, options);
  }
  const { data } = await zatcaRequest<ZatcaClearanceResponse>({
    endpoint: '/invoices/clearance/single',
    method: 'POST',
    authToken: csid.binarySecurityToken,
    authSecret: csid.secret,
    body: {
      invoice: Buffer.from(invoiceXml, 'utf8').toString('base64'),
      invoiceHash: options?.invoiceHash,
      uuid: options?.uuid,
    },
    // Clearance is synchronous and idempotency-sensitive; do not retry on 5xx
    // automatically — the caller should re-check submission status first.
    noRetry: true,
  });

  return { ...data, raw: data };
}

/**
 * POST /invoices/reporting/single — report a B2C simplified invoice.
 * ZATCA acks reporting (asynchronous validation).
 */
export async function reportInvoice(
  invoiceXml: string,
  csid: { binarySecurityToken: string; secret: string },
  options?: { invoiceHash?: string; uuid?: string },
): Promise<ZatcaReportingResponse> {
  // Demo-mode short-circuit (session-scoped via mugdm_demo cookie).
  const { isDemoModeServer } = await import('@/lib/demo-mode');
  if (await isDemoModeServer()) {
    const { reportInvoiceMock } = await import('./mock-api-client');
    return reportInvoiceMock(invoiceXml, csid, options);
  }
  const { data } = await zatcaRequest<ZatcaReportingResponse>({
    endpoint: '/invoices/reporting/single',
    method: 'POST',
    authToken: csid.binarySecurityToken,
    authSecret: csid.secret,
    body: {
      invoice: Buffer.from(invoiceXml, 'utf8').toString('base64'),
      invoiceHash: options?.invoiceHash,
      uuid: options?.uuid,
    },
  });

  return { ...data, raw: data };
}

// ---------------------------------------------------------------------------
// Internal exports for testing
// ---------------------------------------------------------------------------

export const __internal = {
  zatcaRequest,
  buildAuthHeader,
  ZATCA_ENV,
};
