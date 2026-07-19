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
  jsonLd,
}: SEOProps) => {
  const imageAlt = ogImageAlt ?? title;
  const href = canonicalUrl(canonical);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={href} />

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
