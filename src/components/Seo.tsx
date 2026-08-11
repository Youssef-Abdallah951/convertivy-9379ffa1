import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://convertivy.lovable.app";

type SeoProps = {
  title: string;
  description: string;
  /** Route path, e.g. "/tools/json-formatter" */
  path: string;
  /** Extra JSON-LD blocks */
  jsonLd?: Record<string, unknown>[];
  noindex?: boolean;
};

export function Seo({ title, description, path, jsonLd, noindex }: SeoProps) {
  const url = `${SITE_URL}${path === "/" ? "/" : path}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
      <link rel="canonical" href={url} />

      <meta property="og:site_name" content="Convertify" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {jsonLd?.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}

/** Convenience wrapper for public tool pages. */
export function ToolSeo({
  slug,
  name,
  description,
}: {
  slug: string;
  name: string;
  description: string;
}) {
  const path = `/tools/${slug}`;
  return (
    <Seo
      title={`${name} - Convertify`}
      description={description}
      path={path}
      jsonLd={[
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: `${name} - Convertify`,
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Any (web browser)",
          url: `${SITE_URL}${path}`,
          description,
          isPartOf: {
            "@type": "WebSite",
            name: "Convertify",
            url: `${SITE_URL}/`,
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Convertify", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
          ],
        },
      ]}
    />
  );
}
