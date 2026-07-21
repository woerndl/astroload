// The shared layout's content column is max-w-3xl (768px) with px-4 (1rem
// per side): 736px from the 768px breakpoint up, viewport minus the padding
// below it. Every image spanning the column uses this as its sizes value.
// Keep it in step with the class list on the <main> in Layout.astro.
export const CONTENT_COLUMN_SIZES = '(min-width: 768px) 736px, calc(100vw - 2rem)'
