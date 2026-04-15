import { Navbar } from '@/components/sections/navbar'
import { Hero } from '@/components/sections/hero'
import { SocialProof } from '@/components/sections/social-proof'
import { Stats } from '@/components/sections/stats'
import { BuiltOn } from '@/components/sections/built-on'
import { Features } from '@/components/sections/features'
import { Process } from '@/components/sections/process'
import { Demo } from '@/components/sections/demo'
import { Why } from '@/components/sections/why'
import { Testimonials } from '@/components/sections/testimonials'
import { Pricing } from '@/components/sections/pricing'
import { Contact } from '@/components/sections/contact'
import { Footer } from '@/components/sections/footer'
import { GlowDivider } from '@/lib/animations'
import { ScrollReveal } from '@/components/ScrollReveal'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ScrollReveal><SocialProof /></ScrollReveal>

        {/* Warm band — dual-tone marketing (P2.1). Sits between dark hero and dark CTA. */}
        <div data-theme-section="warm">
          <ScrollReveal><Stats /></ScrollReveal>
          <ScrollReveal><BuiltOn /></ScrollReveal>
          <GlowDivider className="my-0" />
          <ScrollReveal><Features /></ScrollReveal>
          <GlowDivider className="my-0" />
          <ScrollReveal><Testimonials /></ScrollReveal>
        </div>

        <GlowDivider className="my-0" />
        <ScrollReveal><Process /></ScrollReveal>
        <GlowDivider className="my-0" />
        <ScrollReveal><Demo /></ScrollReveal>
        <GlowDivider className="my-0" />
        <ScrollReveal><Why /></ScrollReveal>
        <GlowDivider className="my-0" />
        <ScrollReveal><Pricing /></ScrollReveal>
        <GlowDivider className="my-0" />
        <ScrollReveal><Contact /></ScrollReveal>
      </main>
      <Footer />
    </>
  )
}
