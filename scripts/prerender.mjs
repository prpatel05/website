import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { isTelemetryRequest } from "./telemetry-blocklist.mjs";
import { discoverPostSlugs } from "./blog-posts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");

const ROUTES = [
  "/",
  "/blog",
  ...discoverPostSlugs().map((slug) => `/blog/${slug}`),
  // Matches the app's `path="*"` route. Written to dist/404.html, which is the
  // file GitHub Pages serves — with a real 404 status — for any URL that has no
  // page. It replaces the spa-github-pages redirect shim: that bounced every
  // unknown URL to /?/the/path, which is a soft 404 to a crawler and a homepage
  // flash to a reader.
  "/404",
];

// Simple static file server for the dist folder.
//
// `shell` is dist/index.html as the bundler left it — an empty `<div id="root">`
// — captured before the loop starts overwriting it, and served for every route
// that has no file of its own yet. It matters now that the app hydrates: the
// loop's first pass replaces dist/index.html with the rendered homepage, so a
// disk-backed SPA fallback would hand every later route the *homepage's* markup
// and ask React to hydrate a different page into it.
function startServer(shell) {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".webmanifest": "application/manifest+json",
    ".xml": "application/xml",
    ".txt": "text/plain",
  };

  const sendShell = (res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(shell);
  };

  const server = createServer((req, res) => {
    // "/" too, not just the fallback: the homepage is prerendered from the
    // shell like every other route, and by the second build pass the file on
    // disk is last build's output.
    if (req.url === "/") return sendShell(res);

    let filePath = join(DIST, req.url);

    if (!existsSync(filePath)) {
      // Check if it's a directory with index.html
      const indexPath = join(filePath, "index.html");
      if (existsSync(indexPath)) {
        filePath = indexPath;
      } else {
        // SPA fallback.
        return sendShell(res);
      }
    }

    const ext = "." + filePath.split(".").pop();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function prerender() {
  console.log("Prerendering pages with Playwright...");

  // Captured before the first write below turns it into the rendered homepage.
  const shell = readFileSync(join(DIST, "index.html"));
  if (!/<div id="root">\s*<\/div>/.test(shell.toString())) {
    throw new Error(
      "dist/index.html does not have an empty #root — the prerender would be " +
        "rendering on top of a previous pass instead of the bundler's shell, " +
        "and every page would hydrate against the wrong markup"
    );
  }

  const { server, port } = await startServer(shell);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // The app's analytics beacon injects a real <script src> tag, which this
  // browser would otherwise fetch and execute, reporting a pageview per route
  // per deploy into the live read-out. Keep the tag, drop the hit.
  let blockedTelemetry = 0;
  await context.route("**/*", (route) => {
    if (isTelemetryRequest(route.request().url())) {
      blockedTelemetry += 1;
      return route.abort();
    }
    return route.continue();
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    const url = `http://127.0.0.1:${port}${route}`;

    console.log(`  Rendering ${route}...`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for React to render meaningful content
    await page.waitForFunction(
      () => document.querySelector('#main-content')?.children.length > 0,
      { timeout: 10000 }
    ).catch(() => {
      // Fallback if the selector isn't found
      console.warn(`  Warning: hydration check timed out for ${route}, using fallback wait`);
    });

    // The post body and the post page itself are both async chunks now, so the
    // first paint can beat them. Settle the network again, then refuse to write
    // a post page whose article never arrived — an empty <article> would
    // otherwise ship as valid-looking HTML.
    await page.waitForLoadState("networkidle");

    if (route.startsWith("/blog/")) {
      const paragraphs = await page.locator("article p").count();
      if (paragraphs < 3) {
        throw new Error(
          `${route} rendered ${paragraphs} paragraph(s) — post body did not load`
        );
      }
    }

    // React gives every text child its own DOM node, but the HTML serializer
    // writes two adjacent text nodes as one run of characters and the browser
    // that re-parses this file gets a single node back. `<span>#{tag}</span>`
    // is two text fibers on the client and `#ai` in the file, so hydration
    // looks for "#", finds "#ai", and — a text mismatch is fatal in a
    // concurrent root — throws the whole prerendered page away and rebuilds it.
    //
    // `renderToString` never hits this because it emits a `<!-- -->` between
    // adjacent text. A DOM snapshot has to insert those itself. React's
    // hydration walk skips comment nodes, and nothing else on the page reads
    // them, so they are inert everywhere except where they are load-bearing.
    const hydratable = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
      );
      const boundaries = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.previousSibling?.nodeType === Node.TEXT_NODE) {
          boundaries.push(node);
        }
      }
      // Inserted after the walk rather than during it, so the walker is not
      // stepping over a tree it is also mutating.
      for (const node of boundaries) {
        node.parentNode.insertBefore(document.createComment(""), node);
      }

      // Same story one attribute over. React builds the `style` attribute it
      // expects as `name:value` joined with `;`; the CSSOM hands the serializer
      // `name: value; ` with the spaces in. Identical CSS, different string, so
      // every styled element reports a prop mismatch. Rewritten through the
      // CSSOM rather than by regex so a `url(a b)` or a quoted value cannot be
      // mangled on the way.
      let restyled = 0;
      for (const el of document.querySelectorAll("[style]")) {
        const parts = [];
        for (const name of el.style) {
          parts.push(`${name}:${el.style.getPropertyValue(name)}`);
        }
        const normalized = parts.join(";");
        if (normalized !== el.getAttribute("style")) {
          el.setAttribute("style", normalized);
          restyled += 1;
        }
      }

      return { separators: boundaries.length, restyled };
    });

    // Vite's runtime preload helper injects a <link rel="modulepreload"> the
    // moment LazyMotion asks for its feature chunk, and the snapshot below
    // would bake that link into all 27 pages — putting the chunk back on the
    // critical path that the dynamic import in src/App.tsx exists to keep it
    // off. Drop it from the captured head. The chunk still loads; it loads when
    // React asks for it rather than while the HTML is parsing.
    //
    // The route's own lazily imported chunk gets the same injected link and is
    // deliberately left alone — BlogPost is needed to hydrate the page it is
    // preloaded on, so there the artifact is doing useful work.
    const droppedPreloads = await page.evaluate(() => {
      const links = [
        ...document.querySelectorAll('link[rel="modulepreload"]'),
      ].filter((link) =>
        /\/assets\/motion-features-[^/]*\.js$/.test(new URL(link.href).pathname)
      );
      links.forEach((link) => link.remove());
      return links.length;
    });

    // Same reasoning as the visibility probes below: a strip that quietly stops
    // matching leaves the preload on every page and nothing goes red.
    if (droppedPreloads !== 1) {
      throw new Error(
        `${route}: expected exactly 1 injected modulepreload for the motion ` +
          `feature chunk, found ${droppedPreloads}. Either the chunk is no ` +
          `longer emitted as motion-features-*.js or LazyMotion stopped ` +
          `loading it lazily — either way this strip is doing nothing.`
      );
    }

    const html = await page.content();

    // Prerendered markup only helps if the browser can paint it. framer-motion
    // writes its `initial` state into the inline style, which used to ship the
    // route wrapper and the <h1> at opacity:0 — the HTML landed at ~0.8s and
    // the page did not appear until hydration finished at ~2s. src/hooks/
    // useEntrance skips the entrance on first load; this keeps a regression
    // from shipping silently.
    // Each probe must find its anchor. A regex that silently stops matching after
    // a refactor turns this guard green forever, which is worse than not having
    // it — so a missing anchor is an error, not a skipped check.
    const probes = [
      { name: "<main id=main-content>", pattern: /<main[^>]*id="main-content"[^>]*>/ },
      // The first element inside <main>: the route wrapper framer-motion writes
      // `initial` onto. Matched by position rather than by tag name, so moving
      // from <div> to <section> does not quietly disarm it.
      {
        name: "first child of <main>",
        pattern: /<main[^>]*id="main-content"[^>]*>\s*<[a-z]+[^>]*>/,
      },
      { name: "<h1>", pattern: /<h1[^>]*>/ },
    ];

    const missing = probes.filter((p) => !p.pattern.test(html));
    if (missing.length > 0) {
      throw new Error(
        `${route}: prerender visibility guard found no ${missing
          .map((p) => p.name)
          .join(", ")} — the probe is stale, not the page healthy`
      );
    }

    const hidden = probes
      .map((p) => html.match(p.pattern)?.[0])
      .filter((tag) => tag && /opacity:\s*0[;"]/.test(tag));

    if (hidden.length > 0) {
      throw new Error(
        `${route} prerendered invisible — ${hidden.join(" ")}`
      );
    }

    // Those three probes are anchors, not coverage: they see the route wrapper
    // and the <h1> and nothing else. The homepage shipped 31 hidden elements —
    // its entire body below the hero — with all three green, because each
    // section carries its own `initial` states and its own scroll-linked
    // opacity, none of which the probes pass over. Nothing in prerendered HTML
    // has a good reason to be transparent, so count every inline one rather
    // than trying to name the elements worth checking.
    const invisible = [
      ...html.matchAll(/<[a-z][^>]*style="[^"]*opacity:\s*0[;"][^>]*>/g),
    ].map((match) => match[0]);

    if (invisible.length > 0) {
      const sample = invisible.slice(0, 5).join("\n    ");
      throw new Error(
        `${route} prerendered ${invisible.length} element(s) at inline ` +
          `opacity:0 — invisible until React downloads and hydrates. Wrap the ` +
          `framer-motion \`initial\` in \`entrance()\` (src/hooks/useEntrance.ts), ` +
          `and check any scroll-linked opacity bound into \`style\`.\n    ${sample}` +
          (invisible.length > 5 ? `\n    ...and ${invisible.length - 5} more` : "")
      );
    }

    // Determine output path. /404 is the exception to the directory-per-route
    // rule: GitHub Pages only looks for a top-level 404.html.
    const outputFile =
      route === "/"
        ? join(DIST, "index.html")
        : route === "/404"
          ? join(DIST, "404.html")
          : join(DIST, route.replace(/^\//, ""), "index.html");

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, html, "utf-8");
    console.log(
      `  Wrote ${outputFile} (${hydratable.separators} text separator(s), ` +
        `${hydratable.restyled} style attribute(s) normalized)`
    );

    await page.close();
  }

  await browser.close();
  server.close();

  // GitHub Pages ignores dist/404/index.html and falls back to its own generic
  // page, so a wrong output path here would fail silently in production only.
  const notFound = join(DIST, "404.html");
  if (!existsSync(notFound) || !readFileSync(notFound, "utf-8").includes(">404<")) {
    throw new Error("dist/404.html is missing or is not the 404 page");
  }

  console.log(
    `Blocked ${blockedTelemetry} telemetry request(s) from the build.`
  );
  console.log("Prerendering complete!");
}

prerender().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
