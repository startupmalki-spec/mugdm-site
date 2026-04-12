'use client'

import { Link } from '@/i18n/routing'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" />
          )}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="text-primary transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
