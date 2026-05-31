import { randomBytes, randomUUID } from 'crypto'
import path from 'path'
import { buildEditorState } from '@payloadcms/richtext-lexical'
import type { SerializedBlockNode } from '@payloadcms/richtext-lexical'
import type { Payload } from 'payload'
import { fileURLToPath } from 'url'

import { LOCALES, type Locale } from './shared'

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'admin1234'
const SITE_NAME = 'My site'

const generateApiKey = () => randomBytes(32).toString('hex')

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const placeholderImagePath = path.resolve(dirname, 'placeholder.webp')

const richText = (text: string) => buildEditorState({ text })

const richTextWithImageBlock = (text: string, imageId: number, caption: string) =>
  buildEditorState<SerializedBlockNode>({
    text,
    nodes: [
      {
        type: 'block',
        version: 2,
        format: '',
        fields: {
          id: randomUUID(),
          blockName: '',
          blockType: 'image',
          image: imageId,
          caption,
        },
      },
    ],
  })

// Payload's generated create/update types describe the union of every
// collection's fields. The seed writes one collection at a time with partial,
// per-locale documents that don't fit that union, so the data passes through
// this single opt-out instead of an `as never` cast at each call site.
const seedData = (data: Record<string, unknown>) => data as never

// Returns the locale only if the project ships it. The seed authors every
// document in 'de' and overlays 'en' on top; a single-locale project skips the
// overlay for a locale it no longer has.
const configuredLocale = (code: string): Locale | null =>
  (LOCALES as readonly string[]).includes(code) ? (code as Locale) : null

// Pages can be parents of other pages, posts, and authors. The pages-plugin
// blocks deleting a parent that still has children, so child collections go
// first, then non-root pages, then the root page. Globals are cleared up
// front so their relationships do not pin pages or media. Auth-bearing
// collections drop last so a force-reseed cannot collide on api-key
// uniqueness.
async function clearAll(payload: Payload): Promise<void> {
  const all = { id: { exists: true as const } }

  await payload.updateGlobal({ slug: 'header', data: seedData({ links: [] }) })
  await payload.updateGlobal({ slug: 'footer', data: seedData({ columns: [] }) })
  await payload.updateGlobal({
    slug: 'site-settings',
    data: seedData({ defaultSeo: { image: null } }),
  })

  await payload.delete({ collection: 'posts', where: all })
  await payload.delete({ collection: 'authors', where: all })
  await payload.delete({ collection: 'pages', where: { isRootPage: { not_equals: true } } })
  await payload.delete({ collection: 'pages', where: all })
  await payload.delete({ collection: 'redirects', where: all })
  await payload.delete({ collection: 'form-submissions', where: all })
  await payload.delete({ collection: 'forms', where: all })
  await payload.delete({ collection: 'media', where: all })
  await payload.delete({ collection: 'api-keys', where: all })
  await payload.delete({ collection: 'users', where: all })
}

