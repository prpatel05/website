import "@testing-library/jest-dom";

// jsdom doesn't implement Element.scrollTo or Element.scrollIntoView
Element.prototype.scrollTo = Element.prototype.scrollTo || function () {};
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};

// jsdom@20 lacks requestSubmit — polyfill so userEvent's Enter-key implicit
// form submission dispatches a real submit event that React can catch.
HTMLFormElement.prototype.requestSubmit =
  HTMLFormElement.prototype.requestSubmit ||
  function (this: HTMLFormElement) {
    const event = new Event("submit", { bubbles: true, cancelable: true });
    if (this.dispatchEvent(event)) {
      this.submit();
    }
  };

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
