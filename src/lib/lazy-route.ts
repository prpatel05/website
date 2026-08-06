import { createElement, type ComponentType } from "react";

type PreloadableComponent<P> = ComponentType<P> & {
  preload: () => Promise<void>;
};

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
 */
export function lazyRoute<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>
): PreloadableComponent<P> {
  let Loaded: ComponentType<P> | null = null;
  let failure: unknown = null;
  let pending: Promise<void> | null = null;

  const preload = () =>
    (pending ??= load().then(
      (module) => {
        Loaded = module.default;
      },
      (error) => {
        // Held rather than rethrown here: the throw has to happen from render,
        // where the app's ErrorBoundary can catch it. Letting the rejection
        // escape would leave Suspense retrying a promise that can only reject.
        failure = error;
      }
    ));

  const Route = (props: P) => {
    if (failure) throw failure;
    if (!Loaded) throw preload();
    return createElement(Loaded, props);
  };

  return Object.assign(Route, { preload });
}
