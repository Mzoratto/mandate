import type { ReactNode } from "react";

export interface LegalSectionLink {
  id: string;
  label: string;
}

export default function LegalPage({
  title,
  summary,
  links,
  currentPath,
  children,
}: {
  title: string;
  summary: string;
  links: LegalSectionLink[];
  currentPath: "/privacy" | "/terms";
  children: ReactNode;
}) {
  return (
    <div className="legal-shell">
      <header className="legal-header">
        <a className="legal-brand" href="/" aria-label="Mandate public demonstration">
          <span>M</span>
          <strong>MANDATE<small>OUTCOME-BOUND AUTHORITY</small></strong>
        </a>
        <nav aria-label="Legal and project pages">
          <a href="/">Product</a>
          <a href="/privacy" aria-current={currentPath === "/privacy" ? "page" : undefined}>Privacy</a>
          <a href="/terms" aria-current={currentPath === "/terms" ? "page" : undefined}>Terms</a>
          <a href="https://github.com/Mzoratto/mandate" target="_blank" rel="noreferrer">Source ↗</a>
        </nav>
      </header>

      <main className="legal-main">
        <section className="legal-intro" aria-labelledby="legal-title">
          <div className="legal-channel"><i /> PUBLIC POLICY RECORD</div>
          <h1 id="legal-title">{title}</h1>
          <p>{summary}</p>
          <div className="legal-effective">Effective <time dateTime="2026-09-15">September 15, 2026</time></div>
        </section>

        <div className="legal-layout">
          <aside className="legal-index">
            <span>ON THIS PAGE</span>
            <nav aria-label={`${title} sections`}>
              {links.map(({ id, label }, index) => <a key={id} href={`#${id}`}><small>{String(index + 1).padStart(2, "0")}</small>{label}</a>)}
            </nav>
          </aside>
          <article className="legal-document">{children}</article>
        </div>
      </main>

      <footer className="legal-footer">
        <span>MANDATE · APACHE-2.0</span>
        <nav aria-label="Policy links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
      </footer>
    </div>
  );
}
