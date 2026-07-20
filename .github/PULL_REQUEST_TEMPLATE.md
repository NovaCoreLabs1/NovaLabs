<!-- Please fill out the sections below. This template helps reviewers understand the "why" and the testing performed. -->

## Linked Issue
- Closes: #152 (link the issue this PR closes)

## Description
A short description of the change and why it was made.

## Type of change
- [ ] Feature (non-breaking change which adds functionality)
- [ ] Bugfix (non-breaking change which fixes an issue)
- [ ] Documentation
- [ ] CI/CD / Chore (build/test tooling, maintenance)
- [ ] Tests (adds or updates tests)

## Test Plan
- How was this change tested? Unit tests, manual steps, or integration tests.
- Commands to run locally to verify the change:

```bash
npm ci
npm test
```

## Screenshots (if applicable)
- Add before/after screenshots for UI changes.

## Breaking Changes
- Does this change introduce breaking behavior for any public API or `/api/` endpoints? If yes, describe the breaking change and the migration steps.
- If this PR touches `/api/` files and **no** breaking changes are declared above, CI will fail the PR checks — add a description or add `BREAKING CHANGE:` to the top of the PR body.

## Checklist
- [ ] Linked an existing issue in the description
- [ ] Used conventional commit-style title (type(scope): short description)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] No new warnings
- [ ] Documentation updated if needed
- [ ] CI passes

If the change is non-trivial, add a small explanation for reviewers explaining the design choices and alternatives considered.
## Description
<!-- Describe your changes -->

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] CI/CD

## Checklist
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] No new warnings
- [ ] Documentation updated if needed
