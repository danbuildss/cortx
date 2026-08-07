import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CORTX Docs — x402 Reliability Monitoring',
  description:
    'Full documentation for CORTX: quickstart, how it works, service configuration, incidents, and FAQ.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
