/**
 * Stubs for loading public regulation corpora into the RAG store.
 *
 * These are intentionally empty for now. The corpus wave will populate them
 * from the authoritative sources below. We do NOT hardcode scraping URLs here
 * to avoid coupling to specific page layouts; the loader implementations
 * should be built against documented PDFs/HTML exports:
 *
 *  - ZATCA: tax + e-invoicing regulations, bulletins. Source: https://zatca.gov.sa
 *           (Arabic + English PDFs; also the e-invoicing resolution docs).
 *  - GOSI:  social insurance regs, contribution rules. Source: gosi.gov.sa.
 *  - SOCPA: Saudi accounting standards (IFRS for SMEs adaptation). Source: socpa.org.sa.
 *
 * TODO(corpus-wave): wire each loader to pull source PDFs/HTML, convert to
 * text (pdf-parse / unstructured), and call `ingestDocument` with
 * businessId=null so the content is globally visible via RLS.
 */

import type { IngestParams } from './types'

export type CorpusDoc = Omit<IngestParams, 'businessId'> & { businessId: null }

export async function loadZatcaRegs(): Promise<CorpusDoc[]> {
  // TODO: fetch from https://zatca.gov.sa — Regulations, E-Invoicing resolutions.
  return []
}

export async function loadGosiRegs(): Promise<CorpusDoc[]> {
  // TODO: fetch from https://gosi.gov.sa — Social Insurance Law + bylaws.
  return []
}

export async function loadSocpaStandards(): Promise<CorpusDoc[]> {
  // TODO: fetch from https://socpa.org.sa — Adopted IFRS/IFRS-for-SMEs standards.
  return []
}
