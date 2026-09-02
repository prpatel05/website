import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { posts } from "@/data/blog-posts/registry";
import { BLOG_TITLE, HOME_TITLE, postTitle } from "@/lib/route-title";
import { useRouteAnnouncement } from "../useRouteAnnouncement";

/**
 * The two properties that make the announcement worth having, pinned where the
 * assertion is exact.
 *
 * The e2e spec drives the real thing through a real click. What it cannot do is
 * see *every* value the region held: it samples, and the defect this guards
 * against — announcing the outgoing page — is a value that appears and is then
 * replaced. Here every render is observable, so "never held the wrong title" is
 * an assertion rather than a sampling argument.
 *
 * The Helmet in the harness is not decoration. It is the trap: it writes
 * `document.title` outside React's commit, so a hook that read the DOM would
 * pick up the previous page's title on exactly the render being checked below.
 */

const POST = posts[0];

/** Records the region's text on every render, not just the final one. */
const Announcer = ({ seen }: { seen: string[] }) => {
  const message = useRouteAnnouncement();
  seen.push(message);
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
};

const Page = ({ title, links }: { title: string; links: [string, string][] }) => (
  <>
    <Helmet>
      <title>{title}</title>
    </Helmet>
    {links.map(([to, label]) => (
      <Link key={to} to={to}>
        {label}
      </Link>
    ))}
  </>
);

const renderApp = (initial: string) => {
  const seen: string[] = [];
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Announcer seen={seen} />
        <Routes>
          <Route
            path="/"
            element={<Page title={HOME_TITLE} links={[["/blog/", "writing()"]]} />}
          />
          <Route
            path="/blog"
            element={
              <Page
                title={BLOG_TITLE}
                links={[
                  [`/blog/${POST.slug}/`, POST.title],
                  ["/", "cd ~"],
                ]}
              />
            }
          />
          <Route
            path="/blog/:slug"
            element={<Page title={postTitle(POST.title)} links={[["/blog/", "back"]]} />}
          />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
  return seen;
};

const region = () => screen.getByRole("status");

describe("useRouteAnnouncement", () => {
  /**
   * A fresh load is announced by the browser itself. Announcing again here
   * would double it — and the prerenderer snapshots the DOM of a loaded page,
   * so any text written on mount would be baked into all 25 route HTML files as
   * a title sitting in a live region before the reader has navigated anywhere.
   */
  it("says nothing on the first load", async () => {
    const seen = renderApp("/");
    expect(region()).toHaveTextContent("");
    expect(seen.every((message) => message === "")).toBe(true);
  });

  it("announces the incoming page after a client-side navigation", async () => {
    renderApp("/");
    await userEvent.click(screen.getByRole("link", { name: "writing()" }));
    expect(region()).toHaveTextContent(BLOG_TITLE);
  });

  /**
   * The defect being prevented. An announcement of the wrong page is worse than
   * none: the reader is told they are somewhere they are not, and has no way to
   * tell it is wrong. So the outgoing title must never appear — not as the
   * final value, and not for one render on the way there.
   */
  it("never holds the outgoing title, on any render", async () => {
    const seen = renderApp("/blog/");

    // The precondition that makes this test bite: the archive's title has to
    // actually be in the DOM before the click, which is the state a reader is
    // in by the time they follow a link. Without it `document.title` is still
    // "" and a hook reading the DOM would fail this for the wrong reason.
    await waitFor(() => expect(document.title).toBe(BLOG_TITLE));

    await userEvent.click(screen.getByRole("link", { name: POST.title }));

    // The wrong answer — the one `document.title` hands back at this instant,
    // because Helmet has not flushed the post's title yet.
    expect(seen).not.toContain(BLOG_TITLE);

    expect(region()).toHaveTextContent(postTitle(POST.title));
    // ...and the sequence really did move, so the assertion above is not
    // passing because nothing ever happened.
    expect(seen.at(-1)).toBe(postTitle(POST.title));
  });

  /** Back to a path already visited still changes the page, so it still counts. */
  it("re-announces a path the reader has already been to", async () => {
    renderApp("/blog/");
    await userEvent.click(screen.getByRole("link", { name: POST.title }));
    expect(region()).toHaveTextContent(postTitle(POST.title));

    await userEvent.click(screen.getByRole("link", { name: "back" }));
    expect(region()).toHaveTextContent(BLOG_TITLE);
  });
});
