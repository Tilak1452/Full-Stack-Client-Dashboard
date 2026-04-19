"use client";

import Link from 'next/link';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <section className="relative px-8 md:px-24 py-20 lg:py-32 flex flex-col items-center text-center font-inter">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#C8FF00]/5 to-transparent pointer-events-none" />

      {/* Headline */}
      <h1 className="text-6xl md:text-8xl font-extrabold text-[#e4e1e9] tracking-tighter mb-6 max-w-4xl leading-tight">
        Intelligence behind
        <br />
        <span className="text-[#C8FF00]">every rupee.</span>
      </h1>

      {/* Subheadline */}
      <p className="text-[#bacac2] text-lg md:text-xl max-w-2xl mb-10 leading-relaxed font-inter">
        Real-time analytics and portfolio intelligence for the modern Indian investor.
        Experience sovereign-grade data processing for your retail wealth.
      </p>

      {/* CTA Buttons Row */}
      <div className="flex gap-4 relative z-10">
        <Link href="/auth/login">
          <button className="bg-[#C8FF00] text-[#002118] px-8 py-4 rounded-lg font-bold text-lg hover:shadow-[0_0_30px_rgba(200,255,0,0.4)] transition-all">
            Login
          </button>
        </Link>
        <Link href="/auth/signup">
          <button className="border border-[#3b4a44] text-[#e4e1e9] px-8 py-4 rounded-lg font-bold text-lg hover:bg-white/5 transition-all">
            Sign In
          </button>
        </Link>
      </div>

      {/* Dashboard Preview Image */}
      <div className="mt-20 w-full max-w-5xl relative group z-10">
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[#C8FF00] to-[#D2BBFF] blur-2xl opacity-20 group-hover:opacity-30 transition duration-1000" />
        
        {/* Card */}
        <div className="relative glass-card rounded-2xl overflow-hidden aspect-video shadow-2xl">
          <Image
            src="/landing/dashboard-preview.jpeg"
            alt="FinSight AI financial dashboard preview"
            fill
            priority
            className="object-cover mix-blend-luminosity group-hover:mix-blend-normal transition-all duration-700"
          />
          {/* Gradient overlay on image */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#131318] to-transparent opacity-60" />
          
          {/* macOS-style traffic light dots */}
          <div className="absolute top-6 left-6 flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ffb4ab]" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-[#C8FF00]" />
          </div>
        </div>
      </div>
    </section>
  );
}
