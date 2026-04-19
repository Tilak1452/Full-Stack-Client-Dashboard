import Link from 'next/link';

export default function LandingFooter() {
  return (
    <footer id="about" className="bg-[#0e0e13] w-full px-8 md:px-16 lg:px-24 pt-20 pb-10 border-t border-white/5 font-mono-brand text-xs uppercase tracking-widest text-[#bacac2]">
      {/* Top section: Brand and Links */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16 w-full">
        
        {/* Left Side — Brand */}
        <div>
          <span className="font-inter text-lg font-black text-[#C8FF00] mb-6 block">
            FinSight AI
          </span>
          {/* Live status indicator */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8FF00] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C8FF00]" />
            </div>
            <span>System Operational</span>
          </div>
        </div>

        {/* Right Side — Terminal */}
        <div className="md:text-right">
          <h5 className="text-white mb-6 font-bold">Terminal</h5>
          <ul className="space-y-4">
            <li>
              <Link href="/dashboard" className="hover:text-[#C8FF00] transition-colors">Market Overview</Link>
            </li>
            <li>
              <Link href="/ai-research" className="hover:text-[#C8FF00] transition-colors">AI insights</Link>
            </li>
            <li>
              <Link href="/portfolio" className="hover:text-[#C8FF00] transition-colors">Portfolio Health</Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex flex-col md:flex-row justify-between items-center border-t border-white/5 pt-8 opacity-80">
        <p>© 2026 FinSight AI. Sovereign Intelligence for the Lunar Vault.</p>
      </div>
    </footer>
  );
}
