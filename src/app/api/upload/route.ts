import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createAuthClient } from '@/lib/supabase/server'

const ALLOWED_BUCKETS = ['documents', 'logos', 'receipts'] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const SIGNED_URL_EXPIRY_SECONDS = 3600

export async function POST(request: Request) {
  // Verify the user is authenticated
  const authClient = await createAuthClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const bucket = formData.get('bucket') as string | null
  const path = formData.get('path') as string | null

  if (!file || !bucket || !path) {
    return NextResponse.json({ error: 'file, bucket, and path are required' }, { status: 400 })
  }

  if (!ALLOWED_BUCKETS.includes(bucket as typeof ALLOWED_BUCKETS[number])) {
    return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 })
  }

  // Use service role client to bypass RLS for storage
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const fileExt = file.name.split('.').pop() ?? 'bin'
  const filePath = `${path}/${Date.now()}.${fileExt}`

  const arrayBuffer = await file.arrayBuffer()
  const { data, error: uploadError } = await serviceClient.storage
    .from(bucket)
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(data.path, SIGNED_URL_EXPIRY_SECONDS)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return NextResponse.json(
      { error: signedUrlError?.message ?? 'Failed to generate signed URL' },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: signedUrlData.signedUrl, path: data.path })
}
