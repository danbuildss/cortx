import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cost Guide — CORTX Docs',
  description:
    'On-chain monitoring costs for x402 endpoints: pricing matrix, spend caps, wallet planning, and builder best practices.',
};

export default function CostLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
