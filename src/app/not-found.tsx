import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
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
              width={200}
              height={56}
              className="h-14 w-auto"
              priority
            />
          </Link>
        </div>

        <div className="space-y-4">
          <p className="text-8xl font-bold text-primary">404</p>
          <h1 className="text-2xl font-semibold text-foreground">
            Page not found
          </h1>
          <p className="text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div>
          <Link
            href="/"
            className="inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
