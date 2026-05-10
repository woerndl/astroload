import type { RedirectsCollectionConfig } from '@jhb.software/payload-pages-plugin'

import { contentAccess } from '../access/contentAccess'

export const Redirects: RedirectsCollectionConfig = {
  slug: 'redirects',
  access: contentAccess,
  redirects: {},
  // Source, destination, type, reason are added by the pages-plugin.
  fields: [],
}
