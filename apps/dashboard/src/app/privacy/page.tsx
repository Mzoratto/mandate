import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy — Mandate",
  description: "How the Mandate demonstration handles information.",
};

const links = [
  { id: "scope", label: "Scope" },
  { id: "information", label: "Information handled" },
  { id: "use", label: "How information is used" },
  { id: "services", label: "Service providers" },
  { id: "retention", label: "Retention" },
  { id: "security", label: "Security" },
  { id: "choices", label: "Your choices" },
  { id: "contact", label: "Contact" },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      currentPath="/privacy"
      summary="Mandate is a limited open-source demonstration. This notice describes the information its public and protected web surfaces actually handle."
      links={links}
    >
      <section id="scope">
        <h2>Scope</h2>
        <p>This notice applies to the hosted Mandate public demonstration, protected simulated Alexa+ client, operator dashboard, and control-plane requests used to evaluate the project.</p>
        <p>The simulated client is not Amazon-hosted, has no voice capture, and is not connected to Alexa+ account linking. Mandate does not sell personal information, serve advertising, or use analytics trackers.</p>
      </section>

      <section id="information">
        <h2>Information handled</h2>
        <h3>Public demonstration</h3>
        <p>The public guided simulation executes entirely in the browser and does not accept or persist user input.</p>
        <h3>Protected surfaces</h3>
        <p>The protected simulator may process a checkout-repair outcome and an existing Mandate work reference submitted by an authenticated evaluator. Preparing work stores the outcome, resolved authority envelope, identity reference, immutable digests, status, and audit events in the control plane. It stops at human review and performs no agent action.</p>
        <h3>Operational metadata</h3>
        <p>Hosting providers may process standard request metadata such as network address, user agent, timestamps, and routing information. Mandate application logs are designed to contain only bounded request identifiers, component names, HTTP status, and platform diagnostics—not outcomes, authorization headers, or credentials.</p>
        <p>Do not submit secrets, personal data, proprietary code, production identifiers, or sensitive instructions. Use only the supplied checkout demonstration scenario.</p>
      </section>

      <section id="use">
        <h2>How information is used</h2>
        <p>Information is used only to operate, secure, debug, and evaluate the demonstration; enforce authority boundaries; prevent replay; retrieve work status; maintain audit records; and verify whether configured completion criteria were independently satisfied.</p>
        <p>A credential authenticates a request. It never constitutes approval of a Mandate, action, amendment, deployment, or merge.</p>
      </section>

      <section id="services">
        <h2>Service providers</h2>
        <p>Mandate uses Amazon Web Services for compute, routing, container images, logs, and private evidence storage; Neon for hosted PostgreSQL persistence; and GitHub for public source code and issue tracking. Those providers process data under their own terms and privacy notices.</p>
        <p>No customer information is intentionally sent to an AI model by the hosted simulated client. The completed checkout proof used deterministic zero-model execution.</p>
      </section>

      <section id="retention">
        <h2>Retention</h2>
        <p>Control-plane proposals and audit records are retained for project operation and judging until manually removed. Private evidence objects are versioned and subject to a minimum 30-day S3 Object Lock governance period. CloudWatch application logs have a 14-day retention setting.</p>
        <p>Some records cannot be deleted immediately when integrity, replay resistance, security investigation, or an active immutable-retention period requires preservation.</p>
      </section>

      <section id="security">
        <h2>Security</h2>
        <p>Protected routes require a separate viewer credential, while control-plane credentials remain server-side and are stored only as hashes where applicable. Transport uses HTTPS; evidence storage is private, encrypted, versioned, and immutable for its configured retention period. Responses containing operational state use <code>no-store</code> caching.</p>
        <p>No system is perfectly secure. Mandate remains a hackathon reference implementation and is not offered as a production service for sensitive or regulated information.</p>
      </section>

      <section id="choices">
        <h2>Your choices</h2>
        <p>You may use the public non-executing demonstration without submitting information. Do not use the protected preparation form if you do not want a bounded proposal retained. You may request access, correction, or deletion where applicable, subject to identity verification and immutable-retention obligations.</p>
      </section>

      <section id="contact">
        <h2>Contact and changes</h2>
        <p>For privacy questions, open a project issue at <a href="https://github.com/Mzoratto/mandate/issues" target="_blank" rel="noreferrer">github.com/Mzoratto/mandate/issues</a>. Do not include secrets or personal information in a public issue; request a private contact path instead.</p>
        <p>Material changes to this notice will be published on this page with a revised effective date.</p>
      </section>
    </LegalPage>
  );
}
