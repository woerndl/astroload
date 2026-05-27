# Forms

astroload ships with Payload's form builder plugin and a custom Astro
field renderer that submits to the CMS over HTTP.

## What is rendered

`web/src/components/blocks/FormBlock.astro` renders the form fields the
plugin emits. Supported field types are text, email, number, textarea,
select, checkbox, and message. The plugin is configured to drop the
field types that are not curated in the starter (country, state,
payment, date, upload). If you want any of those, add a case to the
renderer and remove the plugin scoping.

Each field has an explicit `<label for>` and matching input `id` of the
form `form-${formId}-${fieldName}`. There is no automatic mapping of
field names to `autocomplete` tokens in the renderer. If you want
browser autofill on common fields, add the attribute explicitly in the
renderer or extend the field config.

## How submissions flow

The bundled `<script>` builds a JSON payload of the shape
`{ form: <id>, submissionData: [...] }` and POSTs it to
`${CMS_URL}/api/form-submissions`. The script does three things:

- Captures `Date.now()` at attach time and includes it in the payload as
  `_rendered_at`. The stamp is generated in the browser, not at render
  time, so SSR or CDN caching does not affect it.
- POSTs JSON. On success, either redirects to the form's configured
  URL (when its confirmation type is `redirect`) or reveals the
  localized `confirmationMessage` block. On 4xx, surfaces
  `errors[0].message` from the response body, falling back to the
  form's generic error label.
- Guards against double-submits with an in-flight flag.

The form element has a native `action` and `method` pointing at the
same endpoint, but the Payload endpoint expects the JSON shape above,
not the form-encoded body a plain HTML POST would send. Submission
without JavaScript is broken in the template as it ships. If you need
a no-JS path, add a thin Astro server route on the public site that
wraps the form-encoded body into the JSON shape and forwards it.

## Cross-origin POST

The default split is the CMS on one origin and the public site on
another. The form POST is cross-origin, so Payload's CORS allow-list
must include the public site's origin. The CMS reads this from
`WEBSITE_URL`. The config sets `cors: [env.WEBSITE_URL]` and the matching
`csrf: [env.WEBSITE_URL]` for cookie-authenticated paths.

If you serve the public site from a domain different from `WEBSITE_URL`
(a custom domain on top of the deploy host), the form POST is blocked
until you add that origin to CORS. Update `WEBSITE_URL` or extend the
allow-list explicitly.

## Spam protection

The form builder plugin has no built-in spam protection. astroload
ships a few baseline checks against commodity contact-form spam:

- A honeypot field named `fax`, hidden by `.form-extra { display: none }`
  in the global stylesheet. The rule ships as an external sheet rather
  than inline, so bots that only parse the raw HTML do not see it. The
  field has no `aria-hidden`, `tabindex`, or `autocomplete` attribute,
  because each of those is a fingerprint a bot can match on. The name
  `fax` was picked because browsers do not autofill it.
- A client-stamped `_rendered_at` time-trap.
- A `beforeChange` hook (`cms/src/hooks/spamGuard.ts`) on
  `form-submissions` that rejects honeypot-filled or sub-1.5s
  submissions and strips both internal fields before save.

The time-trap is client-controlled. A bot can post any past timestamp
and pass the check trivially. The current trap catches lazy bots, not
motivated ones. If your project needs stronger guarantees, replace the
client stamp with a server-stamped signed token (HMAC, short TTL) or
gate the endpoint behind a CDN rule.

There is no per-IP or per-form rate limit on `/api/form-submissions`,
so a motivated attacker can post until the table fills. See
[`security.md`](./security.md) for the recommended posture.

## JS-off behaviour

The form does not work without JavaScript. The Payload endpoint at
`/api/form-submissions` expects a JSON body of the shape
`{ form: <id>, submissionData: [...] }`, and that payload is built by
the bundled `<script>`. A plain HTML form post would send a
form-encoded body that the endpoint does not accept.

If your project needs a no-JS path, add an Astro server route on the
public site that accepts the form-encoded body, builds the JSON shape,
forwards it to the CMS, and renders a confirmation page on success.
The template does not ship that wrapper.

## Accessibility

The renderer wires up a few baseline patterns:

- Explicit `<label for>` and `<input id>` pairs across textarea, select,
  checkbox, and input branches.
- `role="alert"` on the form-level error region for screen-reader
  announcement.
- Native `required` attribute (announced by screen readers) instead of a
  visual `*` separate from semantics.

What is not shipped: `aria-invalid` toggling after validation, per-field
error display, and `fieldset`/`legend` grouping. Per-field errors would
require a wrapper endpoint because the plugin's submission API returns a
flat error. That is more scope than the starter takes on. Add it in your
fork if your project needs it.

## What the spamGuard hook actually checks

`cms/src/hooks/spamGuard.ts` runs on `beforeChange` for
`form-submissions` and applies the following rules:

- If the honeypot field is non-empty, throw `APIError('Submission rejected.', 400)`.
- If `_rendered_at` is missing or unparseable, throw the same error.
- If `_rendered_at` is less than 1.5s before now, throw the same error.
- Strip both internal fields from the document so they never reach the
  database.

There is no upper bound on `_rendered_at`. A stale prefetched form
posted hours later still passes the time check as long as the elapsed
delta is at least 1.5 seconds.

The hook is wired through
`formBuilderPlugin({ formSubmissionOverrides: { hooks: { beforeChange: [spamGuard] } } })`
in `cms/src/payload.config.ts`. If you change the field shape, update
the hook in lockstep.
