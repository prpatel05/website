/**
 * The Person / WebSite graph the homepage emits, and the slim Person the blog
 * pages reuse as author/publisher.
 *
 * `sameAs` is the public-profile list, kept as a string array (not imported
 * from `socials.ts`) so a post page does not pull lucide-react into its chunk
 * for URLs. `person-jsonld.test.ts` fails if the two lists drift, which is how
 * Substack staying in the UI and falling out of JSON-LD is caught.
 */
export const PERSON_NAME = "Pratik Patel";
export const PERSON_URL = "https://pratik.pa.tel";

// The portrait, used for the Person JSON-LD where a headshot is what's wanted.
export const HEADSHOT_URL = "https://pratik.pa.tel/images/headshot.png";

export const personSameAs = [
  "https://www.linkedin.com/in/prpatel05/",
  "https://github.com/prpatel05",
  "https://medium.com/@prpatel05",
  "https://prpatel05.substack.com",
  "https://x.com/prpatel05",
  "https://dev.to/prpatel05",
];

export const personRef = {
  "@type": "Person" as const,
  name: PERSON_NAME,
  url: PERSON_URL,
  sameAs: personSameAs,
};

export const personJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: PERSON_NAME,
    url: PERSON_URL,
  },
  {
    "@context": "https://schema.org",
    "@type": "Person",
    name: PERSON_NAME,
    url: PERSON_URL,
    image: HEADSHOT_URL,
    jobTitle: "CTO & Chief Architect",
    description:
      "Technology executive and hands-on architect with 11+ years building and scaling engineering organizations. Three-time company builder with a successful acquisition.",
    worksFor: {
      "@type": "Organization",
      name: "Tarobase (poof.new)",
    },
    knowsAbout: [
      "Artificial Intelligence",
      "Cloud Computing",
      "Web3",
      "TypeScript",
      "React",
      "Node.js",
      "AWS",
      "Python",
      "Go",
      "Blockchain",
      "Engineering Leadership",
      "Startup Building",
    ],
    sameAs: personSameAs,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Washington",
      addressRegion: "DC",
      addressCountry: "US",
    },
  },
];
