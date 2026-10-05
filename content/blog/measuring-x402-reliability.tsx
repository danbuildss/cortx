import Link from 'next/link';

export const meta = {
  slug: 'measuring-x402-reliability',
  title: 'What 4,500+ x402 checks taught us about measuring reliability',
  date: '2026-10-06',
  excerpt:
    'We found bugs in our own monitor, adapted to x402 V2, corrected historical data, and changed what CORTX considers a failure.',
  readTime: '7 min read',
};

export default function Post() {
  return (
    <>
      <p>CORTX has now run more than 4,500 checks against x402 endpoints, including 351 paid calls.</p>
      <p>
        For paid checks, we don&apos;t just ping a server. We make a real x402 request and record
        what happens through payment terms, pricing, payment, settlement and delivery.
      </p>
      <p>
        The point is simple: if we&apos;re going to tell you an endpoint is reliable, the evidence
        behind that claim has to be reliable too.
      </p>
      <p>Last week, we audited our own evidence.</p>
      <p>We found problems.</p>
      <p>
        Some came from our code. Some came from x402 changing underneath us. And one thing we
        published in August was wrong.
      </p>
      <p>
        So we fixed the checker, repaired the historical data and updated the reliability spec.
      </p>
      <p>Here&apos;s what we learned.</p>

      <h2>1. Our monitor blamed builders for our own problems</h2>
      <p>
        To check a paid service, CORTX pays it from a small test wallet. When that wallet ran out
        of USDC, the payment step failed, and our monitor recorded that as <strong>the
        service</strong> failing. Two failures in a row opened an incident and alerted the builder.
        Their public status page and badge showed a broken service, when the only thing broken was
        our wallet.
      </p>
      <p>
        <strong>What we changed:</strong> a check can now fail in two different ways. If the problem
        is on our side &mdash; empty wallet, spent budget, a payment method we can&apos;t make, our
        own crash &mdash; the check is marked as a CORTX-side error. It never counts toward a
        service&apos;s uptime, never opens an incident and never alerts the builder.
      </p>
      <p>
        Going back through the history, we found <strong>8 checks</strong> that had blamed a
        service for our wallet and <strong>1 incident</strong> that should never have opened. Both
        are corrected, and the incident is closed as a false positive.
      </p>

      <h2>2. A labelling bug made our numbers look better than they were</h2>
      <p>
        On August 15 we shipped a change that quietly saved every paid check&apos;s results one step
        out of place. One step in our pipeline was counted twice, so each later result was stored
        under the name of the step before it.
      </p>
      <p>
        The effect was quiet but real. What we published as &ldquo;paid delivery %&rdquo; was really
        measuring &ldquo;the price was fine and we signed the payment&rdquo;, and &ldquo;schema
        validity %&rdquo; was really measuring &ldquo;the response was valid JSON&rdquo;. Both looked
        better than the truth.
      </p>
      <p>
        <strong>What we changed:</strong> the pipeline now refuses to run if it ever has more steps
        than names, and a test runs our real checker against a fake x402 service and checks every
        step name &mdash; it fails on the old code. Then we repaired the history:{' '}
        <strong>389 paid checks</strong> now carry the right step names. Some historical percentages
        went down. The new numbers are the true ones.
      </p>
      <p>
        If you&apos;re looking at reliability numbers from anyone, including us, ask how they&apos;re
        produced.
      </p>

      <h2>3. x402 V2 moved the payment terms</h2>
      <p>
        In x402 V1, a service that wants payment answers HTTP 402 with its payment terms in the
        response body, and the client pays with an <code>X-PAYMENT</code> header. In V2, the terms
        move into a <code>PAYMENT-REQUIRED</code> header as base64-encoded JSON, the client pays with
        a <code>PAYMENT-SIGNATURE</code> header, the price field is called <code>amount</code>{' '}
        instead of <code>maxAmountRequired</code> (both in the token&apos;s smallest unit), and
        networks are named in CAIP-2 format &mdash; <code>eip155:8453</code> for Base rather than{' '}
        <code>base</code>.
      </p>
      <p>
        Our checker was reading the V2 header as plain JSON, so every service that published its
        terms only in that header failed at the payment-terms step. It looked like a broken service.
        It was a checker that didn&apos;t speak the new version.
      </p>
      <p>
        <strong>What we changed:</strong> CORTX now reads both versions and pays V2 services the V2
        way. The Bankr services we monitor are paid with V2 payments ($0.001 each) and pass end to
        end.
      </p>
      <p>
        If you build a checker, an agent or a wallet integration, test it against a V2 service, not
        only V1.
      </p>

      <h2>4. &ldquo;Payment confirmed&rdquo; has to mean the money moved</h2>
      <p>
        Our payment step used to say &ldquo;confirmed&rdquo; as soon as we had <em>signed</em> the
        payment. A signature proves nothing about what happened on-chain.
      </p>
      <p>
        <strong>What we changed:</strong> after a paid call, CORTX reads the service&apos;s settlement
        receipt &mdash; <code>PAYMENT-RESPONSE</code> in V2, <code>X-PAYMENT-RESPONSE</code> in V1
        &mdash; and records one of three things:
      </p>
      <ul>
        <li>
          <strong>confirmed</strong> &mdash; the receipt says the payment settled and names the
          transaction
        </li>
        <li>
          <strong>failed</strong> &mdash; the receipt says it didn&apos;t settle
        </li>
        <li>
          <strong>unconfirmed</strong> &mdash; the service sent no readable receipt
        </li>
      </ul>
      <p>
        The transaction hash comes only from that receipt. We never guess it, and when it&apos;s
        there you get a Basescan link.
      </p>
      <p>
        We read the receipt even when delivery fails. In x402&apos;s default flow a service settles
        only after it has done the work, but the protocol also allows settling first, and not every
        service gets the order right. The receipt is what lets us show the case that matters most to
        anyone paying for an API: <strong>the money moved, and nothing came back.</strong>
      </p>

      <h2>5. A correction to our August post on facilitators</h2>
      <p>
        On August 29 we wrote that{' '}
        <Link href="/blog/x402-facilitators-arent-universal">x402 facilitators aren&apos;t universal</Link>.
        That part stands: a service chooses its own facilitator, and x402.org doesn&apos;t know
        about every service. Two things in that post are now wrong.
      </p>
      <p>
        <strong>We said to fall back to <code>x402.org</code> when a service doesn&apos;t publish
        its facilitator.</strong> Don&apos;t. In x402 the facilitator is the server&apos;s business;
        guessing one makes a healthy service look &ldquo;not ready&rdquo;. If a service doesn&apos;t
        publish it, the honest answer is &ldquo;we can&apos;t check this&rdquo;, not &ldquo;this is
        broken&rdquo;.
      </p>
      <p>
        <strong>We showed payment readiness working for 5 of 6 services.</strong> Since then,
        Bankr&apos;s facilitator has started requiring authentication (<code>401 missing bearer
        token</code>). We can&apos;t run that check against those services any more, so CORTX now
        reports it as <em>unavailable</em> &mdash; not as a failure &mdash; and relies on the real
        paid check instead.
      </p>
      <p>The August post now carries a note pointing here.</p>

      <h2>6. We put all of this in the open standard</h2>
      <p>
        The{' '}
        <a href="https://github.com/danbuildss/x402-reliability-spec">x402 Reliability Spec</a> is
        our open, Apache-2.0 description of how to check an x402 service. Version 0.3 covers
        everything above: both protocol versions, a separate category for checker-side errors that
        must never count against a service, settlement receipts as the only source of a transaction
        hash, and no default facilitator.
      </p>
      <p>
        It also ships <strong>8 test cases</strong>: fake x402 services, each with the exact result
        a correct checker must produce &mdash; a V2 service with its terms only in a header, a
        service that takes the payment and then fails, a checker whose own wallet is empty, and
        more.
      </p>
      <p>
        CORTX runs all 8 through its real checker in its test suite, and passes all 8. Its public
        reliability API now returns each service&apos;s latest paid check in the spec&apos;s format.
        And CORTX itself is open source, under the MIT licence.
      </p>
      <p>
        You don&apos;t have to take our word for any of this. You can run the same tests against our
        code &mdash; or against yours.
      </p>

      <h2>The monitor has to meet the same standard</h2>
      <p>
        Reliability monitoring only works if the monitor is held to the same standard as the
        services it monitors.
      </p>
      <p>That&apos;s the biggest thing we learned from these changes.</p>
      <p>
        A failed check doesn&apos;t automatically mean a failed service. A signed payment
        doesn&apos;t mean money moved. A 200 doesn&apos;t mean the buyer got what they paid for. And
        a metric isn&apos;t useful if you can&apos;t explain exactly how it was produced.
      </p>
      <p>That&apos;s what we&apos;re trying to make CORTX better at measuring.</p>

      <hr />
      <p>
        <Link href="/report">Check your own endpoint for free →</Link> The free checks run on any public
        x402 URL, and the paid part runs for services up to $0.01.
      </p>
      <p>
        <a href="https://github.com/danbuildss/x402-reliability-spec">Read the spec →</a>
      </p>
      <p>
        <Link href="/signup">Monitor a service with CORTX →</Link>
      </p>
    </>
  );
}
