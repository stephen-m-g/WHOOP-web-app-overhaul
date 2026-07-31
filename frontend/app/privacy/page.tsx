export const metadata = {
  title: "Privacy Policy — WHOOP+ Jump Training",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mb-10 text-sm text-muted-foreground">Last updated: July 30, 2026</p>

      <div className="space-y-8 text-sm leading-relaxed text-foreground [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_p]:text-muted-foreground [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-muted-foreground">
        <section>
          <p className="text-muted-foreground">
            WHOOP+ Jump Training (&quot;the app&quot;) is a personal training tool that connects
            to your WHOOP account and analyzes jump videos using on-device AI processing. This
            page explains what data the app touches, how it&apos;s used, and what happens to it.
          </p>
        </section>

        <section>
          <h2>WHOOP account data</h2>
          <p>
            If you choose to connect your WHOOP account, the app requests read-only access to
            your recovery, sleep, workout, profile, and body measurement data via WHOOP&apos;s
            official OAuth 2.0 API. This data is used solely to display your metrics on the
            dashboard within the app.
          </p>
          <ul>
            <li>
              Your WHOOP access and refresh tokens are stored in an httpOnly browser cookie tied
              to your session — not in a database, and not accessible to any client-side script.
            </li>
            <li>
              WHOOP metrics (recovery score, sleep performance, strain, etc.) are fetched fresh on
              each dashboard visit and are not persisted anywhere by this app.
            </li>
            <li>
              Disconnecting your account (via the logout action) clears these cookies
              immediately. WHOOP&apos;s own handling of your data is governed by{" "}
              <a
                href="https://www.whoop.com/us/en/privacy-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                WHOOP&apos;s privacy policy
              </a>
              , separate from this app.
            </li>
          </ul>
        </section>

        <section>
          <h2>Jump training videos</h2>
          <p>
            The jump trainer lets you upload a short video of a vertical or broad jump. That
            video is sent to our backend, where an AI pose-estimation pipeline
            (Google&apos;s MediaPipe) analyzes body landmark positions frame-by-frame to compute
            jump height, distance, and coaching feedback. Your entered height is used only as a
            calibration reference for that calculation.
          </p>
          <ul>
            <li>
              Uploaded videos are processed in a temporary, request-scoped location and deleted
              immediately after analysis completes — they are not stored, archived, or used for
              any purpose beyond generating your results.
            </li>
            <li>No video content or extracted frames are sent to any third party.</li>
            <li>
              Analysis results (jump height, keyframes, feedback) are returned directly to your
              browser and are not saved server-side.
            </li>
          </ul>
        </section>

        <section>
          <h2>Planned future storage</h2>
          <p>
            Today, this app does not maintain a database — nothing described above is persisted
            beyond the lifetime of a single request or browser session. As the app matures, we
            intend to add optional persistent storage (a managed database such as PostgreSQL,
            paired with our FastAPI backend running on Google Cloud Run) so users can track jump
            progress over time. If and when that launches, this policy will be updated in advance
            to describe exactly what&apos;s stored, for how long, and how to delete it.
          </p>
        </section>

        <section>
          <h2>Cookies &amp; tracking</h2>
          <p>
            The app uses httpOnly session cookies solely to maintain your WHOOP login state and a
            short-lived CSRF token during the OAuth handshake. It does not use analytics,
            advertising, or cross-site tracking cookies.
          </p>
        </section>

        <section>
          <h2>Data sharing</h2>
          <p>
            We do not sell, rent, or share your data with third parties. The only external
            service this app communicates with is the WHOOP API, used exclusively to fetch the
            metrics you&apos;ve authorized.
          </p>
        </section>

        <section>
          <h2>Your controls</h2>
          <ul>
            <li>Disconnect your WHOOP account at any time from within the app.</li>
            <li>Simply don&apos;t upload a video if you&apos;d rather not use the jump trainer.</li>
            <li>
              Since no account data is persisted server-side, there is currently nothing to
              request deletion of beyond your own browser&apos;s cookies.
            </li>
          </ul>
        </section>

        <section>
          <h2>Children&apos;s privacy</h2>
          <p>This app is not directed at, and should not be used by, anyone under the age of 16.</p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            This is an independently developed personal project, not an official WHOOP product.
            Questions about this policy can be sent to{" "}
            <a href="mailto:gatejstephen@gmail.com" className="underline underline-offset-2">
              gatejstephen@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
