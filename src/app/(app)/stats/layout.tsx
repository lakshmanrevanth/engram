import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stats',
  description: 'Your recall rate, weakest topics, upcoming review load and ladder progress.',
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
