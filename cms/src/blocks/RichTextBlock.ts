import type { Block } from 'payload'

export const RichTextBlock: Block = {
  slug: 'richText',
  interfaceName: 'RichTextBlock',
  fields: [
    {
      name: 'text',
      type: 'richText',
      required: true,
      localized: true,
    },
  ],
}
