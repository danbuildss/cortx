import Link from 'next/link';

export const meta = {
  slug: 'x402-facilitators-arent-universal',
  title: "x402 facilitators aren't universal — and that's the hidden failure mode nobody talks about",
  date: '2026-08-29',
  excerpt:
    'We built payment readiness verification for x402 services and hit an HTTP 500 that changed how we think about the whole monitoring stack. Here is what we found, why it matters for anyone building on x402, and what we have documented in the open spec.',
  readTime: '6 min read',
};

export default function Post() {
  return (
    <>
      <blockquote>
        <p>
          <strong>Correction, October 6, 2026:</strong> two things in this post are out of date.
          We no longer recommend falling back to <code>x402.org</code> when a service doesn&apos;t
          publish its facilitator &mdash; the facilitator is the server&apos;s choice, so the honest
          result is &ldquo;can&apos;t check&rdquo;, not &ldquo;not ready&rdquo;. And Bankr&apos;s
          facilitator now requires authentication, so the readiness results below no longer apply
          to those services. Details:{' '}
          <Link href="/blog/measuring-x402-reliability">
            What 4,500+ x402 checks taught us about measuring reliability
          </Link>
          .
        </p>
      </blockquote>
      <p>
        Most x402 monitoring stops at the wrong question.
      </p>
      <p>
        &ldquo;Is your server alive?&rdquo; is easy to answer. A ping, a status code, a green
        light. Done. What it doesn&apos;t tell you is whether the payment will actually clear when
        your agent tries to pay.
      </p>
      <p>
        We built a layer to check that. And in building it, we found something the whole x402
        ecosystem needs to know.
      </p>

      <h2>The three questions you should be asking</h2>
      <p>
        When we designed CORTX&apos;s monitoring stack, we split it into three layers based on what
        each one actually verifies.
      </p>
      <p>
        <strong>Layer 1 — Is the service reachable?</strong> A lightweight check. Availability,
        the 402 response, payment terms, price validity. No money moves. Runs every 15 minutes.
        Near-zero cost. This is what most monitoring does and calls it finished.
      </p>
      <p>
        <strong>Layer 2 — Would a payment actually clear?</strong> This is the layer we just built.
        We call the facilitator&apos;s <code>/verify</code> endpoint with a signed EIP-3009
        authorization — the exact authorization a real payment would use — but we don&apos;t call{' '}
        <code>/settle</code>. No USDC moves. We just ask: <em>if we paid right now, would it work?</em>
      </p>
      <p>
        <strong>Layer 3 — Did someone pay and receive the result?</strong> A full synthetic payment.
        Real USDC, end-to-end, through every stage of the x402 pipeline. This runs daily.
      </p>
      <p>
        Each layer catches a different failure mode. Layer 1 tells you the server is alive. Layer 2
        tells you the payment infrastructure is working. Layer 3 tells you the product was actually
        delivered.
      </p>
      <p>We expected Layer 2 to be straightforward. It wasn&apos;t.</p>

      <h2>The HTTP 500 that changed everything</h2>
      <p>
        The first time we ran payment readiness checks, we got this back from x402.org:
      </p>
      <pre>
        <code>HTTP 500: No facilitator registered for scheme: exact and network: base</code>
      </pre>
      <p>
        This didn&apos;t come from the service we were checking. It came from x402.org — the
        facilitator we&apos;d been routing payment authorizations to by default.
      </p>
      <p>
        The problem: x402.org doesn&apos;t know about bankr.bot&apos;s services. bankr.bot runs
        their own facilitator at <code>https://api.bankr.bot/facilitator</code>. They specify it
        directly in their 402 response. We were routing to the wrong place and getting a 500 that
        looked like a service failure — but was actually a routing failure.
      </p>
      <p>Those are not the same thing. Not even close.</p>

      <h2>Facilitators are not universal</h2>
      <p>
        This is the finding we want every x402 builder to internalize:{' '}
        <strong>x402.org is not a registry for all x402 services.</strong>
      </p>
      <p>
        Each service can specify its own facilitator URL in their 402 response. It can appear at up
        to three different levels in the response body. If your implementation doesn&apos;t check
        all three — if it just defaults to x402.org — you&apos;ll fail for any service that runs
        its own facilitator, and you&apos;ll get a 500 that gives you no useful signal.
      </p>
      <p>
        We looked at six endpoints in our test run. Every single bankr.bot service (five of them)
        specifies <code>https://api.bankr.bot/facilitator</code> as their facilitator. Zero of them
        would have worked if we&apos;d kept routing to x402.org.
      </p>
      <p>
        The correct discovery order — check each of these in the 402 response, use the first valid
        HTTPS URL you find:
      </p>
      <ol>
        <li>
          <code>matchingOption.extra.facilitator</code>
        </li>
        <li>
          <code>matchingOption.facilitator</code> (top level of the accepted payment option)
        </li>
        <li>
          <code>paymentRequirements.facilitator</code> (root of the payment terms object)
        </li>
      </ol>
      <p>
        If nothing is found at any level, fall back to the default. But check all three first.
      </p>

      <h2>What payment readiness verification looks like when it works</h2>
      <p>
        After we fixed the facilitator discovery, here&apos;s what we got from a single run against
        our full service set:
      </p>
      <ul>
        <li>5 of 6 services: ready, authorization valid</li>
        <li>
          Facilitator: <code>https://api.bankr.bot/facilitator</code> (discovered from the 402
          response, not hardcoded)
        </li>
        <li>Authorization TTL: 60 seconds</li>
        <li>Average <code>/verify</code> latency: ~95 ms</li>
        <li>USDC spent: zero</li>
      </ul>
      <p>
        The one failure (Exa.ai) was unrelated to the facilitator — it uses a non-standard field
        name in its payment terms. A separate fix.
      </p>
      <p>
        95 milliseconds to know whether a payment would succeed. No money at risk. That&apos;s the
        whole point of this layer.
      </p>
      <p>
        There is also a replay risk question worth addressing directly: the signed EIP-3009
        authorization has a 60-second TTL. The <code>/verify</code> call goes to the same
        facilitator the service already trusts — so that facilitator holds the signed authorization
        during any real payment flow anyway. The exposure window is not meaningfully different from
        a real paid check.
      </p>

      <h2>What we&apos;ve added to the open spec</h2>
      <p>
        We&apos;ve updated the{' '}
        <a href="https://github.com/danbuildss/x402-reliability-spec">
          x402 Reliability Specification
        </a>{' '}
        (v0.2) with two additions — both built from running this against live services on Base
        mainnet, not from spec-writing in a vacuum.
      </p>
      <p>
        <strong>Facilitator Discovery</strong> — a formal definition of the three-level lookup
        algorithm any implementation should use. Includes the distinction between a facilitator
        routing error and a service failure, and why conflating them produces misleading monitoring
        results.
      </p>
      <p>
        <strong>Payment Readiness Verification</strong> — a defined middle tier with its own
        evidence record format, error codes (<code>FACILITATOR_NOT_REGISTERED</code>,{' '}
        <code>VERIFY_TIMEOUT</code>, <code>VERIFY_REJECTED</code>), and cadence guidance. If
        you&apos;re building x402 reliability tooling, this is the pattern.
      </p>
      <p>
        The spec also formalizes the three-tier model — lightweight checks, payment readiness, and
        full verification — as a recommended approach rather than leaving it implicit. Each tier has
        its own evidence record format and is designed to run independently.
      </p>

      <h2>If you are building on x402</h2>
      <p>
        Check your facilitator discovery. If your implementation assumes x402.org handles
        everything, test it against a service that runs its own facilitator. The 402 response is
        the authoritative source — always read it.
      </p>
      <p>
        The updated spec is open at{' '}
        <a href="https://github.com/danbuildss/x402-reliability-spec">
          github.com/danbuildss/x402-reliability-spec
        </a>
        . Issues and contributions welcome.
      </p>
      <p>
        <Link href="/signup">Monitor your x402 endpoint with CORTX →</Link>
      </p>
    </>
  );
}
