// On a page prerendered through speculation rules, waits until the visitor opens it.
export const whenActive = () =>
  document.prerendering
    ? new Promise((resolve) =>
        document.addEventListener('prerenderingchange', () => resolve(), { once: true }),
      )
    : Promise.resolve()
