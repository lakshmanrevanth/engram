import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Design',
  description: 'Log the system design concepts you learn and review them on a spaced repetition schedule.',
};

export default function ConceptsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
