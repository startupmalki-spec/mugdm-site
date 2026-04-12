import Image from 'next/image'

export default function AuthLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="animate-pulse">
        <Image
          src="/brand/7-transparent.png"
          alt="Loading"
          width={64}
          height={64}
          className="h-16 w-16 object-contain opacity-40"
          priority
        />
      </div>
    </div>
  )
}
