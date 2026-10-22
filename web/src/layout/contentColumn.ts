// The shared layout's content column is 768px wide with 1rem padding per
// side: 736px from the 768px breakpoint up, viewport minus the padding below
// it. Every image spanning the column uses this as its sizes value. Keep it
// in step with --content-width, the .main rule in Layout.astro and the .page
// rule in styleguide.astro.
export const CONTENT_COLUMN_SIZES = '(min-width: 768px) 736px, calc(100vw - 2rem)'
