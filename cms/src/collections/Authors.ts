import type { CollectionConfig } from 'payload'

import { contentAccess } from '../access/contentAccess'
import {
  rememberDraftSave,
  triggerDeployAfterChange,
  triggerDeployAfterDelete,
} from '../hooks/triggerDeploy'
import { draftVersions } from '../shared'

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt', '_status'],
  },
  versions: draftVersions,
  hooks: {
    beforeOperation: [rememberDraftSave],
    afterChange: [triggerDeployAfterChange],
    afterDelete: [triggerDeployAfterDelete],
  },
  access: contentAccess,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
