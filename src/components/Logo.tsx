import { BENCHMARK_LOGO_DATA_URL } from '@/lib/benchmarkLogo';

interface LogoProps {
  variant?: 'dark' | 'light'; // dark = for white backgrounds, light = for navy backgrounds
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { height: 32, padding: 'px-2 py-1' },
  md: { height: 40, padding: 'px-3 py-1.5' },
  lg: { height: 56, padding: 'px-4 py-2' },
};

export default function Logo({ variant = 'dark', showTagline = false, size = 'md' }: LogoProps) {
  const taglineColor = variant === 'light' ? 'text-gold-300' : 'text-slate-500';
  const { height, padding } = SIZES[size];

  return (
    <div className="flex items-center gap-3">
      {/* The real logo has navy/black text, so it always sits on a white chip for
          contrast - regardless of whether the page background is white or navy. */}
      <div className={`inline-flex items-center rounded-lg bg-white ${padding} shadow-sm`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BENCHMARK_LOGO_DATA_URL} alt="Benchmark Engineering Inc." style={{ height, width: 'auto' }} />
      </div>
      {showTagline && (
        <p className={`text-xs font-medium uppercase tracking-widest ${taglineColor}`}>
          Western Canadian
          <br />
          Oil &amp; Gas
        </p>
      )}
    </div>
  );
}