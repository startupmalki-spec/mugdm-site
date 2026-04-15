import { Navbar } from '@/components/sections/navbar'
import { Hero } from '@/components/sections/hero'
import { SocialProof } from '@/components/sections/social-proof'
import { Services } from '@/components/sections/services'
import { Process } from '@/components/sections/process'
import { Demo } from '@/components/sections/demo'
import { Why } from '@/components/sections/why'
// import { Testimonials } from '@/components/sections/testimonials'
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
        <GlowDivider className="my-0" />
        <ScrollReveal><Services /></ScrollReveal>
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
