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
`${CMS_URL}/api/form-submissions`. The script does three things:

- Captures `Date.now()` at attach time and includes it in the payload as
  `_rendered_at`. The stamp is generated in the browser, not at render
  time, so SSR or CDN caching does not affect it.
- POSTs JSON. On success, either redirects to the form's configured
  URL (when its confirmation type is `redirect`) or reveals the
  localized `confirmationMessage` block. On any non-ok response or a
  network failure, shows the localized generic error label from the
  Labels global. Server error bodies are never surfaced, because hook
  rejections and Payload validation messages are English regardless of
  the page locale.
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

The form builder plugin has no built-in spam protection. Astroload
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

The names `fax` and `_rendered_at` are reserved for these checks. The
Forms collection rejects a form that names a field after either (and any
duplicate field name) at save time, through the `validateFormFields`
hook wired into `formOverrides`.

The time-trap is client-controlled. A bot can post any past timestamp
and pass the check trivially. The current trap catches lazy bots, not
motivated ones. If your project needs stronger guarantees, replace the
client stamp with a server-stamped signed token (HMAC, short TTL) or
gate the endpoint behind a CDN rule.

There is no per-IP or per-form rate limit on `/api/form-submissions`,
so a motivated attacker can post until the table fills. See
[`security.md`](./security.md) for the recommended posture.

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

- If `submissionData` is missing or not an array, throw `APIError('Submission rejected.', 400)`.
- If the honeypot field is non-empty, throw the same error.
- If `_rendered_at` is missing or unparseable, throw the same error.
- If `_rendered_at` is less than 1.5s before now, throw the same error.
- Strip both internal fields from the document so they never reach the
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
options) are not validated, because submissions land in a review queue.

Both hooks are wired through
`formBuilderPlugin({ formSubmissionOverrides: { hooks: { beforeChange: [spamGuard, validateSubmission] } } })`
in `cms/src/payload.config.ts`, and the authoring-side `validateFormFields`
through `formOverrides` next to them. If you change the field shape,
update the hooks in lockstep.

The same overrides pin the submission access rules. Submissions hold
visitor PII, so anyone may create one, only panel users (admins and
editors) may read them, nobody may update one, and only admins may
delete. Without the explicit rules, read would be open to any
authenticated requester, including the web app's read-only api key.

The Forms collection itself is write-gated the same way as the content
collections (`isAdminOrEditor`): the plugin sets no write rules, so
writes would otherwise fall back to any authenticated requester,
including the api keys. Form reads stay anonymous (the plugin's
default), which [`security.md`](./security.md) lists with the other
public-read surfaces. Form saves and deletions fire the deploy webhook,
since the rendered fields, labels, and confirmation are baked into the
prerendered pages that embed the form.

The starter ships no integration test for this path. When you set up a
CMS-side test runner, cover it with forged POSTs asserting the rejects
above.
