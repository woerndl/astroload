import { expect, it } from 'vitest'

import { breadcrumbListLd, eventLd, jobPostingLd, organizationLd } from './structuredData'

const address = {
  streetAddress: 'Example Street 1',
  postalCode: '1010',
  addressLocality: 'Example City',
  addressCountry: 'AT',
}

it('organizationLd emits filled properties only, each nested node with its type', () => {
  const node = organizationLd({
    name: 'Example',
    legalName: ' ',
    sameAs: ['https://social.example.com/example', ''],
    address,
    contactPoint: { contactType: 'sales' },
    subOrganization: [{ name: 'Example Branch' }],
  })
  expect(node).toMatchObject({
    '@type': 'Organization',
    sameAs: ['https://social.example.com/example'],
    address: { '@type': 'PostalAddress', ...address },
    subOrganization: [{ '@type': 'Organization', name: 'Example Branch' }],
  })
  expect(node).not.toHaveProperty('legalName')
  expect(node).not.toHaveProperty('contactPoint')
  const contact = { telephone: '+43 1 000000', contactType: 'sales' }
  const other = organizationLd({ name: 'Example', address: {}, contactPoint: contact })
  expect(other).not.toHaveProperty('address')
  expect(other).toMatchObject({ contactPoint: { '@type': 'ContactPoint', ...contact } })
})

const event = { name: 'Talk', startDate: '2028-02-29T18:00Z', location: { name: 'Hall', address } }
const job = {
  title: 'Example Job',
  description: 'Example',
  datePosted: '2026-05-01',
  hiringOrganization: { name: 'Example' },
  jobLocation: address,
}

// prettier-ignore
it.each<[string, () => unknown, string]>([
  ['an impossible event date', () => eventLd({ ...event, startDate: '2026-02-30T18:00:00+02:00' }), 'time zone offset'],
  ['an event date without an offset', () => eventLd({ ...event, endDate: '2026-05-01T20:00:00' }), 'time zone offset'],
  ['a job location with an empty country', () => jobPostingLd({ ...job, jobLocation: { ...address, addressCountry: '' } }), 'with a country'],
  ['a breadcrumb without a url before the last item', () => breadcrumbListLd([{ name: 'Home' }, { name: 'About' }]), 'needs a url'],
])('rejects %s', (_, build, message) => {
  expect(build).toThrow(message)
})

// prettier-ignore
it.each<[string, () => unknown]>([
  ['a leap day', () => eventLd(event)],
  ['a job location with a country', () => jobPostingLd(job)],
  ['a last breadcrumb without a url', () => breadcrumbListLd([{ name: 'Home', url: '/' }, { name: 'About' }])],
])('accepts %s', (_, build) => {
  expect(build).not.toThrow()
})
