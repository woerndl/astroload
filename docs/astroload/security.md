# Security

What the template defends against, what it accepts as a residual risk,
and what you should add before production.

## Threat model

Main concerns:

- Leakage of unpublished content (drafts) to the public.
- Compromise of the admin surface through a stolen frontend token.
- Spam and abuse against the public form endpoint.
- Cross-origin and CSRF risks from running the CMS and the public site
  on separate origins.
- Tampering with the preview route to read drafts without an editor
  account.

The template does not try to address these concerns, among others:

- An attacker who already holds editor or admin credentials.
- Web application firewall behaviour. The template assumes the CMS and
  the public site run behind a host that handles this.
- DDoS resistance. The CMS process is not designed for unauthenticated
  load.

Your deployment also needs its own answer for the npm supply chain, dependency CVE monitoring,
host-header and DNS pinning, log redaction, SSRF in any outbound
fetches you add, prototype pollution and other JS-runtime hardening,
admin-account lifecycle, and container or runtime isolation.

## Authentication model

The public rendering and preview flow uses three kinds of credentials.
Other env values (`DATABASE_URI`, `PAYLOAD_SECRET`, `DEPLOY_HOOK_URL`,
the Resend and S3 keys) are outside this model.

1. Editor accounts in the Users collection, with the admin or editor
   role. They log in through Payload's login flow. Both roles write
   content: Pages, Posts, Authors, Media, Forms, the four globals, and
   Redirects. Managing users and API keys stays admin-only. The first
   account registered on an empty instance becomes an admin regardless
   of the form's role default, so a fresh deploy cannot lock itself
   out. Open registration is Payload's bootstrap model. With
   transactions off (the standalone-Mongo default), the empty-instance
   check is not atomic, so two registration requests that arrive at the
   same time during setup could both create admins. Register the first account, or run the
   auth seed (which creates the admin), before the instance is publicly
   reachable. Once one user exists, the endpoint closes.
2. Two API keys created by the auth seed and consumed by the Astro side.
   - A read-only key for the public renderer. It cannot read drafts or
     write, and it stays on the server.
   - A preview-scoped key for the `/preview` route. It can read drafts,
     cannot write, and stays on the server.
3. `PREVIEW_SECRET`, a shared value the CMS and the Astro app both
   know. The `/preview` route checks it.

No admin-capable Payload token goes into `web/.env`. A leak of the
read-only key reveals already-public content. A leak of the preview key
reveals drafts. Neither gives write access or the admin surface.

The read-only key is still server-only even though the risk from a leak is
smaller. Putting it in client islands would allow enumeration and
rate-limit abuse against the CMS API. Keep both keys behind
`astro:env/server`.

## Draft leakage is the central concern

The read-only key must not return draft data when the public renderer
fetches content. Collections that hold versioned, draftable content use
the `readPublishedOrDraft` access policy, which returns a
`{ _status: { equals: 'published' } }` Where clause when the requester
is a `read-only` API key.

The Where clause is applied to the top-level query. At populated
depth, the filter does not automatically extend. Behaviour depends on
Payload's populate semantics for the pinned version. The intent is
that each related collection's access policy runs against the same
requester, so draftable relations stay filtered. Verify this with a
test before relying on it for sensitive content.

Three exceptions exist by design. Decide on each before production:

