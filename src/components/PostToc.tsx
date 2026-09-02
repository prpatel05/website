import type { TocEntry } from "@/lib/post-toc";

type PostTocProps = {
  entries: TocEntry[];
  activeId: string;
};

/**
 * Jump list of a post's H2s. One instance in the DOM: the page places it
 * under the hero on small screens and in a sticky rail from `xl` up. Empty
 * entries render nothing so a post without H2s does not ship a hollow
 * `// contents`.
 */
const PostToc = ({ entries, activeId }: PostTocProps) => {
  if (entries.length === 0) return null;

  return (
    <nav aria-label="Contents" className="font-mono text-xs print:hidden">
      <p className="mb-3 tracking-widest text-primary/60 print:text-primary">
        {"// contents"}
      </p>
      <ol className="space-y-1">
        {entries.map((entry) => {
          const current = entry.id === activeId;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                aria-current={current ? "location" : undefined}
                className={
                  "flex min-h-6 items-start gap-2 py-1 leading-snug transition-colors " +
                  (current
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <span aria-hidden="true" className="mt-0.5 shrink-0 text-primary">
                  {"▸"}
                </span>
                <span>{entry.text}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default PostToc;
