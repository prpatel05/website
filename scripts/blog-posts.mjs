import { readdirSync, readFileSync } from "fs";
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

const NON_POST_FILES = new Set(["index.ts", "types.ts"]);

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

function findPostSlug(filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let slug;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      const slugProperty = node.initializer.properties.find(
        (property) =>
          ts.isPropertyAssignment(property) &&
          getPropertyName(property.name) === "slug" &&
          ts.isStringLiteralLike(property.initializer)
      );

      if (slugProperty && ts.isPropertyAssignment(slugProperty)) {
        slug = slugProperty.initializer.text;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!slug) {
    throw new Error(`Could not find slug in ${filePath}`);
  }

  return slug;
}

// The app discovers posts with import.meta.glob, which only exists inside
// Vite's transform. Node scripts and the Playwright suite run outside it, so
// they share this scan instead of importing src/data/blog-posts.
export function discoverPostSlugs() {
  const postFiles = readdirSync(BLOG_POSTS_DIR)
    .filter((name) => name.endsWith(".ts") && !NON_POST_FILES.has(name))
    .sort();

  if (postFiles.length === 0) {
    throw new Error(`Could not discover blog posts from ${BLOG_POSTS_DIR}`);
  }

  return postFiles.map((name) => findPostSlug(join(BLOG_POSTS_DIR, name)));
}
