import { isValidElement } from "react";

// Heading text, flattened. Used for the fragment id so a heading becomes
// a stable slug rather than something derived from the React tree.
export const textOf = (node) => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf(node.props.children);
  return "";
};

// Stable, URL-safe fragment ids. Punctuation drops rather than becoming
// percent-encoding, so the href, the id and the TOC all share one string.
// The counter is per document render: two Why headings become why and
// why-1 rather than colliding and sending both TOC links to the first.
export const slugify = (text) => {
  const slug = String(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u0027\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
};

export const createSlugs = () => {
  const used = new Map();
  return {
    next(text) {
      const base = slugify(text);
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      return n === 0 ? base : `${base}-${n}`;
    },
  };
};
