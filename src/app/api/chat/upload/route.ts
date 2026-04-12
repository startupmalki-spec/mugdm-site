import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseExcelBuffer, type ParsedExcel } from '@/lib/chat/excel-parser'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

const SPREADSHEET_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'application/csv',
])

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

type UploadResult =
  | { type: 'spreadsheet'; data: ParsedExcel }
  | { type: 'document'; base64: string; mediaType: string; fileName: string }
  | { type: 'image'; base64: string; mediaType: string; fileName: string }

export async function POST(request: Request) {
  let userId: string | undefined

  try {
    // Auth check
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const businessId = formData.get('businessId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB.' },
        { status: 413 }
      )
    }

    // Verify user owns this business
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found or access denied' },
        { status: 403 }
      )
    }

    const mimeType = file.type
    const fileName = file.name
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let result: UploadResult

    // Determine file type by MIME or extension fallback
    const ext = fileName.toLowerCase().split('.').pop()
    const isSpreadsheet =
      SPREADSHEET_TYPES.has(mimeType) || ['xlsx', 'xls', 'csv'].includes(ext ?? '')
    const isPdf = mimeType === 'application/pdf' || ext === 'pdf'
    const isImage = IMAGE_TYPES.has(mimeType)

    if (isSpreadsheet) {
      try {
        const parsed = await parseExcelBuffer(buffer, fileName)
        result = { type: 'spreadsheet', data: parsed }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse spreadsheet'
        return NextResponse.json({ error: message }, { status: 422 })
      }
    } else if (isPdf) {
      const base64 = buffer.toString('base64')
      result = {
        type: 'document',
        base64,
        mediaType: 'application/pdf',
        fileName,
      }
    } else if (isImage) {
      const base64 = buffer.toString('base64')
      result = {
        type: 'image',
        base64,
        mediaType: mimeType,
        fileName,
      }
    } else {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${mimeType || ext}. Supported: Excel (.xlsx, .xls), CSV, PDF, and images (PNG, JPEG, GIF, WebP).`,
        },
        { status: 415 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] chat/upload failed:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Upload processing failed' }, { status: 500 })
  }
}
