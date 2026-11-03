import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Sign In / Sign Up',
  description: `Sign in or create your ${siteConfig.name} account to track and retain DSA problems and system design concepts.`,
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
