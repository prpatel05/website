import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import InteractiveTerminal from "@/components/InteractiveTerminal";
import { CrtNoiseProvider } from "./CrtNoiseProvider";
import SiteTopBar from "./SiteTopBar";
import SiteFooter from "./SiteFooter";
import SectionJumpRail from "./SectionJumpRail";
import CrtNoise from "./CrtNoise";
import type { BreadcrumbSegment } from "./Breadcrumbs";

type PageShellProps = {
  children: ReactNode;
  /** When set, the breadcrumb top bar replaces the homepage Navbar. */
  breadcrumbs?: BreadcrumbSegment[];
  /** Homepage-only section jump rail under the nav. */
  jumpRail?: boolean;
  /** Homepage terminal palette; off on content pages. */
  terminal?: boolean;
};

/**
 * Shared outer chrome: top bar (nav or breadcrumbs), optional jump rail,
 * page content, and one compact footer (sitemap + quiet status meta). Keeps
 * breadcrumbs / footer / status out of every page file as copy-paste.
 *
 * Single top border and muted wash on the foot wrapper so mobile reads one
 * bottom chrome block.
 */
const PageShell = ({
  children,
  breadcrumbs,
  jumpRail = false,
  terminal = false,
}: PageShellProps) => (
  <CrtNoiseProvider>
    <div className="min-h-screen bg-background flex flex-col">
      {breadcrumbs ? <SiteTopBar segments={breadcrumbs} /> : <Navbar />}
      {jumpRail ? <SectionJumpRail /> : null}
      <div className="flex-1">{children}</div>
      {terminal ? <InteractiveTerminal /> : null}
      <div className="border-t border-border bg-muted/20 print:border-border">
        <SiteFooter />
      </div>
      <CrtNoise />
    </div>
  </CrtNoiseProvider>
);

export default PageShell;
