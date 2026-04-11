'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Camera,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type UploadState = 'idle' | 'dragging' | 'uploading' | 'complete' | 'error'

const MAX_FILE_SIZE_DEFAULT = 10 * 1024 * 1024

interface FileUploadProps {
  accept?: Record<string, string[]>
  maxSize?: number
  onUpload: (url: string, file: File) => void
  label?: string
  description?: string
  bucket: string
  path: string
  className?: string
  isCircular?: boolean
  previewUrl?: string | null
}

export function FileUpload({
  accept = {
    'application/pdf': ['.pdf'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
  },
  maxSize = MAX_FILE_SIZE_DEFAULT,
  onUpload,
  label,
  description,
  bucket,
  path,
  className,
  isCircular = false,
  previewUrl: externalPreviewUrl,
}: FileUploadProps) {
  const t = useTranslations('common')
  const tOnboarding = useTranslations('onboarding')

  const [uploadState, setUploadState] = useState<UploadState>(
    externalPreviewUrl ? 'complete' : 'idle'
  )
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(externalPreviewUrl ?? null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isImage, setIsImage] = useState(false)

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadState('uploading')
      setProgress(0)
      setErrorMessage(null)
      setFileName(file.name)

      const fileIsImage = file.type.startsWith('image/')
      setIsImage(fileIsImage)

      if (fileIsImage) {
        const objectUrl = URL.createObjectURL(file)
        setPreviewUrl(objectUrl)
      } else {
        setPreviewUrl(null)
      }

      try {
        const supabase = createClient()
        const fileExt = file.name.split('.').pop()
        const filePath = `${path}/${Date.now()}.${fileExt}`

        // Simulate progress since Supabase SDK doesn't provide upload progress
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval)
              return 90
            }
            return prev + 10
          })
        }, 150)

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        clearInterval(progressInterval)

        if (error) {
          setUploadState('error')
          setErrorMessage(error.message)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(data.path)

        setProgress(100)
        setUploadState('complete')
        onUpload(publicUrl, file)
      } catch {
        setUploadState('error')
        setErrorMessage(t('error'))
      }
    },
    [bucket, path, onUpload, t]
  )

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return
      handleUpload(file)
    },
    [handleUpload]
  )

  const handleReset = useCallback(() => {
    setUploadState('idle')
    setProgress(0)
    setPreviewUrl(null)
    setFileName(null)
    setErrorMessage(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: uploadState === 'uploading',
    onDropRejected: (rejections) => {
      const rejection = rejections[0]
      if (!rejection) return
      const code = rejection.errors[0]?.code
      if (code === 'file-too-large') {
        setErrorMessage(tOnboarding('maxFileSize'))
      } else {
        setErrorMessage(tOnboarding('supportedFormats'))
      }
      setUploadState('error')
    },
  })

  const currentState: UploadState = isDragActive ? 'dragging' : uploadState

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-foreground">
          {label}
        </label>
      )}

      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer overflow-hidden border-2 border-dashed transition-all duration-300',
          isCircular
            ? 'mx-auto h-32 w-32 rounded-full'
            : 'rounded-xl p-6',
          currentState === 'idle' &&
            'border-border bg-surface-1 hover:border-primary/50 hover:bg-surface-2',
          currentState === 'dragging' &&
            'border-primary bg-primary/5 scale-[1.02]',
          currentState === 'uploading' &&
            'border-primary/50 bg-surface-1 pointer-events-none',
          currentState === 'complete' &&
            'border-green-500/50 bg-green-500/5 hover:border-green-500',
          currentState === 'error' &&
            'border-red-500/50 bg-red-500/5 hover:border-red-500'
        )}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {/* Idle / Dragging */}
          {(currentState === 'idle' || currentState === 'dragging') && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center justify-center',
                isCircular
                  ? 'h-full flex-col gap-1'
                  : 'flex-col gap-3 text-center'
              )}
            >
              <div
                className={cn(
                  'rounded-xl bg-primary/10 text-primary transition-transform',
                  isCircular ? 'p-2' : 'p-3',
                  currentState === 'dragging' && 'scale-110'
                )}
              >
                <Upload className={isCircular ? 'h-5 w-5' : 'h-6 w-6'} />
              </div>
              {!isCircular && (
                <>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {label || tOnboarding('uploadCR')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {description || tOnboarding('uploadCRDescription')}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground/60">
                    {tOnboarding('supportedFormats')} &middot;{' '}
                    {tOnboarding('maxFileSize')}
                  </p>
                </>
              )}
            </motion.div>
          )}

          {/* Uploading */}
          {currentState === 'uploading' && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center justify-center',
                isCircular ? 'h-full flex-col gap-1' : 'flex-col gap-3'
              )}
            >
              <Loader2
                className={cn(
                  'animate-spin text-primary',
                  isCircular ? 'h-6 w-6' : 'h-8 w-8'
                )}
              />
              {!isCircular && (
                <>
                  <p className="text-sm font-medium text-foreground">
                    {tOnboarding('processing')}
                  </p>
                  <div className="w-full max-w-xs">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                      {progress}%
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Complete */}
          {currentState === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center',
                isCircular
                  ? 'h-full justify-center'
                  : 'gap-4'
              )}
            >
              {isCircular ? (
                previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                )
              ) : (
                <>
                  {/* Preview thumbnail */}
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                    {isImage && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <FileText className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {fileName}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-xs text-green-400">
                        {tOnboarding('extractionComplete')}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReset()
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                    aria-label={t('delete')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* Error */}
          {currentState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center justify-center',
                isCircular ? 'h-full flex-col gap-1' : 'flex-col gap-3 text-center'
              )}
            >
              <div className="rounded-xl bg-red-500/10 p-3 text-red-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              {!isCircular && (
                <>
                  <p className="text-sm font-medium text-red-400">
                    {errorMessage || t('error')}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReset()
                    }}
                    className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                  >
                    {t('retry')}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile camera capture */}
      {(currentState === 'idle' || currentState === 'error') && !isCircular && (
        <div className="mt-3 flex justify-center sm:hidden">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-1 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2">
            <Camera className="h-4 w-4 text-primary" />
            <span>{t('upload')}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
              }}
            />
          </label>
        </div>
      )}
    </div>
  )
}
