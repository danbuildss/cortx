export const meta = {
  slug: 'x402-failure-modes',
  title: 'x402 has 7 failure modes. Standard monitoring catches one.',
  date: '2026-08-15',
  excerpt:
    'An x402 API can look operational while silently failing your users at any of seven distinct stages. Here is what each failure looks like, why ping-based monitoring misses it, and how to catch it before a user does.',
  readTime: '7 min read',
};

export default function Post() {
  return (
    <>
      <p>
        A ping check is a binary test. The server responds, or it doesn&apos;t. For a traditional
        API that is enough — if the server is up, the service works.
      </p>
      <p>
        x402 is not a traditional API. A successful HTTP response is not successful service
        delivery. Your server can be fully operational — returning the right status codes, handling
        connections — while the payment flow is completely broken. Your users pay, get nothing, and
        your monitoring shows green.
      </p>
      <p>
        There are seven places this can happen. Standard monitoring catches the first one.
      </p>

      <h2>1. Availability — the one monitors catch</h2>
      <p>
        The server doesn&apos;t respond at all. HTTP timeout, DNS failure, connection refused.
        This is what every uptime monitor tests. A ping or HEAD request; if it responds,
        the check passes.
      </p>
      <p>
        If your server is down, you&apos;ll hear about it. This is the failure mode you already
        have coverage for. The other six are what you don&apos;t.
      </p>

      <h2>2. Payment terms — the 402 response is malformed</h2>
      <p>
        An x402 endpoint starts every payment flow with a <code>402 Payment Required</code> response
        and an <code>X-Payment-Required</code> header that tells the client exactly how to pay:
        which asset, which amount, which network, which recipient.
      </p>
      <p>
        This header has a specific structure. If it&apos;s missing, malformed, or fails JSON
        parsing, the client has no idea how to proceed. The server is up. It returned a 402.
        Every ping-based monitor sees a successful response. But no client can pay.
      </p>
      <p>
        This breaks when you update a library, change a response format, or make a deployment
        that silently corrupts header generation. The server stays up; the payment
        terms go dark.
      </p>

      <h2>3. Price drift — the amount changed without notice</h2>
      <p>
        Your endpoint charges a price. A client integrating with your API hard-codes or caches
        that price expectation. If your price changes — higher, lower, or to zero — clients
        either refuse to pay (price too high) or accept a zero-price response that may indicate
        a broken billing configuration.
      </p>
      <p>
        Price drift is silent. The endpoint looks operational. The 402 response looks valid.
        But the amount doesn&apos;t match what clients expect, and payments stall or get skipped.
        You find out when a user reports they&apos;re not being charged — or when revenue drops
        and you trace it back weeks later.
      </p>

      <h2>4. Payment signing — EIP-712 or contract mismatch</h2>
      <p>
        This is the failure mode that breaks the most builders, and the one that&apos;s hardest
        to catch manually.
      </p>
      <p>
        x402 payments use EIP-3009 (transferWithAuthorization) on USDC. The payment header is an
        EIP-712 typed signature. For that signature to be accepted, the domain parameters —
        chain ID, token contract address, domain name, version — have to match exactly what the
        receiving contract expects.
      </p>
      <p>
        One wrong value and the payment is rejected. Common causes:
      </p>
      <ul>
        <li>
          <strong>Wrong USDC contract address.</strong> Base mainnet USDC is not the same contract
          as Ethereum USDC or USDC.e. A build that swaps in the wrong address produces signatures
          that verify against the wrong domain.
        </li>
        <li>
          <strong>EIP-712 domain mismatch.</strong> The domain name and version fields in the
          signature must match the token contract&apos;s own stored values. If they don&apos;t,
          signature recovery fails.
        </li>
        <li>
          <strong>Wrong chain ID.</strong> A configuration that hardcodes a testnet chain ID in
          production means every payment is signed for the wrong network.
        </li>
      </ul>
      <p>
        A ping check cannot detect any of this. The server returns 402. The header parses. But
        the moment a real client tries to pay, the transaction reverts.
      </p>

      <h2>5. Delivery failure — payment accepted, response broken</h2>
      <p>
        This failure mode occurs after a valid payment is submitted. The endpoint receives the
        payment header, the transaction succeeds on-chain, but the response is a 4xx or 5xx.
        Your user paid. They got an error.
      </p>
      <p>
        Causes include server-side bugs in the post-payment processing path, database errors that
        only surface under the payment code path, or misconfigured middleware that strips or
        rejects the payment header before it reaches your handler.
      </p>
      <p>
        This is particularly dangerous because it can be intermittent — working fine under light
        load, failing under normal traffic — and because the failed transaction may still result
        in a charge that your refund process isn&apos;t built to handle.
      </p>

      <h2>6. Invalid JSON — the response body is unparseable</h2>
      <p>
        The endpoint responds with 200. The payment went through. But the response body isn&apos;t
        valid JSON — it&apos;s an HTML error page, a partial write, a binary blob, or a truncated
        object from a timeout mid-response.
      </p>
      <p>
        Clients that try to parse the response throw, crash, or silently discard the result.
        The payment was successful. The delivery was technically successful. But the value
        was not delivered.
      </p>
      <p>
        This happens after deployments that introduce unhandled exceptions in the response
        serialization path, or when reverse proxies inject error pages into what should be a
        clean JSON stream.
      </p>

      <h2>7. Schema regression — the response shape changed</h2>
      <p>
        The most common failure mode for mature x402 APIs in active development.
      </p>
      <p>
        Your response is valid JSON. The payment went through. The 200 came back. But the
        response no longer matches the schema your client expects. A field got renamed. A
        nested object got flattened. A required field went missing in a refactor. The client
        breaks silently — parsing succeeds but the data is wrong or absent.
      </p>
      <p>
        Schema regressions are undetectable without a reference schema and a validator. A client
        that doesn&apos;t validate the response shape will consume the wrong data until a user
        reports a bug. By then, the regression may have been in production for days.
      </p>

      <h2>Why this matters more than it did six months ago</h2>
      <p>
        Every one of these failure modes existed before x402. APIs have always had broken
        payment integrations, malformed response headers, and schema regressions.
      </p>
      <p>
        What changed is the on-chain component. When a payment fails in a traditional API,
        the user gets an error and tries again. Nothing was charged. The failure is recoverable.
      </p>
      <p>
        In an x402 API, the EIP-3009 transferWithAuthorization executes on-chain. Stages 5, 6,
        and 7 can fail after real USDC has moved. The user paid. The API failed them. And your
        monitoring showed green through all of it.
      </p>
      <p>
        The stakes are different. The monitoring needs to be different too.
      </p>

      <h2>What monitoring actually looks like for x402</h2>
      <p>
        Catching all seven failure modes requires running the full payment flow synthetically —
        not simulating it, not mocking it. An actual signed EIP-3009 payment to your endpoint,
        from a real wallet, on Base mainnet, followed by validation of the response body against
        your expected schema.
      </p>
      <p>
        That&apos;s what CORTX runs. Every check is a real USDC transaction on Base mainnet,
        through all seven stages, with evidence collected at each one. If stage 4 fails, you
        know it was a payment signing error, not a schema issue. If stage 7 fails, you see
        exactly what the response contained and what the schema expected.
      </p>
      <p>
        The cost per check is a fraction of a cent. The cost of finding out through a user
        complaint is much higher.
      </p>
      <p>
        <a href="/signup">Monitor your x402 endpoint →</a>
      </p>
    </>
  );
}
