import type { Article, ImageObject, Organization, Person } from 'schema-dts'

type Leaf<T, K extends string> = Extract<T, { '@type': K }>

export interface OrganizationInput {
  name: string
  url?: string
  // Google requires at least 112 by 112 pixels.
  logo?: string
}

export interface ArticleInput {
  type?: 'Article' | 'NewsArticle'
  headline: string
  url: string
  description?: string
  inLanguage?: string
  // ISO 8601 with a time zone offset, as Payload stores dates.
  datePublished?: string
  dateModified?: string
  authors: { name: string }[]
  images?: (string | ImageObject)[]
  publisher?: Organization
}

const filled = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim() !== ''

export function organizationLd(input: OrganizationInput): Organization {
  const node: Leaf<Organization, 'Organization'> = { '@type': 'Organization', name: input.name }
  if (filled(input.url)) node.url = input.url
  if (filled(input.logo)) node.logo = input.logo
  return node
}

export function articleLd(input: ArticleInput): Article {
  const node = {
    '@type': input.type ?? 'Article',
    headline: input.headline,
    url: input.url,
    mainEntityOfPage: input.url,
  } as Leaf<Article, 'Article'>
  if (filled(input.description)) node.description = input.description
  if (filled(input.inLanguage)) node.inLanguage = input.inLanguage
  if (filled(input.datePublished)) node.datePublished = input.datePublished
  if (filled(input.dateModified)) node.dateModified = input.dateModified
  if (input.authors.length > 0) {
    node.author = input.authors.map((author): Person => ({ '@type': 'Person', name: author.name }))
  }
  if (input.images && input.images.length > 0) node.image = input.images
  if (input.publisher) node.publisher = input.publisher
  return node
}

// The text of a JSON-LD script element. Only "<" is escaped, so an HTML description keeps its
// tags after JSON parsing, and a "</script>" inside a string does not end the element.
// https://www.w3.org/TR/json-ld11/#restrictions-for-contents-of-json-ld-script-elements
export const jsonLdText = (node: object): string =>
  JSON.stringify({ '@context': 'https://schema.org', ...node }).replace(/</g, '\\u003c')
