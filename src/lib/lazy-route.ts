import { createElement, type ComponentType } from "react";
import { clearReloadMark, reloadOnce } from "./reload-once";

type PreloadableComponent<P> = ComponentType<P> & {
  preload: () => Promise<void>;
};

/**
 * One mark for every lazy route, not one per route.
 *
 * What fails here is never a single chunk in isolation: the tab is holding a
 * bundle whose content hashes a deploy has replaced, so every route chunk it
 * can still ask for is equally gone, and the one full load that fixes this
 * route fixes all of them. Marking per route would instead spend a reload on
 * each post the reader clicks. See `reload-once`.
 */
const RELOAD_MARK = "route-chunk-reload";

/**
 * A lazily-imported route that can be brought into memory *before* the tree
 * that renders it.
 *
 * `React.lazy` always suspends on its first render, even when the module is
 * already in the browser's registry: the factory hands back a promise, and a
 * promise settles a microtask later than the render that needed it. That is
 * fatal during hydration. Our prerendered HTML is a DOM snapshot taken from a
 * live browser, not `renderToString` output, so it carries none of the
 * `<!--$-->` markers React uses to recognise a boundary whose content the
 * server already sent. Without them a boundary that suspends while hydrating is
 * client-rendered instead: React deletes the prerendered article and rebuilds
 * it, which is the blank window this whole change exists to remove.
 *
 * Awaiting `preload()` before `hydrateRoot` makes that first render synchronous,
 * so nothing suspends. On a client-side navigation nothing has been preloaded
 * and this suspends exactly like `React.lazy` — correct there, because by then
 * there is no prerendered markup left to protect.
 *
 * The chunk failing to arrive is an ordinary case rather than an exotic one,
 * and it is handled here rather than left to the app's ErrorBoundary. `/blog/`
 * does not modulepreload the post route, so a reader holding the archive from
 * before a deploy asks for that chunk for the first time when they click a
 * post — and asks for a hash that no longer exists. What they got was a
 * full-screen "Something went wrong", on a URL whose own HTML carries the whole
 * post. See `reload-once`.
 */
export function lazyRoute<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>
): PreloadableComponent<P> {
  let Loaded: ComponentType<P> | null = null;
  let failure: unknown = null;
  let pending: Promise<void> | null = null;
  let recovering = false;

  const preload = () =>
    (pending ??= load().then(
      (module) => {
        Loaded = module.default;
        // A route chunk arrived, so this tab is not holding a stale bundle.
        // Releasing the mark here is what gives a reader who sits through a
        // second deploy the recovery a second time.
        clearReloadMark(RELOAD_MARK);
      },
      (error) => {
        // Held rather than rethrown here: the throw has to happen from render,
        // where the app's ErrorBoundary can catch it. Letting the rejection
        // escape would leave Suspense retrying a promise that can only reject.
        failure = error;
        // Recovered from the rejection handler rather than from render, because
        // a rejection happens once and a render happens as often as React
        // likes. `pending` makes this the only place the failure is observed.
        //
        // `"decline"` because the mark is the only stop there is: after the
        // reload this same import runs again from `src/main.tsx`, so a browser
        // that cannot record the mark would be reloading forever. The error
        // screen is the lesser outcome, and it has a button.
        recovering = reloadOnce(RELOAD_MARK, "decline");
      }
    ));

  const Route = (props: P) => {
    // The browser is already on its way to a full load of this same URL, which
    // serves this route prerendered. Render nothing rather than throw: the
    // ErrorBoundary's "Something went wrong" is the right screen for a page
    // that is not coming and the wrong one for a page that is about to arrive
    // on its own. When the mark is spent — the reload landed and the chunk is
    // still gone — `recovering` is false and the reader gets that screen, with
    // its refresh button, instead of a reload loop.
    if (recovering) return null;
    if (failure) throw failure;
    if (!Loaded) throw preload();
    return createElement(Loaded, props);
  };

  return Object.assign(Route, { preload });
}
