import { getViteConfig } from 'astro/config'

// configFile: false keeps astro.config.mjs and its CMS redirect fetch out of
// the tests.
export default getViteConfig({}, { configFile: false })
