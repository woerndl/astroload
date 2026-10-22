import { getViteConfig } from 'astro/config'

// The Astro Vite plugins let tests render .astro components with the container
// API. configFile: false keeps astro.config.mjs and its CMS redirect fetch out
// of the tests.
export default getViteConfig({}, { configFile: false })
