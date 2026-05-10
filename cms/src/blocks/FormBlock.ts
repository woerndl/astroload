import type { Block } from 'payload'

export const FormBlock: Block = {
  slug: 'form',
  interfaceName: 'FormBlock',
  fields: [
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      required: true,
    },
    {
      name: 'introContent',
      type: 'richText',
      localized: true,
    },
  ],
}
