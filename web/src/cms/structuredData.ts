import type {
  Article,
  ContactPoint,
  ImageObject,
  Organization,
  Person,
  PostalAddress,
  ProfilePage,
} from 'schema-dts'

type Leaf<T, K extends string> = Extract<T, { '@type': K }>

export interface AddressInput {
  streetAddress?: string
  postalCode?: string
  addressLocality?: string
  addressRegion?: string
  addressCountry?: string
}

export interface OrganizationInput {
  name: string
  url?: string
  // Google requires at least 112 by 112 pixels.
  logo?: string
  sameAs?: string[]
  legalName?: string
  vatID?: string
  foundingDate?: string
  address?: AddressInput
  contactPoint?: { telephone?: string; email?: string; contactType?: string }
  subOrganization?: OrganizationInput[]
}

export interface PersonInput {
  name: string
  url?: string
  image?: string
  description?: string
  sameAs?: string[]
  jobTitle?: string
  worksFor?: { name: string; url?: string }
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
  authors: { name: string; url?: string }[]
  images?: (string | ImageObject)[]
  publisher?: Organization
}

const filled = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim() !== ''

function postalAddress(input: AddressInput | undefined): PostalAddress | undefined {
  if (!input) return undefined
  const address: Leaf<PostalAddress, 'PostalAddress'> = { '@type': 'PostalAddress' }
  for (const key of [
    'streetAddress',
    'postalCode',
    'addressLocality',
    'addressRegion',
    'addressCountry',
  ] as const) {
    const value = input[key]
    if (filled(value)) address[key] = value
  }
  return Object.keys(address).length > 1 ? address : undefined
}

function organizationFields(input: OrganizationInput, node: Leaf<Organization, 'Organization'>) {
  if (filled(input.url)) node.url = input.url
  if (filled(input.logo)) node.logo = input.logo
  const sameAs = (input.sameAs ?? []).filter(filled)
  if (sameAs.length > 0) node.sameAs = sameAs
  if (filled(input.legalName)) node.legalName = input.legalName
  if (filled(input.vatID)) node.vatID = input.vatID
  if (filled(input.foundingDate)) node.foundingDate = input.foundingDate
  const address = postalAddress(input.address)
  if (address) node.address = address
  const contact = input.contactPoint
  if (contact && (filled(contact.telephone) || filled(contact.email))) {
    const point: Leaf<ContactPoint, 'ContactPoint'> = { '@type': 'ContactPoint' }
    if (filled(contact.telephone)) point.telephone = contact.telephone
    if (filled(contact.email)) point.email = contact.email
    if (filled(contact.contactType)) point.contactType = contact.contactType
    node.contactPoint = point
  }
  const subs = input.subOrganization ?? []
  if (subs.length > 0) node.subOrganization = subs.map((sub) => organizationLd(sub))
  return node
}

export function organizationLd(input: OrganizationInput): Organization {
  return organizationFields(input, { '@type': 'Organization', name: input.name })
}

export function personLd(input: PersonInput): Person {
  const node: Leaf<Person, 'Person'> = { '@type': 'Person', name: input.name }
  if (filled(input.url)) node.url = input.url
  if (filled(input.image)) node.image = input.image
  if (filled(input.description)) node.description = input.description
  const sameAs = (input.sameAs ?? []).filter(filled)
  if (sameAs.length > 0) node.sameAs = sameAs
  if (filled(input.jobTitle)) node.jobTitle = input.jobTitle
  if (input.worksFor) node.worksFor = organizationLd(input.worksFor)
  return node
}

export function profilePageLd(input: { url: string; person: Person }): ProfilePage {
  return { '@type': 'ProfilePage', url: input.url, mainEntity: input.person }
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
    node.author = input.authors.map((author): Person => {
      const person: Leaf<Person, 'Person'> = { '@type': 'Person', name: author.name }
      if (filled(author.url)) person.url = author.url
      return person
    })
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
