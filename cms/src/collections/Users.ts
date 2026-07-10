import type { CollectionConfig } from 'payload'

import { isAdmin as isAdminField } from '../access/field/isAdmin'
import { isAdmin } from '../access/isAdmin'
import { isSelfOrAdmin } from '../access/isSelfOrAdmin'
import { CollectionGroups } from '../shared'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'roles'],
    listSearchableFields: ['email', 'firstName', 'lastName'],
    group: CollectionGroups.System,
  },
  auth: true,
  access: {
    read: isSelfOrAdmin,
    update: isSelfOrAdmin,
    create: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      // First-user registration runs with overrideAccess, so the roles field
      // access never applies and the onboarding form's 'editor' default would
      // save, locking the instance out of every admin-only surface. Whoever
      // registers into an empty Users collection is the admin.
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          const { totalDocs } = await req.payload.count({ collection: 'users', req })
          if (totalDocs === 0) data.roles = ['admin']
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'firstName',
      type: 'text',
      required: true,
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      saveToJWT: true,
      defaultValue: ['editor'],
      access: {
        create: isAdminField,
        update: isAdminField,
      },
      options: [
        { label: 'Editor', value: 'editor' },
        { label: 'Admin', value: 'admin' },
      ],
    },
  ],
}
