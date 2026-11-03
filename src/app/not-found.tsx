import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { Pixel404Shooter } from '@/components/pixel-shooter/pixel-404-shooter';

export const metadata: Metadata = {
  title: `404 - Page Not Found | ${siteConfig.name}`,
  description: 'Shoot down the descending 404 errors with your plane.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="w-full min-h-[100dvh] overflow-hidden bg-[#f4f3ef]">
      <Pixel404Shooter />
    </main>
  );
}
