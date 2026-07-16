# Scratch scripts

Everything in this directory except this file is gitignored. Put throwaway
one-off scripts here: a one-time fixup, a quick query against the local
database, a local experiment. A script that has to be reproducible belongs in
the parent `cms/src/scripts/` instead, written to be idempotent like `seed.ts`.
The [content workflow](../../../../docs/astroload/content-workflow.md) covers
when to write a script at all and how to change deployed content.

Run a script with `payload run`, which boots the Payload config and gives the
file the Local API on a `payload` instance:

```bash
pnpm --filter @astroload/cms payload run src/scripts/scratch/backfill.ts
```

A minimal script:

```ts
import { getPayload } from 'payload'

import config from '../../payload.config'

// Refuse to run against anything but a local database. A scratch script is the
// easiest way to hit the wrong target by accident. Set ALLOW_DEPLOYED_SCRATCH=1
// only when you mean to touch a remote database.
const uri = process.env.DATABASE_URI ?? ''
if (!/\/\/(?:[^/@]+@)?(?:127\.0\.0\.1|localhost)[:/]/.test(uri) && process.env.ALLOW_DEPLOYED_SCRATCH !== '1') {
  throw new Error(`Refusing to run against ${uri}. Set ALLOW_DEPLOYED_SCRATCH=1 to override.`)
}

const payload = await getPayload({ config })

// ... read or mutate through payload.find / payload.update / payload.create ...

await payload.destroy()
process.exit(0)
```

`src/scripts/seed.ts` is the worked example of this pattern. `payload run` reads
`cms/.env`, so the script targets whatever `DATABASE_URI` resolves to. Keep
that pointed at the local database.