- Media has `read: anyone` (public-read). Uploads referenced by an
  unpublished post are reachable by URL if someone has it. With S3, the
  default proxied mode serves files through Payload's file route under
  this same read access, while the optional direct mode
  ([`deployment.md`](./deployment.md#direct-media-serving-optional))
  serves the bucket publicly and bypasses it. Add an access guard if a
  leaked media URL is a meaningful disclosure for your project.
- The Header, Footer, Labels, and SiteSettings globals are public-read.
  They carry editorial copy and have no draft state, so any change there
  is publicly readable immediately.
- Forms are public-read, the form-builder plugin's default. A form
  definition holds field names and confirmation copy and is enumerable
  without a key. The plugin limits the `emails` array, which holds the
  notification recipient addresses, to users of the admin auth
  collection. Tighten read to authenticated requesters in
  `formOverrides.access` if exposing the field names matters for your
  project. Writes need the admin or editor role, as for the content
  collections.

The API surface these rules guard is REST only. GraphQL is disabled
(`graphQL: { disable: true }`, route handlers removed), so the same
collections are not reachable through a second query surface that would
need its own review.

`read` alone does not close the leak. Payload generates `/versions`
endpoints for every versioned collection, and their access rule is
`readVersions`, not `read`. Left unset, `readVersions` allows any
authenticated requester, including the read-only API key, to fetch
draft versions. The shipped collections pin `readVersions: isPanelUser`
through the shared `contentAccess` object
([`cms/src/access/contentAccess.ts`](../../cms/src/access/contentAccess.ts)).

If you add a new collection that holds drafts, spread `contentAccess`
(or set both `read: readPublishedOrDraft` and `readVersions` yourself).
If you add a custom endpoint that reads draftable content, pass
`overrideAccess: false` to its Local API calls and check the requester the way
[`cms/src/endpoints/canPreview.ts`](../../cms/src/endpoints/canPreview.ts)
does, because the Local API skips access control by default. A
regression here is hard to spot through manual testing.
`web/e2e/drafts.e2e.ts` checks which version of a page each key reads.
The read-only key can still read draft text through a child page: when an
editor publishes a child page before its parent page was ever published,
the pages plugin copies the parent's draft title and slug into the child's
`breadcrumbs` and `path`. Publish the parent first. To check, publish a
child under a parent that was never published, then read the child with
`PAYLOAD_READ_KEY`, and look for the parent's draft title in its
`breadcrumbs`. Draft leakage through other relationships has no test
yet.

## The preview route and the preview API key

The `/preview` route requires a valid `PREVIEW_SECRET` in the request.
The comparison uses `crypto.timingSafeEqual`, so a wrong value and a
missing value produce the same response shape (403). The route also
holds a server-side `PAYLOAD_PREVIEW_KEY` and uses it to fetch drafts
from the CMS.

The two values carry different risks.

- A leaked `PREVIEW_SECRET` alone gets an attacker to the route, but
  the route fetches with the server-side API key, so the attacker gets
  no credential for direct CMS reads.
- A leaked `PAYLOAD_PREVIEW_KEY` is a direct CMS credential. The
  Payload API accepts it as `Authorization: api-keys API-Key <key>`
  and returns drafts. Preview keys are not subject to the
  `readPublishedOrDraft` filter. Access falls through to the
  collection's default. The route check does not protect against
  this. Anyone with the key and network reach to the CMS API can
  read drafts. Cross-origin browser reads are blocked by CORS
  (`cors: [env.WEBSITE_URL]`), but a server-side curl or a same-origin
  page works.

Treat `PAYLOAD_PREVIEW_KEY` as the more sensitive of the two. Rotate
it by issuing a new key in the admin, updating the env, and restarting
the Astro process. Rotate `PREVIEW_SECRET` by setting a new value in
both `.env` files and restarting both processes.

## Cross-origin posture

The CMS sets `cors: [env.WEBSITE_URL]` and `csrf: [env.WEBSITE_URL]`.
The CORS entry allows the public site's browser-side POSTs to the form
endpoint. The CSRF entry pairs with that for cookie-authenticated
flows.

If your deploy serves the public site from a custom domain different
from `WEBSITE_URL`, that custom domain is not in the allow-list. The
form POST fails until you fix `WEBSITE_URL` or extend the lists
explicitly. The template does not use wildcard CORS. Do not add it.

`web/server.mjs` sends a `Content-Security-Policy` header with
`frame-ancestors` and the origin of `CMS_URL` on every public site
response, prerendered pages included. Only pages on the CMS origin, such
as the admin live preview, can frame the site. A `<meta>` policy cannot
carry `frame-ancestors`. `Astro.csp.insertDirective()` reaches only HTML
that Astro renders on demand, so prerendered pages need the response
header. When a response already has a `Content-Security-Policy`, for
example from Astro with `security.csp` on, the server adds
`frame-ancestors` as a second policy. The browser enforces every policy,
including one from the host or a proxy, so a frame must pass all of them.
Browsers ignore `X-Frame-Options` when a `frame-ancestors` policy is
present, so a default `X-Frame-Options: DENY` from the deploy host does
not block the preview. The template sets no policy on the admin.

## Content security policy

`web/astro.config.mjs` holds a `security.csp` block, commented out. When
it is on, Astro sends the policy as a `<meta>` tag on prerendered pages
and as a `Content-Security-Policy` header on on-demand routes
([configuration reference](https://docs.astro.build/en/reference/configuration-reference/#securitycsp)).
The policy allows `'self'` and
the hashes of the scripts and styles that Astro bundles, `<Font>` styles
included. Astro does not hash `is:inline` scripts and styles or
`set:html` bodies. Two elements in the starter have such an inline body.
The block lists the hash of the layer statement in `LayerOrder.astro`.
`JsonLd.astro` passes the JSON-LD to `astro-seo-schema`, which writes it
with `set:html` into a `<script type="application/ld+json">`. The browser
treats a script of that type as a data block and does not run it
([HTML standard](https://html.spec.whatwg.org/multipage/scripting.html#data-block)).
The browser checks the policy only for a script that it runs, so this
element needs no hash. The block allows `style-src-attr 'unsafe-inline'`
because the Lexical renderer writes `style` attributes on paragraphs and
text, and `FormBlock.astro` writes one on each field. Astro does not
support `security.csp` together with `<ClientRouter />`
([configuration reference](https://docs.astro.build/en/reference/configuration-reference/#securitycsp)).

With the policy on, a client script follows these rules:

- It sets a style only through `element.style.<prop>` or
  `element.style.setProperty()`. It does not use `cssText`,
  `setAttribute('style', ...)`, `innerHTML` with `style=`, or a `<style>`
  element created at run time.
- An inline script that the browser runs either moves into a bundled
  `<script>` or adds the hash of its exact emitted bytes to
  `scriptDirective.hashes`.

## Rate limiting is not bundled

There is no per-IP or per-form rate limit on `/api/form-submissions` or
the read APIs. A motivated attacker can flood the form endpoint or
enumerate the read API.

Common ways to handle this include a CDN or load-balancer rule
(Cloudflare, the host's WAF, an upstream load balancer), an in-process
middleware on the CMS that throttles per IP, a reverse-proxy rule, or a
queued submission pipeline. Pick one before you go to production.

## Form submission integrity

The form's minimum-submit-time check relies on a client-stamped
timestamp, so it is not a strong abuse control. See
[`forms.md`](./forms.md) for the shipped checks and production gaps.

Stored submissions hold visitor PII, so their access rules are set in
the plugin overrides: read is limited to panel users, update is blocked,
and delete is admin-only. The plugin's own default limits read to users
of the admin auth collection and sets no delete rule, so without the
explicit rules delete would fall back to any authenticated requester,
including the API keys.

The spam-guard hook caps a submission at 100 entries and 10,000
characters per entry field name or value (constants in
`cms/src/hooks/spamGuard.ts`). A single accepted submission can then
store about 1 MB of text. The hook limits stored submission fields
only. Request-body size limits and rate limiting belong at the host or
proxy.

## Preview secret in URLs leaks through Referer

The preview route accepts the secret in a query string. A page rendered
inside the preview iframe could otherwise leak its full URL (including
the secret) through the `Referer` header on any outbound request to a
third party.

The preview route sets `Referrer-Policy: no-referrer` on the responses it
returns: the secret check, the not-found cases, a failed draft fetch, and
the rendered page. The browser then sends no `Referer` from a preview page.

Astro renders a thrown error without the route's headers, so
`web/server.mjs` also sends `Referrer-Policy: no-referrer` on every
response to a request with `previewSecret` in its query. `astro dev` and
`astro preview` do not run `web/server.mjs`. A deployment with another
server entry sets the header there or at the edge.

Two rules keep the secret out of the analytics. `Layout.astro` renders no
tracker on a request whose path starts with `/preview/`, which covers a
404 or 500 render of a preview URL. `Umami.astro` deletes `previewSecret`
from the url and the referrer of each pageview, which covers a public page
opened with the secret in its query. A `data-umami-event` click sends the
url that the tracker reads from the address bar, and `Umami.astro` does
not edit it. On a public page opened with the secret, that url still
contains the secret.

## Lexical link scheme allowlist

The rich text renderer prints link nodes with whatever `url` the Lexical
document holds, so an unfiltered `javascript:` or `data:` URL would render
as a clickable XSS vector. Astroload closes this in two layers:

- At the schema layer
  ([`cms/src/lexical/editor.ts`](../../cms/src/lexical/editor.ts)), the link
  feature's `url` validator allows exactly what the web renderer resolves: a
  root-relative path or an absolute `http`, `https`, `mailto`, or `tel` URL.
  It rejects ASCII control characters (browsers strip them while resolving,
  so `/\t/evil.com` would navigate off-origin as `//evil.com`), rejects
  backslashes (browsers treat them as slashes in http(s) URLs, so
  `/\evil.example` would navigate off-origin too), and rejects the rest at
  save time for every editor that inherits the global feature set. Both
  layers share the scheme list from `cms/src/shared.ts`.
- The renderer
  ([`web/src/components/lexical/sanitizeLinks.ts`](../../web/src/components/lexical/sanitizeLinks.ts))
  unwraps link nodes whose `url` carries a disallowed scheme, a
  protocol-relative host, a control character, or a backslash to plain text
  before rendering, covering content that predates or bypasses the validator.

If you add a rich text editor that does not inherit the global feature set,
pass it through `lexicalEditorWithSafeLinks` so the validator applies.

## Generated keys are not in the repo

Auth bootstrap is its own module: `seedAuth` creates the admin user and
the two API keys and logs the key values to stdout. It runs standalone
as `pnpm --filter @astroload/cms seed:auth` and as the first step of the
demo seed, so a project that deletes the demo content keeps a way to
provision a fresh database. The key values must be pasted into `web/.env`. None of them
are committed. Both entry points skip whatever already exists, so
re-running does not rotate the keys. Passing `SEED_FORCE=1` to the demo
seed clears and recreates them, with fresh values unless
`PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY` are pinned in `cms/.env`.
The admin account uses the demo credentials unless
`PAYLOAD_ADMIN_EMAIL` and `PAYLOAD_ADMIN_PASSWORD` are set. How a
reseed affects the keys is documented in
[`maintenance.md`](./maintenance.md).

## Dependencies

The Payload version is pinned in lockstep across `@payloadcms/*`
packages. `pnpm audit` reports advisories from time to time. Triage
them against the installed tree before acting: an advisory in a
transitive dependency of `eslint-config-next` or the Astro language
server does not reach the public site, while an advisory on a runtime
dependency of `web/` is a release blocker. Accept admin-only or
build-only advisories in lockstep with the Payload pin and clear them
at the next coordinated bump.

## Hardening you should add before production

These items depend on your deploy, so the template does not include
them. The list covers gaps the template leaves open and is not a full
hardening checklist:

- Rate-limit rule in front of the CMS (CDN or middleware).
- HTTP body-size limit in front of the CMS.
- IP allow-list on `/admin` if your team is in a known network.
- Automated regression test for draft leakage at populated depth.
- Server-stamped submit-time check (or alternative) on form submissions
  if you expect targeted spam.
