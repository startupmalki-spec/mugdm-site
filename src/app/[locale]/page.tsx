import { Navbar } from '@/components/sections/navbar'
import { Hero } from '@/components/sections/hero'
import { Services } from '@/components/sections/services'
import { Process } from '@/components/sections/process'
import { Why } from '@/components/sections/why'
import { Pricing } from '@/components/sections/pricing'
import { Contact } from '@/components/sections/contact'
import { Footer } from '@/components/sections/footer'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Process />
        <Why />
        <Pricing />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
