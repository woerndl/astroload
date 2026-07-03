# Security

What the template defends against, what it accepts as a residual risk,
and what you should add when you ship it to production.

## Threat model

Main concerns:

- Leakage of unpublished content (drafts) to the public.
- Compromise of the admin surface through a stolen frontend token.
- Spam and abuse against the public form endpoint.
- Cross-origin and CSRF risks from running the CMS and the public site
  on separate origins.
- Tampering with the preview route to read drafts without an editor
  account.

A starter cannot enumerate every risk a real deployment faces. The
following are examples of concerns this template does not try to address.
Treat the list as illustrative, not exhaustive:

- An attacker who already holds editor or admin credentials.
- Web application firewall behaviour. The template assumes the CMS and
  the public site sit behind a host that handles this.
- DDoS resistance. The CMS process is not designed for unauthenticated
  load.

Other classes of risk you still need to think about on your own
deployment include the npm supply chain, dependency CVE monitoring,
host-header and DNS pinning, log redaction, SSRF in any outbound
fetches you add, prototype pollution and other JS-runtime hardening,
admin-account lifecycle, and container or runtime isolation.

## Authentication model

The public rendering and preview flow uses three kinds of credentials.
Other env values (`DATABASE_URI`, `PAYLOAD_SECRET`, `DEPLOY_HOOK_URL`,
the Resend and S3 keys) are separate concerns and live alongside these.

1. Editor accounts in the Users collection. Admin and editor roles.
   Real authentication through Payload's login flow.
2. Two API keys minted by the seed and consumed by the Astro side.
   - A read-only key for the public renderer. Cannot read drafts.
     Cannot write. Server-only.
   - A preview-scoped key for the `/preview` route. Can read drafts.
     Cannot write. Server-only.
3. `PREVIEW_SECRET`, a shared value the CMS and the Astro app both
   know. Gates the `/preview` route itself.

No admin-capable Payload token ever lands in `web/.env`. A leak of the
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

Two exceptions exist by design. Decide on each before production:

- Media has `read: anyone` (public-read). Uploads referenced by an
  unpublished post are reachable by URL if someone has it. Add an
  access guard if a leaked media URL is a meaningful disclosure for
  your project.
- The Header, Footer, Labels, and SiteSettings globals are public-read.
  They carry editorial copy, not draft article bodies, but a draft
  change there is visible immediately.

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
`overrideAccess: false` to its Local API calls and gate it the way
[`cms/src/endpoints/canPreview.ts`](../../cms/src/endpoints/canPreview.ts)
does, because the Local API skips access control by default. A
regression here is hard to spot through manual testing. The starter
does not ship an automated draft-leakage test. Add one when you set up
your test runner.

## The preview route and the preview API key

The `/preview` route requires a valid `PREVIEW_SECRET` in the request.
The comparison uses `crypto.timingSafeEqual`, so a wrong value and a
missing value produce the same response shape (403). The route also
holds a server-side `PAYLOAD_PREVIEW_KEY` and uses it to fetch drafts
from the CMS.

The two values are not symmetric.

- A leaked `PREVIEW_SECRET` alone gets an attacker to the route, but
  the route fetches with the server-side API key, so the attacker
  cannot pivot to direct CMS reads.
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
explicitly. Wildcard CORS is not used and should not be added.

The template does not set `X-Frame-Options` or a Content Security
Policy on either the admin or the public site. The preview iframe
works because no header forbids the embed, not because a header
explicitly allows it. If your deploy host adds a default
`X-Frame-Options: DENY`, the preview iframe will break. If you want a
positive policy, add `Content-Security-Policy: frame-ancestors <admin-origin>`
on the public site responses (in the host, in a wrapping reverse proxy,
or in an Astro middleware).

## Rate limiting is not bundled

There is no per-IP or per-form rate limit on `/api/form-submissions` or
the read APIs. A motivated attacker can flood the form endpoint or
enumerate the read API.

Common ways to handle this include a CDN or load-balancer rule
(Cloudflare, the host's WAF, an upstream load balancer), an in-process
middleware on the CMS that throttles per IP, a reverse-proxy rule, or a
queued submission pipeline. Pick one before you go to production.

## Form submission integrity

The form time-trap is client-controlled, so it is not a strong abuse
control. See [`forms.md`](./forms.md) for the shipped checks and
production gaps.

Stored submissions hold visitor PII, so their access rules are pinned in
the plugin overrides: read is limited to panel users, update is blocked,
and delete is admin-only. Without the explicit rules, the read-only API
key could fetch submissions.

There is no body-size limit on `/api/form-submissions` beyond Payload's
defaults. If your forms accept long-text fields, add an explicit cap.

## Preview secret in URLs leaks through Referer

The preview route accepts the secret in a query string. A page rendered
inside the preview iframe could otherwise leak its full URL (including
the secret) through the `Referer` header on any outbound request to a
third party.

The preview route sets `Referrer-Policy: no-referrer` on the responses it
returns: the secret check, the not-found cases, a failed draft fetch, and
the rendered page. The browser then sends no `Referer` from a preview page.

One gap remains. An error thrown while the layout renders falls through to
Astro's error page, which is built without the route's headers. If you need
the policy on every preview response, or you serve other secret-bearing
paths, enforce it at the edge with a `Referrer-Policy` rule on `/preview/*`
in the host's response-header config.

## Lexical link scheme allowlist

The rich text renderer prints link nodes with whatever `url` the Lexical
document holds, so an unfiltered `javascript:` or `data:` URL would render
as a clickable XSS vector. Astroload closes this in two layers:

- At the schema layer
  ([`cms/src/lexical/editor.ts`](../../cms/src/lexical/editor.ts)), the link
  feature's `url` validator allows only `http`, `https`, `mailto`, `tel`,
  and relative/schemeless URLs, rejecting the rest at save time for every
  editor that inherits the global feature set.
- The renderer
  ([`web/src/components/lexical/sanitizeLinks.ts`](../../web/src/components/lexical/sanitizeLinks.ts))
  unwraps link nodes whose `url` carries a disallowed scheme to plain text
  before rendering, covering content that predates the validator.

If you add a richtext editor that does not inherit the global feature set,
pass it through `lexicalEditorWithSafeLinks` so the validator applies.

## Generated keys are not in the repo

The seed creates the admin user and the two API keys and logs the key
values to stdout at the end of the run. The values must be pasted into
`web/.env`. None of them are committed. By default the seed skips when
users already exist, so re-running it does not rotate the keys. Passing
`SEED_FORCE=1` re-runs it and mints fresh values unless `PAYLOAD_READ_KEY`
and `PAYLOAD_PREVIEW_KEY` are pinned in `cms/.env`. The reseed trap is
documented in [`maintenance.md`](./maintenance.md).

## Dependencies

The Payload version is pinned in lockstep across `@payloadcms/*`
packages. `pnpm audit` will show advisories from time to time. Triage
them against the installed tree before acting: an advisory in a
transitive dependency of `drizzle-kit` or the Astro language server
does not ship to the public site, while an advisory on a runtime
dependency of `web/` is a release blocker. Accept admin-only or
build-only advisories in lockstep with the Payload pin and clear them
at the next coordinated bump.

## Hardening you should add before production

The items below depend on your deploy and are not bundled. The list
covers the gaps the template specifically leaves open. It is not a full
production hardening checklist:

- Rate-limit rule in front of the CMS (CDN or middleware).
- Body-size limit on form submissions.
- IP allow-list on `/admin` if your team is in a known network.
- Automated regression test for draft leakage at populated depth.
- Server-stamped time-trap (or alternative) on form submissions if you
  expect targeted spam.
