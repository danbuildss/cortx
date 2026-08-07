import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — CORTX',
  description: 'Thoughts on x402 reliability, on-chain monitoring, and building for Base mainnet.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
