// Test-only module hooks (never used by the app):
// - resolve extensionless relative imports to .ts (the app is bundled by Next;
//   Node's type stripping needs explicit extensions)
// - swap lib/check-runner/ssrf.ts for a stub that allows the local fake service
// - swap lib/check-runner/fetch-endpoint.ts for plain fetch (the real one only
//   calls public https addresses; it's tested in lib/net/checked-fetch.test.ts)
// - give payment.ts a viem whose balance read returns a fixed balance, so no
//   RPC call to Base is needed
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
