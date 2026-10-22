import { describe, expect, it } from 'vitest'

import {
  articleLd,
  breadcrumbListLd,
  eventLd,
  jobPostingLd,
  localBusinessLd,
  localBusinessWarnings,
  organizationLd,
  personLd,
  profilePageLd,
  type LocalBusinessInput,
} from './structuredData'

const address = {
  streetAddress: 'Example Street 1',
  postalCode: '1010',
  addressLocality: 'Example City',
  addressCountry: 'AT',
}

describe('organizationLd', () => {
  it('emits only properties with a value', () => {
    expect(organizationLd({ name: 'Example', url: 'https://example.com', legalName: ' ' })).toEqual(
      {
        '@type': 'Organization',
        name: 'Example',
        url: 'https://example.com',
      },
    )
  })

  it('emits every optional property that has a value', () => {
    const node = organizationLd({
      name: 'Example',
      url: 'https://example.com',
      logo: 'https://example.com/logo.png',
      sameAs: ['https://social.example.com/example', ''],
      legalName: 'Example Ltd',
      vatID: 'ATU00000000',
      foundingDate: '2020-01-01',
      address,
      contactPoint: { telephone: '+43 1 000000', contactType: 'customer service' },
      subOrganization: [{ name: 'Example Branch', url: 'https://example.com/branch' }],
    })
    expect(node).toMatchObject({
      logo: 'https://example.com/logo.png',
      sameAs: ['https://social.example.com/example'],
      legalName: 'Example Ltd',
      vatID: 'ATU00000000',
      foundingDate: '2020-01-01',
      address: { '@type': 'PostalAddress', ...address },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+43 1 000000',
        contactType: 'customer service',
      },
      subOrganization: [{ '@type': 'Organization', name: 'Example Branch' }],
    })
  })

  it('leaves out an empty address and a contact point without telephone or email', () => {
    const node = organizationLd({
      name: 'Example',
      address: {},
      contactPoint: { contactType: 'sales' },
    })
    expect(node).not.toHaveProperty('address')
    expect(node).not.toHaveProperty('contactPoint')
  })
})

describe('localBusinessLd', () => {
  const complete: LocalBusinessInput = {
    name: 'Example Shop',
    url: 'https://example.com',
    subtype: 'Store',
    telephone: '+43 1 000000',
    address,
    openingHours: [{ dayOfWeek: ['Monday', 'Tuesday'], opens: '09:00', closes: '17:00' }],
  }

  it('uses the subtype and emits opening hours', () => {
    expect(localBusinessLd(complete)).toMatchObject({
      '@type': 'Store',
      telephone: '+43 1 000000',
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday'],
          opens: '09:00',
          closes: '17:00',
        },
      ],
    })
  })

  it('passes geo coordinates and the parent organization through', () => {
    expect(
      localBusinessLd({
        ...complete,
        geo: { latitude: 48.2082, longitude: 16.3738 },
        parentOrganization: { name: 'Example Group', url: 'https://example.com/group' },
      }),
    ).toMatchObject({
      geo: { '@type': 'GeoCoordinates', latitude: 48.2082, longitude: 16.3738 },
      parentOrganization: {
        '@type': 'Organization',
        name: 'Example Group',
        url: 'https://example.com/group',
      },
    })
  })

  it('falls back to LocalBusiness without a subtype', () => {
    expect(localBusinessLd({ name: 'Example' })['@type' as never]).toBe('LocalBusiness')
  })

  it('types subtype so that astro check rejects a type that is not a LocalBusiness', () => {
    // @ts-expect-error Article is not a LocalBusiness subtype.
    localBusinessLd({ name: 'Example', subtype: 'Article' })
  })

  it('warns about opening hours rows that the builder drops', () => {
    const partial = {
      ...complete,
      openingHours: [{ dayOfWeek: ['Monday'], opens: '', closes: '' }],
    }
    expect(localBusinessLd(partial)).not.toHaveProperty('openingHoursSpecification')
    expect(localBusinessWarnings(partial)).toEqual([
      'LocalBusiness "Example Shop" has no opening hours',
    ])
  })

  it('warns about a missing address, telephone and opening hours', () => {
    expect(localBusinessWarnings(complete)).toEqual([])
    expect(localBusinessWarnings({ name: 'Example' })).toEqual([
      'LocalBusiness "Example" has no address',
      'LocalBusiness "Example" has no telephone',
      'LocalBusiness "Example" has no opening hours',
    ])
  })
})

describe('personLd and profilePageLd', () => {
  it('wraps a person as the main entity of a profile page', () => {
    const person = personLd({
      name: 'Alex Example',
      url: 'https://example.com/authors/alex',
      image: 'https://example.com/alex.webp',
      jobTitle: 'Editor',
      sameAs: ['https://social.example.com/alex'],
      worksFor: { name: 'Example', url: 'https://example.com' },
    })
    expect(profilePageLd({ url: 'https://example.com/authors/alex', person })).toEqual({
      '@type': 'ProfilePage',
      url: 'https://example.com/authors/alex',
      mainEntity: {
        '@type': 'Person',
        name: 'Alex Example',
        url: 'https://example.com/authors/alex',
        image: 'https://example.com/alex.webp',
        jobTitle: 'Editor',
        sameAs: ['https://social.example.com/alex'],
        worksFor: { '@type': 'Organization', name: 'Example', url: 'https://example.com' },
      },
    })
  })
})

