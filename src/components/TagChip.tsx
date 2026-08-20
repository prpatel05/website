import { Link } from "react-router-dom";
import { ARCHIVE_HREF, archiveTagHref } from "@/lib/blog-tags";
import { cn } from "@/lib/utils";

export const tagChipClassName = (active: boolean) =>
  cn(
    "relative z-10 inline-flex items-center min-h-6 px-2 font-mono text-[10px] border transition-colors",
    active
      ? "bg-primary text-primary-foreground border-primary print:bg-transparent print:text-primary print:border-primary"
      : "text-primary/60 print:text-primary border-primary/20 print:border-primary hover:border-primary/60 hover:text-primary"
  );

type TagChipProps = {
  tag: string;
  active?: boolean;
  current?: boolean;
};

export const TagChip = ({ tag, active = false, current = false }: TagChipProps) => (
  <Link
    to={archiveTagHref(tag)}
    className={tagChipClassName(active)}
    aria-current={current ? "page" : undefined}
  >
    #{tag}
  </Link>
);

export const AllPostsChip = ({ active }: { active: boolean }) => (
  <Link
    to={ARCHIVE_HREF}
    className={tagChipClassName(active)}
    aria-current={active ? "page" : undefined}
  >
    all
  </Link>
);
