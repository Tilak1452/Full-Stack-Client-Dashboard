import NavBar from '@/components/landing/NavBar';
import TickerTape from '@/components/landing/TickerTape';
import HeroSection from '@/components/landing/HeroSection';
import TrustBar from '@/components/landing/TrustBar';
import FeatureGrid from '@/components/landing/FeatureGrid';
import ProtocolSection from '@/components/landing/ProtocolSection';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata = {
  title: 'FinSight AI | Sovereign Intelligence for the Lunar Vault',
  description: 'Real-time analytics and portfolio intelligence for the modern Indian investor.',
};

export default function LandingPage() {
  return (
    <div className="bg-[#131318] text-[#e4e1e9] min-h-screen">
      {/* Noise texture overlay — fixed, pointer-events-none, z-index 9999 */}
      <div className="noise-overlay" aria-hidden="true" />

      <NavBar />

      <main className="pt-24">
        <TickerTape />
        <HeroSection />
        <TrustBar />
        <FeatureGrid />
        <ProtocolSection />
      </main>

      <LandingFooter />
    </div>
  );
}
