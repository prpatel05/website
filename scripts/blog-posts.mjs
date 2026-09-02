import { existsSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BLOG_POSTS_DIR = join(
  __dirname,
  "..",
  "src",
  "data",
  "blog-posts"
);

const NON_POST_FILES = new Set(["index.ts", "registry.ts", "types.ts"]);

function getPropertyName(name) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }

  return null;
}

// Reads the string-valued fields off the exported post object, plus string
// arrays (`tags`). Bodies live in content/<slug>.md now — see
// `postBodyMarkdown` — so they are not read off the object. Fields listed in
// `optional` are returned when present and simply omitted when absent, rather
// than failing the build.
function findPostFields(filePath, fields, optional = []) {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const wanted = new Set([...fields, ...optional]);
  const found = {};

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (ts.isPropertyAssignment(property)) {
          const name = getPropertyName(property.name);

          if (!name || !wanted.has(name)) continue;

          if (ts.isStringLiteralLike(property.initializer)) {
            found[name] = property.initializer.text;
          } else if (ts.isArrayLiteralExpression(property.initializer)) {
            found[name] = property.initializer.elements
              .filter((element) => ts.isStringLiteralLike(element))
              .map((element) => element.text);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  for (const field of fields) {
    if (!found[field]) {
      throw new Error(`Could not find ${field} in ${filePath}`);
    }
  }

  return found;
}

// The app discovers posts with import.meta.glob, which only exists inside
// Vite's transform. Node scripts and the Playwright suite run outside it, so
// they share this scan instead of importing src/data/blog-posts/registry.
function postFilePaths() {
  const postFiles = readdirSync(BLOG_POSTS_DIR)
    .filter((name) => name.endsWith(".ts") && !NON_POST_FILES.has(name))
    .sort();

  if (postFiles.length === 0) {
    throw new Error(`Could not discover blog posts from ${BLOG_POSTS_DIR}`);
  }

  return postFiles.map((name) => join(BLOG_POSTS_DIR, name));
}

// Mirrors src/lib/post-description.ts for the Node scripts, which run outside
// Vite and cannot import the app's TypeScript.
export function postDescription(post) {
  return post.description?.trim() || post.subtitle;
}

export function discoverPostSlugs() {
  return postFilePaths().map(
    (filePath) => findPostFields(filePath, ["slug"]).slug
  );
}

// Newest first, matching src/data/blog-posts/registry.ts so the feed and the
// rendered archive agree on ordering.
export function discoverPosts() {
  return postFilePaths()
    .map((filePath) =>
      findPostFields(
        filePath,
        ["slug", "title", "subtitle", "dateISO", "image"],
        ["description", "tags"]
      )
    )
    .sort(
      (a, b) =>
        b.dateISO.localeCompare(a.dateISO) || a.slug.localeCompare(b.slug)
    );
}

// Bodies live beside the metadata as markdown. The feed reads them here so it
// can emit content:encoded without importing the Vite registry, and so a
// fixture without a .md file still publishes — it just has no encoded body.
export function postBodyMarkdown(slug) {
  const filePath = join(BLOG_POSTS_DIR, "content", `${slug}.md`);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}
