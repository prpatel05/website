import Breadcrumbs, { type BreadcrumbSegment } from "./Breadcrumbs";

type SiteTopBarProps = {
  segments: BreadcrumbSegment[];
};

/**
 * Fixed top bar for every non-home route. Breadcrumbs live here so blog /
 * series / post / 404 share one chrome instead of each page pasting `cd ~`.
 */
const SiteTopBar = ({ segments }: SiteTopBarProps) => (
  <nav
    aria-label="Main"
    className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border print:hidden"
  >
    <div className="container flex items-center h-16">
      <Breadcrumbs segments={segments} />
    </div>
  </nav>
);

export default SiteTopBar;
