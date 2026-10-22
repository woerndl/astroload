import type {
  Article,
  BreadcrumbList,
  ContactPoint,
  Event,
  ImageObject,
  JobPosting,
  LocalBusiness,
  OpeningHoursSpecification,
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

export interface LocalBusinessInput extends OrganizationInput {
  // For example 'Store' or 'ProfessionalService'.
  subtype?: Exclude<LocalBusiness, string>['@type']
  telephone?: string
  openingHours?: { dayOfWeek: string[]; opens: string; closes: string }[]
  geo?: { latitude: number; longitude: number }
  parentOrganization?: OrganizationInput
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

export interface JobPostingInput {
  title: string
  // May contain HTML markup.
  description: string
  datePosted: string
  validThrough?: string
  employmentType?: string
  hiringOrganization: { name: string; url?: string; logo?: string }
  jobLocation: AddressInput & { addressCountry: string }
}

export interface EventInput {
  name: string
  // ISO 8601 with a time zone offset.
  startDate: string
  endDate?: string
  description?: string
  url?: string
  image?: string
  location: { name: string; address: AddressInput }
}

const filled = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim() !== ''

const ISO_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?|24:00(?::00(?:\.0+)?)?)(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function isoWithOffset(value: string): boolean {
  const match = ISO_WITH_OFFSET.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1, 4).map(Number) as [number, number, number]
  // With a 1-based month, day 0 of the next month is the last day of this month.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth
}

const openingHoursRows = (input: LocalBusinessInput) =>
  (input.openingHours ?? []).filter(
    (h) => h.dayOfWeek.length > 0 && filled(h.opens) && filled(h.closes),
  )

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

export function localBusinessLd(input: LocalBusinessInput): LocalBusiness {
  const node = organizationFields(input, {
    '@type': 'Organization',
    name: input.name,
  }) as unknown as Leaf<LocalBusiness, 'LocalBusiness'>
  ;(node as { '@type': string })['@type'] = filled(input.subtype) ? input.subtype : 'LocalBusiness'
  if (filled(input.telephone)) node.telephone = input.telephone
  if (input.geo) node.geo = { '@type': 'GeoCoordinates', ...input.geo }
  if (input.parentOrganization) node.parentOrganization = organizationLd(input.parentOrganization)
  const hours = openingHoursRows(input)
  if (hours.length > 0) {
    node.openingHoursSpecification = hours.map(
      (h): OpeningHoursSpecification => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: h.dayOfWeek as Leaf<
          OpeningHoursSpecification,
          'OpeningHoursSpecification'
        >['dayOfWeek'],
        opens: h.opens,
        closes: h.closes,
      }),
    )
  }
  return node
}

// Google requires an address and recommends a telephone number and opening
// hours.
export function localBusinessWarnings(input: LocalBusinessInput): string[] {
  const missing: string[] = []
  if (!postalAddress(input.address)) missing.push('address')
  if (!filled(input.telephone)) missing.push('telephone')
  if (openingHoursRows(input).length === 0) missing.push('opening hours')
  return missing.map((field) => `LocalBusiness "${input.name}" has no ${field}`)
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

// The last item is the current page.
export function breadcrumbListLd(items: { name: string; url?: string }[]): BreadcrumbList {
  const missing = items.slice(0, -1).find((item) => !filled(item.url))
  if (missing)
    throw new Error(
      `Breadcrumb "${missing.name}" needs a url, because only the last item may leave it out`,
    )
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(filled(item.url) ? { item: item.url } : {}),
    })),
  }
}

export function jobPostingLd(input: JobPostingInput): JobPosting {
  const address = postalAddress(input.jobLocation)
  if (!address || !filled(input.jobLocation.addressCountry)) {
    throw new Error(`JobPosting "${input.title}" needs a job location with a country`)
  }
  const node: Leaf<JobPosting, 'JobPosting'> = {
    '@type': 'JobPosting',
    title: input.title,
    description: input.description,
    datePosted: input.datePosted,
    hiringOrganization: organizationLd(input.hiringOrganization),
    jobLocation: { '@type': 'Place', address },
  }
  if (filled(input.validThrough)) node.validThrough = input.validThrough
  if (filled(input.employmentType)) node.employmentType = input.employmentType
  return node
}

export function eventLd(input: EventInput): Event {
  for (const [key, value] of [
    ['startDate', input.startDate],
    ['endDate', input.endDate],
  ] as const) {
    if ((key === 'startDate' || filled(value)) && !isoWithOffset(value ?? '')) {
      throw new Error(
        `Event "${input.name}" ${key} needs a valid ISO 8601 date and time with a time zone offset: ${value}`,
      )
    }
  }
  const address = postalAddress(input.location.address)
  if (!address) throw new Error(`Event "${input.name}" needs a location address`)
  const node: Leaf<Event, 'Event'> = {
    '@type': 'Event',
    name: input.name,
    startDate: input.startDate,
    location: { '@type': 'Place', name: input.location.name, address },
  }
  if (filled(input.endDate)) node.endDate = input.endDate
  if (filled(input.description)) node.description = input.description
  if (filled(input.url)) node.url = input.url
  if (filled(input.image)) node.image = input.image
  return node
}