describe('articleLd', () => {
  it('emits headline, dates and authors with url', () => {
    expect(
      articleLd({
        headline: 'Example Post',
        url: 'https://example.com/posts/example',
        datePublished: '2026-01-02T10:00:00.000Z',
        dateModified: '2026-01-03T10:00:00.000Z',
        authors: [
          { name: 'Alex Example', url: 'https://example.com/authors/alex' },
          { name: 'Sam Example' },
        ],
      }),
    ).toEqual({
      '@type': 'Article',
      headline: 'Example Post',
      url: 'https://example.com/posts/example',
      mainEntityOfPage: 'https://example.com/posts/example',
      datePublished: '2026-01-02T10:00:00.000Z',
      dateModified: '2026-01-03T10:00:00.000Z',
      author: [
        { '@type': 'Person', name: 'Alex Example', url: 'https://example.com/authors/alex' },
        { '@type': 'Person', name: 'Sam Example' },
      ],
    })
  })

  it('emits NewsArticle when type is NewsArticle', () => {
    expect(
      articleLd({
        type: 'NewsArticle',
        headline: 'News',
        url: 'https://example.com/n',
        authors: [],
      }),
    ).toMatchObject({
      '@type': 'NewsArticle',
    })
  })
})

describe('breadcrumbListLd', () => {
  it('numbers the items from 1 and lets the last one leave out its url', () => {
    expect(
      breadcrumbListLd([{ name: 'Home', url: 'https://example.com/en' }, { name: 'About' }])
        .itemListElement,
    ).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/en' },
      { '@type': 'ListItem', position: 2, name: 'About' },
    ])
  })

  it('throws when an item before the last has no url', () => {
    expect(() => breadcrumbListLd([{ name: 'Home' }, { name: 'About' }])).toThrow(
      'Breadcrumb "Home" needs a url',
    )
  })
})

describe('jobPostingLd', () => {
  it('emits the required properties with a Place that has a country', () => {
    expect(
      jobPostingLd({
        title: 'Example Role',
        description: '<p>Example description.</p>',
        datePosted: '2026-01-02',
        hiringOrganization: { name: 'Example', url: 'https://example.com' },
        jobLocation: address,
      }),
    ).toEqual({
      '@type': 'JobPosting',
      title: 'Example Role',
      description: '<p>Example description.</p>',
      datePosted: '2026-01-02',
      hiringOrganization: { '@type': 'Organization', name: 'Example', url: 'https://example.com' },
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', ...address } },
    })
  })

  it('throws on a job location without a country', () => {
    expect(() =>
      jobPostingLd({
        title: 'Example Role',
        description: '<p>Example.</p>',
        datePosted: '2026-01-02',
        hiringOrganization: { name: 'Example' },
        jobLocation: { addressLocality: 'Example City', addressCountry: '' },
      }),
    ).toThrow('job location with a country')
  })
})

describe('eventLd', () => {
  const event = {
    name: 'Example Event',
    startDate: '2026-05-01T18:00:00+02:00',
    location: { name: 'Example Hall', address },
  }

  it('emits the required properties with a named Place', () => {
    expect(eventLd(event)).toEqual({
      '@type': 'Event',
      name: 'Example Event',
      startDate: '2026-05-01T18:00:00+02:00',
      location: {
        '@type': 'Place',
        name: 'Example Hall',
        address: { '@type': 'PostalAddress', ...address },
      },
    })
  })

  it('throws on a start or end date that is not a valid ISO 8601 date and time with a time zone offset', () => {
    expect(() => eventLd({ ...event, startDate: '2026-05-01T18:00:00' })).toThrow(
      'time zone offset',
    )
    expect(() => eventLd({ ...event, startDate: 'garbageZ' })).toThrow('time zone offset')
    expect(() => eventLd({ ...event, startDate: '2026-02-30T18:00:00+02:00' })).toThrow(
      'time zone offset',
    )
    expect(() => eventLd({ ...event, startDate: '2026-04-31T18:00:00Z' })).toThrow(
      'time zone offset',
    )
    expect(() => eventLd({ ...event, startDate: '2026-05-01T24:01:00Z' })).toThrow(
      'time zone offset',
    )
    expect(() => eventLd({ ...event, endDate: '2027-02-29T18:00:00Z' })).toThrow('time zone offset')
    expect(() => eventLd({ ...event, endDate: '2026-05-01T20:00' })).toThrow('time zone offset')
  })

  it('accepts 24:00 as the end of a day in both date fields', () => {
    expect(
      eventLd({
        ...event,
        startDate: '2026-05-01T24:00:00+02:00',
        endDate: '2026-05-02T24:00+02:00',
      }),
    ).toMatchObject({
      startDate: '2026-05-01T24:00:00+02:00',
      endDate: '2026-05-02T24:00+02:00',
    })
  })

  it('accepts a leap day', () => {
    expect(eventLd({ ...event, startDate: '2028-02-29T18:00:00+01:00' })).toMatchObject({
      startDate: '2028-02-29T18:00:00+01:00',
    })
  })

  it('throws on a location without an address', () => {
    expect(() => eventLd({ ...event, location: { name: 'Example Hall', address: {} } })).toThrow(
      'location address',
    )
  })
})
