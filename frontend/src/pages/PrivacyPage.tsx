export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <a href="/" className="text-terminal-accent text-xs tracking-widest hover:underline">← BACK TO GEOTRADER</a>
          <h1 className="text-terminal-accent text-xl font-bold tracking-widest mt-4">PRIVACY POLICY</h1>
          <p className="text-terminal-dim text-xs mt-1">Last updated: March 2026 · © Kavi Godithi. All Rights Reserved.</p>
        </div>

        <Section title="1. Who We Are">
          GeoTrader is operated by Kavi Godithi. Contact: <a href="mailto:gourinathgodithi@gmail.com" className="text-terminal-accent hover:underline">gourinathgodithi@gmail.com</a>. This policy explains how we collect, use, and protect your personal data in accordance with the UK GDPR and the Data Protection Act 2018.
        </Section>

        <Section title="2. Data We Collect">
          When you register, we collect: your name, email address, and a securely hashed version of your password (we never store your password in plain text). When you use the Platform, we store: portfolio trades you manually log, email alert subscription preferences, and server access logs (IP address, timestamp) retained for up to 30 days for security purposes.
        </Section>

        <Section title="3. How We Use Your Data">
          We use your data to: (a) provide and operate your account; (b) send email alerts you have opted into; (c) comply with legal obligations; (d) protect the security of the Platform. We do not sell your data to third parties. We do not use your data for advertising.
        </Section>

        <Section title="4. Legal Basis for Processing">
          We process your data on the following legal bases: (a) <strong>Contract performance</strong> — to provide the service you registered for; (b) <strong>Legitimate interests</strong> — for security logging and fraud prevention; (c) <strong>Consent</strong> — for email alert subscriptions (you may withdraw consent at any time by unsubscribing).
        </Section>

        <Section title="5. Data Storage and Transfers">
          Your data is stored on servers hosted by Amazon Web Services (AWS) in the United States. AWS is certified under the UK-US Data Bridge, providing appropriate safeguards for international data transfers in accordance with UK GDPR Article 46. Data is retained for the duration of your account and deleted within 30 days of account deletion.
        </Section>

        <Section title="6. Third-Party Services">
          We use the following third-party processors: (a) <strong>AWS</strong> — server hosting and data storage; (b) <strong>Stripe</strong> — payment processing (where applicable; Stripe does not share card data with us); (c) <strong>Google Fonts</strong> — font delivery (subject to Google's privacy policy). We do not use Google Analytics or any advertising trackers.
        </Section>

        <Section title="7. Your Rights">
          Under UK GDPR, you have the right to: access your personal data; correct inaccurate data; erase your data ("right to be forgotten"); restrict processing; data portability; and object to processing. To exercise any of these rights, contact us at <a href="mailto:gourinathgodithi@gmail.com" className="text-terminal-accent hover:underline">gourinathgodithi@gmail.com</a> or use the "Delete Account" option in your account settings. We will respond within 30 days.
        </Section>

        <Section title="8. Security">
          We use industry-standard security measures including bcrypt password hashing, HTTPS/TLS encryption in transit, JWT-based authentication, and IP-based rate limiting on authentication endpoints. No system is completely secure; use a strong, unique password.
        </Section>

        <Section title="9. Cookies and Local Storage">
          The Platform stores your authentication token in browser localStorage to keep you logged in. This is strictly necessary for the Platform to function and does not require consent. We do not use advertising cookies or third-party tracking cookies.
        </Section>

        <Section title="10. Children">
          The Platform is not directed at persons under 18 years of age. We do not knowingly collect data from minors.
        </Section>

        <Section title="11. Changes to This Policy">
          We may update this policy periodically. Material changes will be communicated via email or a notice on the Platform. Continued use after changes constitutes acceptance.
        </Section>

        <Section title="12. Complaints">
          If you are unhappy with how we handle your data, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-terminal-accent hover:underline">ico.org.uk</a>.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-terminal-accent text-sm font-bold tracking-widest mb-2">{title}</h2>
      <p className="text-terminal-dim text-sm leading-relaxed">{children}</p>
    </div>
  );
}
