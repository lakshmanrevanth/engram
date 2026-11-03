import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProblemsTable } from '@/components/problems-table';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Track and manage your LeetCode and DSA problem revision queue.',
};

// Suspense is required because the table reads filters from useSearchParams.
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <ProblemsTable />
    </Suspense>
  );
}
