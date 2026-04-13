'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PartnersStrip } from '@/components/ui/partners-strip';
import { FeaturesGrid } from '@/components/ui/features-grid';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Testimonials } from '@/components/ui/testimonials';
import { Footer } from '@/components/ui/footer';
import { BackgroundVideo } from '@/components/ui/background-video';
import { FAQ } from '@/components/ui/faq';
import { StructuredData, faqSchema } from '@/components/seo/structured-data';

export default function Home() {
  return (
    <>
      <StructuredData data={faqSchema} />
      <div className="min-h-screen bg-[#181818] text-white overflow-x-hidden selection:bg-[#CCFF00] selection:text-black font-rajdhani">



        {/* Hero Section */}
        <section id="home" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-screen flex items-center">

          {/* Background Video */}
          <div className="absolute inset-0 z-0">
            <BackgroundVideo />
          </div>

          <div className="absolute bottom-8 left-6 right-6 z-10 flex flex-col items-start md:bottom-12 md:left-12 md:right-12 pointer-events-none">
            <div className="pointer-events-auto w-full md:w-auto">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-normal uppercase mb-6 text-left font-monument break-words">
                <motion.span
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="block mb-4 text-[#f0fbcd]"
                >
                  BUY USDC ON SOLANA
                </motion.span>
                <motion.span
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="block text-[#f0fbcd]"
                >
                  INSTANTLY WITH UPI
                </motion.span>
              </h1>

              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.8 }}
              >
                <Link href="/swap" className="block w-full md:w-auto">
                  <button className="group relative inline-flex items-center justify-center px-8 py-3 bg-[#CCFF00] text-black font-bold text-lg uppercase tracking-wider clip-path-button hover:bg-[#D4FF00] transition-all duration-300 hover:shadow-[0_0_30px_rgba(204,255,0,0.5)] font-monument w-full md:w-auto">
                    <span className="relative z-10">BUY NOW</span>
                    <div className="absolute inset-0 bg-white/40 translate-x-full group-hover:translate-x-0 transition-transform duration-300 skew-x-12"></div>
                  </button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Partners Section */}
        <PartnersStrip />

        {/* What is XOTC Section */}
        <section className="py-24 px-6 relative bg-[#181818]">
          <div className="max-w-6xl mx-auto relative">
            {/* Background Frame */}
            <div className="relative w-full aspect-[16/9] md:aspect-[2/1] flex items-center justify-center">
              <Image
                src="/ff.png"
                alt="What is SolUpi Background"
                fill
                className="object-fill"
                priority
              />

              {/* Content Overlay */}
              <div className="relative z-10 text-center px-8 md:px-20 max-w-4xl mx-auto">
                <h2 className="text-4xl md:text-6xl font-bold uppercase mb-6 text-[#f0fbcd] tracking-tighter font-monument">
                  WHAT IS <span className="text-[#CCFF00]">SolUpi</span>
                </h2>
                <p className="text-white text-lg md:text-2xl leading-relaxed font-medium tracking-wide">
                  SolUpi is the fastest and most affordable way to buy USDC on Solana using UPI.
                  <br className="hidden md:block" />
                  It connects Indian UPI payments to Solana’s lightning-fast blockchain, enabling instant, trusted, and fully transparent USDC purchases without middlemen or inflated fees.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid Section */}
        <section id="about" className="py-24 px-6 bg-[#0F0F0F] relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-20"></div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold uppercase mb-4 font-monument">WHY USE <span className="text-[#CCFF00]">SolUpi?</span></h2>
              <p className="text-gray-400 max-w-2xl mx-auto">The most secure and efficient way to trade tokens directly.</p>
            </div>

            <FeaturesGrid />
          </div>
        </section>

        {/* FAQ Section */}
        <FAQ />

        {/* Testimonials Section */}
        <div id="community">
          <Testimonials />
        </div>

        {/* Footer */}
        <div id="contact">
          <Footer />
        </div>
      </div>
    </>
  );
}

