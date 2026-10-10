import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTNERS, SERVICE_PARTNERS, partnerFor } from './partners.ts';

test('the x402 ecosystem snapshot loads and maps websites to companies', () => {
  assert.ok(PARTNERS.length >= 150);
  assert.equal(SERVICE_PARTNERS.length >= 70, true);
  assert.equal(partnerFor('firecrawl.dev')?.name, 'Firecrawl');
  assert.equal(partnerFor('exa.ai')?.name, 'Exa');
  assert.equal(partnerFor('pinata.cloud')?.name, 'Pinata');
  assert.equal(partnerFor('EXA.AI')?.name, 'Exa', 'case-insensitive');
  assert.equal(partnerFor('example.com'), null);
  // Docs hosts don't turn the whole docs platform into a partner
  assert.equal(partnerFor('readthedocs.io'), null);
  assert.ok(PARTNERS.every((p) => p.domain && !p.domain.includes('/')));
});
