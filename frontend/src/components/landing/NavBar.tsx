"use client";

import Link from 'next/link';

export default function NavBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-6 px-4">
      <nav className="bg-white/5 backdrop-blur-xl rounded-full max-w-fit px-8 py-3 border border-white/10 shadow flex items-center gap-12 font-inter">
        <span className="text-xl font-bold text-[#e4e1e9]">FinSight AI</span>
        
        <div className="hidden md:flex items-center gap-8">
          <Link href="#capabilities" className="text-sm font-medium text-[#bacac2] hover:text-[#C8FF00] transition-colors">
            Capabilities
          </Link>
          <Link href="#about" className="text-sm font-medium text-[#bacac2] hover:text-[#C8FF00] transition-colors">
            About
          </Link>
        </div>

        <Link href="/auth/signup">
          <button className="bg-[#C8FF00] text-[#002118] px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 shadow-[0_0_15px_rgba(200,255,0,0.3)] transition-all">
            Join Us
          </button>
        </Link>
      </nav>
    </header>
  );
}
