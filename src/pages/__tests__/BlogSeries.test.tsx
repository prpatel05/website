import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("framer-motion", () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: Record<string, unknown>) => {
          const htmlProps: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (k === "className" || k === "style" || k === "href" || k === "to") {
              htmlProps[k] = v;
            }
          }
          const Tag = typeof prop === "string" ? prop : "div";
          return <Tag {...htmlProps}>{children}</Tag>;
        };
      },
    }
  );
  return {
    m: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="helmet">{children}</div>
  ),
  HelmetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { testPosts } = vi.hoisted(() => ({
  testPosts: [
    {
      slug: "outsider",
      title: "Hiring Post",
      subtitle: "Not in the series",
      date: "2026.08",
      dateISO: "2026-08-18",
      readTime: "5 min",
      tags: ["ai", "hiring"],
      image: "/images/outsider.png",
    },
    {
      slug: "series-c",
      title: "Series C",
      subtitle: "Third chapter",
      date: "2026.08",
      dateISO: "2026-08-11",
      readTime: "7 min",
      tags: ["agents", "reliability", "evals"],
      image: "/images/c.png",
    },
    {
      slug: "series-b",
      title: "Series B",
      subtitle: "Second chapter",
      date: "2026.07",
      dateISO: "2026-07-07",
      readTime: "6 min",
      tags: ["agents", "reliability"],
      image: "/images/b.png",
    },
    {
      slug: "permissions-only",
      title: "Permissions Only",
      subtitle: "Agents but no reliability tag",
      date: "2026.06",
      dateISO: "2026-06-23",
      readTime: "6 min",
      tags: ["ai", "agents", "security"],
      image: "/images/p.png",
    },
    {
      slug: "slate-two",
      title: "Slate Two",
      subtitle: "Second on the slate",
      date: "2026.10",
      dateISO: "2026-10-13",
      readTime: "6 min",
      tags: ["ai", "agents", "tools"],
      series: "ship-with-agents",
      image: "/images/s2.png",
    },
    {
      slug: "slate-one",
      title: "Slate One",
      subtitle: "First on the slate",
      date: "2026.09",
      dateISO: "2026-09-22",
      readTime: "7 min",
      tags: ["ai", "agents", "shipping"],
      series: "ship-with-agents",
      image: "/images/s1.png",
    },
    {
      slug: "series-a",
      title: "Series A",
      subtitle: "First chapter",
      date: "2026.06",
      dateISO: "2026-06-30",
      readTime: "6 min",
      tags: ["ai", "agents", "reliability"],
      image: "/images/a.png",
    },
  ],
}));

vi.mock("@/data/blog-posts/registry", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, posts: testPosts };
});

import BlogSeries from "../BlogSeries";
import {
  AGENTS_IN_PRODUCTION,
  SERIES_DESCRIPTION,
  SERIES_HREF,
  SERIES_NAME,
  SHIP_WITH_AGENTS,
} from "@/lib/blog-series";
import { SERIES_TITLE, seriesTitle } from "@/lib/route-title";
import { SITE_CARD } from "@/lib/social-cards";

function renderSeries() {
  return render(
    <MemoryRouter initialEntries={[SERIES_HREF]}>
      <BlogSeries />
    </MemoryRouter>
  );
}

function renderHub(id: "ship-with-agents" | "agents-in-production") {
  return render(
    <MemoryRouter initialEntries={[`/blog/series/${id}/`]}>
      <BlogSeries seriesId={id} />
    </MemoryRouter>
  );
}

function seriesJsonLd(container: HTMLElement) {
  const scripts = Array.from(container.querySelectorAll("script"));
  return scripts.flatMap((s) => {
    try {
      const value = JSON.parse(s.textContent ?? "");
      return Array.isArray(value) ? value : [value];
    } catch {
      return [];
    }
  });
}

