import { Navbar } from '@/components/sections/navbar'
import { Hero } from '@/components/sections/hero'
import { Services } from '@/components/sections/services'
import { Process } from '@/components/sections/process'
import { Demo } from '@/components/sections/demo'
import { Why } from '@/components/sections/why'
// import { Testimonials } from '@/components/sections/testimonials'
import { Pricing } from '@/components/sections/pricing'
import { Contact } from '@/components/sections/contact'
import { Footer } from '@/components/sections/footer'
import { GlowDivider } from '@/lib/animations'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <GlowDivider className="my-0" />
        <Services />
        <GlowDivider className="my-0" />
        <Process />
        <GlowDivider className="my-0" />
        <Demo />
        <GlowDivider className="my-0" />
        <Why />
        <GlowDivider className="my-0" />
        <Pricing />
        <GlowDivider className="my-0" />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
