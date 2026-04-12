'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      {/* Shadda watermark */}
      <div className="pointer-events-none absolute bottom-[-60px] right-[-40px] opacity-[0.04]">
        <Image
          src="/brand/7-transparent.png"
          alt=""
          width={280}
          height={280}
          className="brightness-200"
          aria-hidden="true"
        />
      </div>

      <div className="relative z-[1] w-full max-w-md space-y-8 text-center">
        {/* Brand logo */}
        <div>
          <Link href="/" className="inline-flex items-center justify-center">
            <Image
              src="/brand/2-transparent.png"
              alt="Mugdm"
              width={160}
              height={48}
              className="h-10 w-auto"
              priority
            />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-6 w-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again or return to the home
            page.
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => reset()}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              Try again
            </button>
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