describe("BlogSeries hub", () => {
  it("renders members oldest-first and skips non-members", () => {
    renderSeries();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(SERIES_NAME);
    expect(screen.getByText(SERIES_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText("3 posts · oldest first")).toBeInTheDocument();

    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(["Series A", "Series B", "Series C"]);

    const main = screen.getByRole("main");
    expect(within(main).queryByText("Hiring Post")).toBeNull();
    expect(within(main).queryByText("Permissions Only")).toBeNull();

    expect(screen.getByRole("link", { name: "Series A" })).toHaveAttribute(
      "href",
      "/blog/series-a/"
    );
    expect(screen.getByRole("link", { name: "Series B" })).toHaveAttribute(
      "href",
      "/blog/series-b/"
    );
    expect(screen.getByRole("link", { name: "Series C" })).toHaveAttribute(
      "href",
      "/blog/series-c/"
    );
    expect(screen.getByRole("link", { name: /back to \/blog\// })).toHaveAttribute(
      "href",
      "/blog/"
    );
  });

  it("ships title, canonical, OG, and CollectionPage JSON-LD with trailing slashes", () => {
    const { container } = renderSeries();
    const helmet = screen.getByTestId("helmet");

    expect(helmet.querySelector("title")?.textContent).toBe(SERIES_TITLE);
    expect(helmet.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      SERIES_DESCRIPTION
    );
    expect(helmet.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `https://pratik.pa.tel${SERIES_HREF}`
    );
    expect(helmet.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(
      `https://pratik.pa.tel${SERIES_HREF}`
    );
    expect(helmet.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      SITE_CARD.url
    );

    const nodes = seriesJsonLd(container);
    const collection = nodes.find((n) => n["@type"] === "CollectionPage");
    expect(collection?.url).toBe(`https://pratik.pa.tel${SERIES_HREF}`);
    expect(collection?.mainEntity?.["@type"]).toBe("ItemList");
    expect(collection?.mainEntity?.numberOfItems).toBe(3);
    expect(collection?.mainEntity?.itemListElement.map((el: { item: { headline: string } }) => el.item.headline)).toEqual([
      "Series A",
      "Series B",
      "Series C",
    ]);
    for (const el of collection?.mainEntity?.itemListElement ?? []) {
      expect(el.url.endsWith("/")).toBe(true);
      expect(el.item.url.endsWith("/")).toBe(true);
    }

    const crumbs = nodes.find((n) => n["@type"] === "BreadcrumbList");
    expect(crumbs?.itemListElement.map((el: { item: string }) => el.item)).toEqual([
      "https://pratik.pa.tel",
      "https://pratik.pa.tel/blog/",
      `https://pratik.pa.tel${SERIES_HREF}`,
    ]);
  });
});

describe("other series hubs", () => {
  it("Ship With Agents lists only its explicit members, oldest first", () => {
    const { container } = renderHub("ship-with-agents");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ship With Agents");
    expect(screen.getByText(SHIP_WITH_AGENTS.description)).toBeInTheDocument();
    expect(screen.getByText("2 posts · oldest first")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Slate One",
      "Slate Two",
    ]);

    const helmet = screen.getByTestId("helmet");
    expect(helmet.querySelector("title")?.textContent).toBe(seriesTitle(SHIP_WITH_AGENTS));
    expect(helmet.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://pratik.pa.tel/blog/series/ship-with-agents/"
    );
    const collection = seriesJsonLd(container).find((n) => n["@type"] === "CollectionPage");
    expect(collection?.name).toBe("Ship With Agents");
    expect(collection?.url).toBe("https://pratik.pa.tel/blog/series/ship-with-agents/");
    expect(collection?.mainEntity?.numberOfItems).toBe(2);
  });

  it("the reliability hub drops posts that set an explicit series", () => {
    renderSeries();
    expect(within(screen.getByRole("main")).queryByText("Slate One")).toBeNull();
  });

  it("an empty hub renders the 404 instead of a hollow list", () => {
    renderHub("agents-in-production");
    expect(screen.queryByText(AGENTS_IN_PRODUCTION.description)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(
      "Agents in Production"
    );
  });
});
