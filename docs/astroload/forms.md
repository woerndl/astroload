# Forms

Astroload ships with Payload's form builder plugin and a custom Astro
field renderer that submits to the CMS over HTTP.

## What is rendered

`web/src/components/blocks/FormBlock.astro` renders the form fields the
plugin emits. Supported field types are text, email, number, textarea,
select, checkbox, and message. The plugin is configured to drop the
field types that are not curated in the starter (country, state,
payment, date, upload, radio). If you want any of those, add a case to
the renderer and remove the plugin scoping.

Each field has an explicit `<label for>` and matching input `id` of the
form `form-${formId}-${instance}-${fieldName}`, where `instance` is a
per-render token that keeps ids unique when the same form appears twice
on a page. There is no automatic mapping of
field names to `autocomplete` tokens in the renderer. If you want
browser autofill on common fields, add the attribute explicitly in the
renderer or extend the field config.

## How submissions flow

The bundled `<script>` builds a JSON payload of the shape
`{ form: <id>, submissionData: [...] }` and POSTs it to
`${CMS_URL}/api/form-submissions`. The script:

- Captures `Date.now()` at attach time and includes it in the payload as
  `_rendered_at`. The stamp is generated in the browser, not at render
  time, so SSR or CDN caching does not affect it.
- POSTs JSON. On success, either redirects to the form's configured
  URL (when its confirmation type is `redirect`) or shows the
  localized `confirmationMessage` block. On any non-ok response or a
  network failure, shows the localized generic error label from the
  Labels global. Server error bodies are not shown, because hook
  rejections and Payload validation messages are English regardless of
  the page locale.
- Guards against double-submits with an in-flight flag.

The success and error states are shown by toggling Tailwind's `hidden`
class on the form, the confirmation block, and the error paragraph. A
project that replaces Tailwind with its own CSS must define `.hidden`
(`display: none`) itself, or the confirmation and error blocks render
permanently below the form.

The form element has a native `action` and `method` pointing at the
same endpoint, but the Payload endpoint expects the JSON shape above,
not the form-encoded body a plain HTML POST would send. Submitting
without JavaScript does not work in the template as shipped. If you need
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

The form builder plugin has no built-in spam protection. Astroload
includes a few baseline checks against commodity contact-form spam:

- A honeypot field named `fax`, hidden by `.form-extra { display: none }`
  in the global stylesheet. The rule is in an external sheet rather
  than inline, so bots that only parse the raw HTML do not see it. The
  field has no `aria-hidden`, `tabindex`, or `autocomplete` attribute,
  because each of those is a fingerprint a bot can match on. The name
  `fax` was picked because browsers do not autofill it.
- A client-stamped `_rendered_at` timestamp for a minimum-submit-time
  check.
- A `beforeChange` hook (`cms/src/hooks/spamGuard.ts`) on
  `form-submissions` that rejects honeypot-filled, sub-1.5s, and
  oversized submissions and strips both internal fields before save.

The names `fax` and `_rendered_at` are reserved for these checks. The
Forms collection rejects a form that names a field after either (and any
duplicate field name) at save time, through the `validateFormFields`
hook wired into `formOverrides`.

The timestamp is client-controlled. A bot can post any timestamp older
than the threshold and pass the check. The check catches lazy bots, not
motivated ones. If your project needs stronger guarantees, replace the
client stamp with a server-stamped signed token (HMAC, short TTL) or
gate the endpoint behind a CDN rule.

There is no per-IP or per-form rate limit on `/api/form-submissions`,
so a motivated attacker can post until the table fills. See
[`security.md`](./security.md) for the recommended posture.

## Accessibility

The renderer implements a few baseline patterns:

- Explicit `<label for>` and `<input id>` pairs across textarea, select,
  checkbox, and input branches.
- `role="alert"` on the form-level error region for screen-reader
  announcement.
- Native `required` attribute (announced by screen readers) instead of a
  visual `*` separate from semantics.

Not included: `aria-invalid` toggling after validation, per-field
error display, and `fieldset`/`legend` grouping. Per-field errors would
require a wrapper endpoint because the plugin's submission API returns a
flat error. That is more scope than the starter takes on. Add it in your
fork if your project needs it.

## What the spamGuard hook checks

`cms/src/hooks/spamGuard.ts` runs on `beforeChange` for
`form-submissions` and applies the following rules:

- If `submissionData` is missing or not an array, throw `APIError('Submission rejected.', 400)`.
- If `submissionData` holds more than 100 entries, or any entry's field
  name or value is longer than 10,000 characters, throw the same error.
  Both bounds are constants (`MAX_ENTRIES`, `MAX_VALUE_LENGTH`) in
  `spamGuard.ts`, and the entry count includes the two internal fields.
  Raise either constant when a project's forms need more.
- If the honeypot field is non-empty, throw the same error.
- If `_rendered_at` is missing or unparseable, throw the same error.
- If `_rendered_at` is less than 1.5s before now, throw the same error.
- Strip both internal fields from the document so they do not reach the
  database.

There is no upper bound on `_rendered_at`. A stale prefetched form
posted hours later still passes the time check as long as the elapsed
delta is at least 1.5 seconds.

A second `beforeChange` hook, `validateSubmission`
(`cms/src/hooks/validateSubmission.ts`), runs after `spamGuard`. It
rejects a submission that omits a required field of its referenced form,
posts a duplicate field name, or references a form id that does not
exist, all with the same generic 400. It checks presence only: value
shapes (an email field holding a non-email, a select value outside its
options) are not validated, because submissions are stored in the
`form-submissions` collection and read by a person in the admin panel.

Both hooks are wired through
`formBuilderPlugin({ formSubmissionOverrides: { hooks: { beforeChange: [spamGuard, validateSubmission] } } })`
in `cms/src/payload.config.ts`, and the authoring-side `validateFormFields`
through `formOverrides` next to them. If you change the field shape,
update the hooks to match.

The same overrides set the submission access rules. Submissions hold
visitor PII, so anyone may create one, only panel users (admins and
editors) may read them, nobody may update one, and only admins may
delete. Without the explicit rules, read would be open to any
authenticated requester, including the web app's read-only api key.

The Forms collection itself restricts writes the same way as the content
collections (`isAdminOrEditor`): the plugin sets no write rules, so
writes would otherwise fall back to any authenticated requester,
including the api keys. Form reads stay anonymous (the plugin's
default), which [`security.md`](./security.md) lists with the other
public-read surfaces. Form saves and deletions fire the deploy webhook,
since the rendered fields, labels, and confirmation are baked into the
prerendered pages that embed the form.

The starter has no integration test for this path. When you set up a
CMS-side test runner, cover it with forged POSTs asserting the rejects
above.
