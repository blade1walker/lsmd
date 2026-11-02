import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Nexus EMS",
  description: "Privacy Policy and Data Safety disclosures for the Nexus EMS application.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-gray-300">
      <div className="border-b border-[#1e1e28] pb-6 mb-8">
        <h1 className="text-3xl font-bold text-white font-[family-name:var(--font-oswald)] uppercase tracking-wider">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Effective Date: November 2, 2026 &bull; Last Updated: November 2, 2026
        </p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white uppercase tracking-wide">1. Overview</h2>
          <p>
            Nexus EMS (&quot;we&quot;, &quot;our&quot;, or &quot;the Application&quot;) is the official personnel and operations
            management system for Emergency Medical Services in the Nexus Universe roleplay community. This Privacy Policy
            governs the use of our web portal and Android application on mobile and tablet devices.
          </p>
        </section>

        <section className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white uppercase tracking-wide">2. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-white">Account &amp; Identity Data:</strong> When authenticating via Discord OAuth2, we
              collect your public Discord username, user ID, and avatar to verify authorization and permissions.
            </li>
            <li>
              <strong className="text-white">Roleplay Character Data:</strong> Character name, assigned EMS rank, call sign,
              state ID, department assignments, and roster status.
            </li>
            <li>
              <strong className="text-white">Operational &amp; Duty Telemetry:</strong> Shift clock-in/clock-out timestamps,
              unit status changes, and dispatch incident logs transmitted via FiveM server integration.
            </li>
            <li>
              <strong className="text-white">Device &amp; Diagnostic Data:</strong> Device model, OS version, and network
              connection status for crash analytics and responsive layout optimizations on mobile and tablet devices.
            </li>
          </ul>
        </section>

        <section className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white uppercase tracking-wide">3. How Information Is Used</h2>
          <p>We use collected data solely for the following internal purposes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Maintaining an active roster of certified medical personnel.</li>
            <li>Tracking duty hours and active patrol availability.</li>
            <li>Routing official EMS dispatch notifications and announcements.</li>
            <li>Enforcing administrative role-based access control (RBAC).</li>
          </ul>
          <p className="mt-2 text-xs text-gray-400">
            We never sell, rent, monetize, or share your data with commercial advertising third parties.
          </p>
        </section>

        <section className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white uppercase tracking-wide">4. Third-Party Integrations</h2>
          <p>
            The application interfaces with Discord for authentication and webhook announcements, and the Nexus Universe FiveM
            game server for real-time duty synchronization. Each service operates under its respective terms and privacy policies.
          </p>
        </section>

        <section className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white uppercase tracking-wide">5. Data Retention &amp; Deletion</h2>
          <p>
            Account and roster records remain active for as long as you participate in the EMS department. If you depart the
            department or wish to have your associated data purged, you may contact the High Command administration team or
            submit a request in the community Discord.
          </p>
        </section>

        <section className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white uppercase tracking-wide">6. Contact Information</h2>
          <p>
            For questions or concerns regarding this policy or your data, please contact the Nexus EMS Administration team
            through the official community Discord server.
          </p>
        </section>
      </div>
    </div>
  );
}
