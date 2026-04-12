import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'

export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'en',
})

export const {
  Link,
  redirect,
  usePathname,
  useRouter,
  getPathname,
  permanentRedirect,
} = createNavigation(routing)
