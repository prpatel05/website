export interface BlogPost {
  slug: string;
  title: string;
  /**
   * The line rendered under the title. Written for the page, where the title
   * sits directly above it — so it is allowed to be a fragment.
   */
  subtitle: string;
  /**
   * Overrides `subtitle` on the surfaces that show a description with no title
   * next to it: meta/og/twitter, the JSON-LD, and the RSS feed. Set this when
   * the subtitle only reads correctly under its own headline. Optional — most
   * posts have a subtitle that stands alone.
   */
  description?: string;
  date: string;
  dateISO: string;
  readTime: string;
  tags: string[];
  image: string;
}
