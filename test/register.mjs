// Test-only module hooks (never used by the app):
// - resolve extensionless relative imports to .ts (the app is bundled by Next;
//   Node's type stripping needs explicit extensions)
// - swap lib/check-runner/ssrf.ts for a stub that allows the local fake service
// - give payment.ts a viem whose balance read returns a fixed balance, so no
//   RPC call to Base is needed
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
