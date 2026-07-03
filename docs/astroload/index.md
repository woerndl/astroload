# Documentation

The landing [`README.md`](../README.md) covers quickstart and features,
and [`CHANGELOG.md`](./CHANGELOG.md) tracks changes per release. The docs
below describe what is not obvious from reading the code.

- [`architecture.md`](./architecture.md): the two services, how they
  talk, and where the boundaries are.
- [`conventions.md`](./conventions.md): rules for contributors and LLM
  agents working in the codebase.
- [`maintenance.md`](./maintenance.md): failure modes that are not
  obvious from reading the code.
- [`forms.md`](./forms.md): the forms surface, cross-origin POST, spam
  guard, and why submission requires JavaScript.
- [`content-workflow.md`](./content-workflow.md): how to change content
  without leaving throwaway scripts in history.
- [`security.md`](./security.md): threat model, what the template
  defends against, and what you should add before production.
