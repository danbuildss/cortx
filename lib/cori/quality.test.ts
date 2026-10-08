import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companyOf, isFreeHosting, listingQuality } from './quality.ts';

test('company = registrable domain; free hosting keeps the full host', () => {
  assert.equal(companyOf('dns.intel.rallylive.ca'), 'rallylive.ca');
  assert.equal(companyOf('intel.rallylive.ca'), 'rallylive.ca');
  assert.equal(companyOf('api.example.co.uk'), 'example.co.uk');
  assert.equal(companyOf('21millionpixels.art'), '21millionpixels.art');
  assert.equal(companyOf('agent-treats-production.up.railway.app'), 'agent-treats-production.up.railway.app');
  assert.equal(companyOf('Market.DataPackVibe.com.'), 'datapackvibe.com');
});

test('free hosting is recognised, own domains are not', () => {
  for (const h of ['agent-treats-production.up.railway.app', 'x.vercel.app', 'abc.ngrok-free.app', 'w.workers.dev', 'u.github.io']) {
    assert.equal(isFreeHosting(h), true, h);
  }
  for (const h of ['x402.ottoai.services', 'edgar.apitoll.cloud', 'api.oblique.markets', 'notvercel.app.example.com']) {
    assert.equal(isFreeHosting(h), false, h);
  }
});

const real = { host: 'edgar.apitoll.cloud', name: 'ApiToll SEC Filings', description: 'Search and fetch SEC EDGAR filings by ticker or CIK.', watched: false };

test('a real product passes', () => {
  assert.deepEqual(listingQuality(real), { ok: true, reasons: ['quality:ok'] });
});

test('noise is rejected, with every reason listed', () => {
  assert.deepEqual(listingQuality({ ...real, host: 'agent-treats-production.up.railway.app' }).reasons, ['quality:free_hosting']);
  assert.deepEqual(listingQuality({ ...real, name: null }).reasons, ['quality:no_name']);
  assert.deepEqual(listingQuality({ ...real, name: 'Test API' }).reasons, ['quality:test_name']);
  assert.deepEqual(listingQuality({ ...real, name: 'hello-world' }).reasons, ['quality:test_name']);
  assert.deepEqual(listingQuality({ ...real, description: 'paid' }).reasons, ['quality:no_description']);
  assert.deepEqual(listingQuality({ ...real, description: 'demo endpoint for testing x402' }).reasons, ['quality:test_description']);
  assert.deepEqual(listingQuality({ host: 'a.vercel.app', name: '', description: '', watched: false }).reasons,
    ['quality:free_hosting', 'quality:no_name', 'quality:no_description']);
  // Words inside other words don't count
  assert.equal(listingQuality({ ...real, name: 'Contested Markets' }).ok, true);
});

test('the watch list always passes', () => {
  assert.deepEqual(listingQuality({ host: 'x.vercel.app', name: null, description: null, watched: true }), { ok: true, reasons: ['quality:watch_list'] });
});
