import { Helmet } from "react-helmet-async";
import { canonicalUrl } from "@/lib/canonical-url";

interface SEOProps {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogImageAlt?: string;
  /**
   * Declared so the first scrape can pick the large-card layout without
   * refetching the image. Blog cards and the homepage card differ in height,
   * so these stay per-page rather than being hardcoded here.
   */
  ogImageWidth?: number;
  ogImageHeight?: number;
  ogType?: string;
  /**
   * Same-origin path of the image that paints as LCP. Preloading it from the
   * head lets the scanner start the fetch before the parser reaches the <img>.
   * Must be the identical URL the <img> requests — an absolute origin here
   * would resolve to a second, separate download off pratik.pa.tel.
   */
  preloadImage?: string;
  /**
   * The `srcset`/`sizes` the <img> resolves, when it has them. A preload that
   * names a single `href` against an <img> that picks from a srcset is two
   * downloads, not one: the scanner fetches the href and the img then picks
   * whatever its own candidate list says. These have to be passed through so
   * the preload runs the same selection.
   */
  preloadImageSrcSet?: string;
  preloadImageSizes?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SEO = ({
  title,
  description,
  canonical,
  ogImage,
  ogImageAlt,
  ogImageWidth,
  ogImageHeight,
  ogType = "website",
  preloadImage,
  preloadImageSrcSet,
  preloadImageSizes,
  jsonLd,
}: SEOProps) => {
  const imageAlt = ogImageAlt ?? title;
  const href = canonicalUrl(canonical);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={href} />
      {/*
        The srcset pair is spread rather than passed straight through:
        react-helmet-async writes every prop it is handed with setAttribute,
        which turns an `undefined` into `imagesrcset=""`. An empty candidate
        list matches nothing, so a hero with no variants — a remote one — would
        end up preloading nothing at all.
      */}
      {preloadImage && (
        <link
          rel="preload"
          as="image"
          href={preloadImage}
          {...(preloadImageSrcSet
            ? {
                imageSrcSet: preloadImageSrcSet,
                imageSizes: preloadImageSizes,
              }
            : {})}
          fetchPriority="high"
        />
      )}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={href} />
      <meta property="og:type" content={ogType} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogImage && <meta property="og:image:alt" content={imageAlt} />}
      {ogImage && ogImageWidth && (
        <meta property="og:image:width" content={String(ogImageWidth)} />
      )}
      {ogImage && ogImageHeight && (
        <meta property="og:image:height" content={String(ogImageHeight)} />
      )}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      {ogImage && <meta name="twitter:image:alt" content={imageAlt} />}
      <meta name="twitter:site" content="@prpatel05" />

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
