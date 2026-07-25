import type { ReactNode } from "react";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <header className="border-b border-border pb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
      </header>
      <div className="prose prose-slate max-w-none space-y-10 pt-10 dark:prose-invert prose-a:text-brand prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground">
        {children}
      </div>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="!mb-3 !mt-0 text-xl font-bold text-foreground">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