export async function seedCMS(payload: Payload, force = false): Promise<void> {
  if (force) {
    payload.logger.info('Seed: force mode, clearing collections')
    await clearAll(payload)
  } else {
    const existing = await payload.find({ collection: 'users', limit: 1, pagination: false })
    if (existing.totalDocs > 0) {
      payload.logger.info('Seed: users already exist, skipping. Use SEED_FORCE=1 to re-seed.')
      return
    }
  }

  // The English overlay writes run only when the project ships 'en'; a
  // single-locale build skips them. `en` is typed Locale (not the literal
  // 'en'), so it stays assignable when the project's locale set excludes it.
  const en = configuredLocale('en')

  payload.logger.info('Seed: creating admin user')
  await payload.create({
    collection: 'users',
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      firstName: 'Admin',
      lastName: 'User',
      roles: ['admin'],
    },
  })

  payload.logger.info('Seed: creating api keys')
  const readKeyValue = process.env.PAYLOAD_READ_KEY ?? generateApiKey()
  const previewKeyValue = process.env.PAYLOAD_PREVIEW_KEY ?? generateApiKey()
  await payload.create({
    collection: 'api-keys',
    data: {
      name: 'Website (read-only)',
      type: 'read-only',
      enableAPIKey: true,
      apiKey: readKeyValue,
    },
  })
  await payload.create({
    collection: 'api-keys',
    data: {
      name: 'Preview',
      type: 'preview',
      enableAPIKey: true,
      apiKey: previewKeyValue,
    },
  })
  payload.logger.info(`Seed: read-only api key = ${readKeyValue}`)
  payload.logger.info(`Seed: preview api key   = ${previewKeyValue}`)

  payload.logger.info('Seed: creating media')
  const createMedia = async (altDe: string, altEn: string) => {
    const doc = await payload.create({
      collection: 'media',
      locale: 'de',
      filePath: placeholderImagePath,
      data: { alt: altDe },
    })
    if (en) await payload.update({
      collection: 'media',
      id: doc.id,
      locale: en,
      data: { alt: altEn },
    })
    return doc
  }

  const heroImage = await createMedia('Platzhalterbild', 'Placeholder image')
  const authorPhoto = await createMedia('Autorenfoto', 'Author photo')

  payload.logger.info('Seed: creating contact form')
  const contactForm = await payload.create({
    collection: 'forms',
    data: {
      title: 'Contact',
      submitButtonLabel: 'Send',
      confirmationType: 'message',
      confirmationMessage: richText('Thanks. We will be in touch.'),
      fields: [
        { blockType: 'text', name: 'name', label: 'Name', required: true, width: 100 },
        { blockType: 'email', name: 'email', label: 'Email', required: true, width: 100 },
        { blockType: 'textarea', name: 'message', label: 'Message', required: true, width: 100 },
      ],
    },
  })

  payload.logger.info('Seed: creating pages')
  const homeDe = await payload.create({
    collection: 'pages',
    locale: 'de',
    data: seedData({
      title: 'Startseite',
      slug: '',
      isRootPage: true,
      sections: [
        {
          blockType: 'richText',
          text: richText(
            'Willkommen. Das ist die Startseite. Bearbeite sie im Admin, um Inhalte zu ändern.',
          ),
        },
        {
          blockType: 'image',
          image: heroImage.id,
          caption: 'Platzhalterbild',
        },
      ],
      _status: 'published',
    }),
  })
  if (en) await payload.update({
    collection: 'pages',
    id: homeDe.id,
    locale: en,
    data: seedData({
      title: 'Home',
      slug: '',
      sections: [
        {
          id: homeDe.sections![0]!.id,
          blockType: 'richText',
          text: richText('Welcome. This is the home page. Edit it in admin to see content change.'),
        },
        {
          id: homeDe.sections![1]!.id,
          blockType: 'image',
          image: heroImage.id,
          caption: 'Placeholder image',
        },
      ],
    }),
  })

  const aboutDe = await payload.create({
    collection: 'pages',
    locale: 'de',
    data: seedData({
      title: 'Über uns',
      slug: 'ueber-uns',
      parent: homeDe.id,
      sections: [
        {
          blockType: 'richText',
          text: richText('Diese Seite zeigt, wie Unterseiten unter der Startseite verschachtelt werden.'),
        },
      ],
      _status: 'published',
    }),
  })
  if (en) await payload.update({
    collection: 'pages',
    id: aboutDe.id,
    locale: en,
    data: seedData({
      title: 'About',
      slug: 'about',
      sections: [
        {
          id: aboutDe.sections![0]!.id,
          blockType: 'richText',
          text: richText('This page shows how child pages nest under the home page.'),
        },
      ],
    }),
  })

  const contactDe = await payload.create({
    collection: 'pages',
    locale: 'de',
    data: seedData({
      title: 'Kontakt',
      slug: 'kontakt',
      parent: homeDe.id,
      sections: [
        {
          blockType: 'form',
          form: contactForm.id,
          introContent: richText(
            'Schreib uns eine Nachricht. Wir antworten innerhalb weniger Werktage.',
          ),
        },
      ],
      _status: 'published',
    }),
  })
  if (en) await payload.update({
    collection: 'pages',
    id: contactDe.id,
    locale: en,
    data: seedData({
      title: 'Contact',
      slug: 'contact',
      sections: [
        {
          id: contactDe.sections![0]!.id,
          blockType: 'form',
          form: contactForm.id,
          introContent: richText(
            'Send us a message. We reply within a few business days.',
          ),
        },
      ],
    }),
  })

  payload.logger.info('Seed: creating posts and authors parent pages')
  const postsParentDe = await payload.create({
    collection: 'pages',
    locale: 'de',
    data: seedData({
      title: 'Beiträge',
      slug: 'posts',
      sections: [
        {
          blockType: 'richText',
          text: richText('Hier sammeln sich alle Beiträge.'),
        },
        {
          blockType: 'postsList',
        },
      ],
      _status: 'published',
    }),
  })
  if (en) await payload.update({
    collection: 'pages',
    id: postsParentDe.id,
    locale: en,
    data: seedData({
      title: 'Posts',
      slug: 'posts',
      sections: [
        {
          id: postsParentDe.sections![0]!.id,
          blockType: 'richText',
          text: richText('All posts live here.'),
        },
        {
          id: postsParentDe.sections![1]!.id,
          blockType: 'postsList',
        },
      ],
    }),
  })

  const authorsParentDe = await payload.create({
    collection: 'pages',
    locale: 'de',
    data: seedData({
      title: 'Autoren',
      slug: 'authors',
      sections: [
        {
          blockType: 'richText',
          text: richText('Wer schreibt hier eigentlich.'),
        },
        {
          blockType: 'authorsList',
        },
      ],
      _status: 'published',
    }),
  })
  if (en) await payload.update({
    collection: 'pages',
    id: authorsParentDe.id,
    locale: en,
    data: seedData({
      title: 'Authors',
      slug: 'authors',
      sections: [
        {
          id: authorsParentDe.sections![0]!.id,
          blockType: 'richText',
          text: richText('Meet the people writing here.'),
        },
        {
          id: authorsParentDe.sections![1]!.id,
          blockType: 'authorsList',
        },
      ],
    }),
  })

  payload.logger.info('Seed: creating author')
  const authorDe = await payload.create({
    collection: 'authors',
    locale: 'de',
    data: seedData({
      name: 'Sam Houston',
      slug: 'sam-houston',
      parent: authorsParentDe.id,
      role: 'Redakteur',
      photo: authorPhoto.id,
      bio: richText('Sam schreibt über Web, Performance und CMS-Architektur.'),
      _status: 'published',
    }),
  })
  if (en) await payload.update({
    collection: 'authors',
    id: authorDe.id,
    locale: en,
    data: seedData({
      slug: 'sam-houston',
      role: 'Editor',
      bio: richText('Sam writes about the web, performance, and CMS architecture.'),
    }),
  })

  payload.logger.info('Seed: creating post')
  const postDe = await payload.create({
    collection: 'posts',
    locale: 'de',
    data: seedData({
      title: 'Hallo Welt',
      slug: 'hallo-welt',
      parent: postsParentDe.id,
      authors: [authorDe.id],
      publishedAt: new Date().toISOString(),
      excerpt: 'Ein erster Beitrag, der den Blog-Renderer beleuchtet.',
      image: heroImage.id,
      content: richTextWithImageBlock(
        'Beiträge nutzen einen Lexical-Editor mit eingebetteten Image-Blöcken.',
        heroImage.id,
        'Platzhalterbild',
      ),
      _status: 'published',
    }),
  })
  if (en) await payload.update({
    collection: 'posts',
    id: postDe.id,
    locale: en,
    data: seedData({
      title: 'Hello world',
      slug: 'hello-world',
      excerpt: 'A first post to exercise the blog renderer.',
      content: richTextWithImageBlock(
        'Posts use a Lexical editor with embedded image blocks.',
        heroImage.id,
        'Placeholder image',
      ),
    }),
  })

  payload.logger.info('Seed: updating globals')
  const headerDe = await payload.updateGlobal({
    slug: 'header',
    locale: 'de',
    data: seedData({
      links: [
        { page: { relationTo: 'pages', value: homeDe.id }, label: 'Startseite' },
        { page: { relationTo: 'pages', value: aboutDe.id }, label: 'Über uns' },
        { page: { relationTo: 'pages', value: contactDe.id }, label: 'Kontakt' },
      ],
    }),
  })
  if (en) await payload.updateGlobal({
    slug: 'header',
    locale: en,
    data: seedData({
      links: [
        {
          id: headerDe.links![0]!.id,
          page: { relationTo: 'pages', value: homeDe.id },
          label: 'Home',
        },
        {
          id: headerDe.links![1]!.id,
          page: { relationTo: 'pages', value: aboutDe.id },
          label: 'About',
        },
        {
          id: headerDe.links![2]!.id,
          page: { relationTo: 'pages', value: contactDe.id },
          label: 'Contact',
        },
      ],
    }),
  })

  const year = new Date().getFullYear()
  const footerDe = await payload.updateGlobal({
    slug: 'footer',
    locale: 'de',
    data: seedData({
      columns: [
        {
          heading: 'Navigation',
          links: [
            { page: { relationTo: 'pages', value: homeDe.id }, label: 'Startseite' },
            { page: { relationTo: 'pages', value: aboutDe.id }, label: 'Über uns' },
          ],
        },
        {
          heading: 'Inhalte',
          links: [
            { page: { relationTo: 'pages', value: postsParentDe.id }, label: 'Beiträge' },
            { page: { relationTo: 'pages', value: authorsParentDe.id }, label: 'Autoren' },
          ],
        },
      ],
      copyright: `© ${year} ${SITE_NAME}`,
    }),
  })
  if (en) await payload.updateGlobal({
    slug: 'footer',
    locale: en,
    data: seedData({
      columns: [
        {
          id: footerDe.columns![0]!.id,
          heading: 'Navigation',
          links: [
            {
              id: footerDe.columns![0]!.links![0]!.id,
              page: { relationTo: 'pages', value: homeDe.id },
              label: 'Home',
            },
            {
              id: footerDe.columns![0]!.links![1]!.id,
              page: { relationTo: 'pages', value: aboutDe.id },
              label: 'About',
            },
          ],
        },
        {
          id: footerDe.columns![1]!.id,
          heading: 'Content',
          links: [
            {
              id: footerDe.columns![1]!.links![0]!.id,
              page: { relationTo: 'pages', value: postsParentDe.id },
              label: 'Posts',
            },
            {
              id: footerDe.columns![1]!.links![1]!.id,
              page: { relationTo: 'pages', value: authorsParentDe.id },
              label: 'Authors',
            },
          ],
        },
      ],
      copyright: `© ${year} ${SITE_NAME}`,
    }),
  })

  await payload.updateGlobal({
    slug: 'labels',
    locale: 'de',
    data: {
      global: {
        home: 'Startseite',
        language: 'Sprache',
      },
      lists: {
        noPosts: 'Noch keine Beiträge.',
        noAuthors: 'Noch keine Autoren.',
      },
      form: {
        submit: 'Senden',
        sending: 'Wird gesendet ...',
        error: 'Senden fehlgeschlagen. Bitte versuche es erneut.',
      },
      notFound: {
        title: 'Seite nicht gefunden',
        description: 'Die angeforderte Seite existiert nicht.',
        homePageButton: 'Zur Startseite',
      },
      serverError: {
        title: 'Serverfehler',
        description: 'Beim Laden der Seite ist ein Fehler aufgetreten.',
        homePageButton: 'Zur Startseite',
      },
      preview: {
        editingDraft: 'Entwurf bearbeiten',
        openInAdmin: 'In Admin öffnen',
      },
    },
  })
  if (en) await payload.updateGlobal({
    slug: 'labels',
    locale: en,
    data: {
      global: {
        home: 'Home',
        language: 'Language',
      },
      lists: {
        noPosts: 'No posts yet.',
        noAuthors: 'No authors yet.',
      },
      form: {
        submit: 'Submit',
        sending: 'Sending ...',
        error: 'Sending failed. Please try again.',
      },
      notFound: {
        title: 'Page not found',
        description: 'The page you requested does not exist.',
        homePageButton: 'Back to home',
      },
      serverError: {
        title: 'Server error',
        description: 'Something went wrong while loading the page.',
        homePageButton: 'Back to home',
      },
      preview: {
        editingDraft: 'Editing draft',
        openInAdmin: 'Open in admin',
      },
    },
  })

  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'de',
    data: {
      siteName: SITE_NAME,
      defaultSeo: {
        titleSuffix: ` | ${SITE_NAME}`,
        description: 'Beschreibung der Site.',
      },
      robots: { allowIndexing: false },
    },
  })
  if (en) await payload.updateGlobal({
    slug: 'site-settings',
    locale: en,
    data: {
      siteName: SITE_NAME,
      defaultSeo: {
        titleSuffix: ` | ${SITE_NAME}`,
        description: 'Site description.',
      },
      robots: { allowIndexing: false },
    },
  })

  payload.logger.info('Seed: done')
}
