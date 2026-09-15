import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms — Mandate",
  description: "Terms for using the hosted Mandate demonstration.",
};

const links = [
  { id: "purpose", label: "Purpose" },
  { id: "boundaries", label: "Demonstration boundaries" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "open-source", label: "Open-source code" },
  { id: "third-parties", label: "Third-party services" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "availability", label: "Availability" },
  { id: "contact", label: "Contact" },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      currentPath="/terms"
      summary="These terms govern the hosted Mandate hackathon demonstration. The public repository's Apache-2.0 license separately governs use of the source code."
      links={links}
    >
      <section id="purpose">
        <h2>Purpose</h2>
        <p>Mandate is an experimental open-source protocol and reference implementation for outcome-bound agent authority. The hosted site is provided free of charge for education, testing, and evaluation during the Amazon Developer Hackathon 2026.</p>
        <p>By using the hosted demonstration, you agree to these terms and the <a href="/privacy">privacy notice</a>. If you do not agree, use the public source code under its license instead of the hosted service.</p>
      </section>

      <section id="boundaries">
        <h2>Demonstration boundaries</h2>
        <p>The public guided walkthrough is illustrative and executes no tools. The protected simulated Alexa+ client is not Amazon-hosted, has no voice capture or account linking, and must not be represented as a deployed Alexa+ add-on.</p>
        <p>The protected preparation form creates only a bounded checkout-repair proposal in <code>AWAITING_APPROVAL</code>. It cannot approve, amend, execute, deploy, or merge work. The existing completed checkout record proves one deterministic governed mutation; it does not prove universal interception of autonomous agent actions or production readiness.</p>
      </section>

      <section id="acceptable-use">
        <h2>Acceptable use</h2>
        <p>You may inspect the public demonstration, review the source, retrieve the supplied work reference, and—when given a judging credential—prepare bounded checkout demonstration work.</p>
        <p>You must not attempt to bypass authentication, obtain credentials or private evidence, overload the service, probe unrelated infrastructure, submit unlawful or harmful material, impersonate another principal, or use the demonstration to authorize real production activity. Do not submit secrets, personal information, proprietary source code, or regulated data.</p>
      </section>

      <section id="open-source">
        <h2>Open-source code</h2>
        <p>The source code in the Mandate repository is licensed under Apache License 2.0. That license—not these hosted-service terms—governs copying, modification, and distribution of the code. Third-party assets and dependencies remain subject to their identified licenses and notices.</p>
      </section>

      <section id="third-parties">
        <h2>Third-party services and names</h2>
        <p>The hosted demonstration depends on services provided by Amazon Web Services, Neon, and GitHub. Your use may also be subject to their terms. Availability or behavior of those services is outside Mandate's control.</p>
        <p>Alexa+ is an Amazon service. Its name is used only to identify the intended hackathon track and simulated interaction boundary. The fallback client is not Amazon-hosted and does not imply sponsorship, certification, or endorsement.</p>
      </section>

      <section id="disclaimers">
        <h2>Disclaimers and responsibility</h2>
        <p>The hosted service and source are provided “as is” and “as available,” without warranties of accuracy, availability, fitness for a particular purpose, non-infringement, or security. Mandate may deny valid work or fail to identify a risk. You remain responsible for every real-world authorization and consequence.</p>
        <p>Do not rely on Mandate for legal, financial, medical, safety-critical, regulated, or production decisions. To the maximum extent permitted by applicable law, the project maintainer is not liable for indirect, incidental, special, consequential, or exemplary damages arising from use of the demonstration.</p>
      </section>

      <section id="availability">
        <h2>Availability and changes</h2>
        <p>The demonstration may be changed, suspended, rate-limited, or removed at any time. Access may be revoked for misuse. No service-level commitment or support obligation is provided.</p>
        <p>Material updates to these terms will be published here with a revised effective date. Continued use after an update constitutes acceptance of the revised terms.</p>
      </section>

      <section id="contact">
        <h2>Contact</h2>
        <p>For terms or project questions, open an issue at <a href="https://github.com/Mzoratto/mandate/issues" target="_blank" rel="noreferrer">github.com/Mzoratto/mandate/issues</a>. Do not place credentials, private evidence, or personal information in a public issue.</p>
      </section>
    </LegalPage>
  );
}
