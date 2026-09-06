import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import InteractiveTerminal from "@/components/InteractiveTerminal";
import { CrtNoiseProvider } from "./CrtNoiseProvider";
import SiteTopBar from "./SiteTopBar";
import SiteFooter from "./SiteFooter";
import StatusBar from "./StatusBar";
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
 * page content, sitemap footer, and status strip. Keeps breadcrumbs / footer /
 * status out of every page file as copy-paste.
 *
 */
const PageShell = ({
  children,
  breadcrumbs,
  jumpRail = false,
  terminal = false,
}: PageShellProps) => (
  <CrtNoiseProvider>
    <div className="min-h-screen bg-background">
      {breadcrumbs ? <SiteTopBar segments={breadcrumbs} /> : <Navbar />}
      {jumpRail ? <SectionJumpRail /> : null}
      {children}
      {terminal ? <InteractiveTerminal /> : null}
      <SiteFooter />
      <StatusBar />
      <CrtNoise />
    </div>
  </CrtNoiseProvider>
);

export default PageShell;
