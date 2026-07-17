# Contributing to NovaLabs

Thanks for your interest in contributing to NovaLabs! 🎉
This guide covers how to set up your environment, our coding conventions, and the
process for opening pull requests.

---

## 1. Workflow

1. Fork the repository (or work directly on a feature branch if you have access).
2. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes and commit using **Conventional Commits**:
   ```
   feat(scope): short summary
   fix(scope): short summary
   docs(scope): short summary
   test(scope): short summary
   refactor(scope): short summary
   chore(scope): short summary
   ```
4. Push your branch:
   ```bash
   git push origin feat/your-feature-name
   ```
5. Open a Pull Request against `main`. Use `Closes #<issue-number>` in the
   description for any issue your PR resolves.

---

## 2. Coding conventions

### Backend (NestJS / TypeORM)
- Stick to the existing module structure under `backend/src/<feature>/`.
- All entities live in `<feature>/entities/*.entity.ts` and **must** be registered
  in the relevant module's `TypeOrmModule.forFeature([...])`.
- Use DTOs (with `class-validator`) for every request body — never accept raw
  `any`.
- Money is always stored as `bigint` in **kobo** (smallest currency unit).
- Sensitive columns (passwords, OTP secrets, tokens) **must** be decorated with
  `@Exclude()` so they are stripped from JSON responses.

### Frontend (Next.js / React)
- Use the components in `frontend/components/ui/` (shadcn-style) for primitives.
- Tailwind CSS for styling — no inline styles or external CSS modules.
- All API calls go through `frontend/lib/apiClient.ts`; do not call `fetch`
  directly from components.
- React Query handles server state; local UI state uses `useState`/`useReducer`.

### Contracts (Soroban / Rust)
- Every contract crate lives at `contracts/<name>/` with its own `Cargo.toml`.
- Public entry points are `pub fn` inside an `#[contractimpl] impl ContractName`.
- Errors live in `errors.rs` using `#[contracterror]` with explicit `#[repr(u32)]`
  discriminants.
- Storage keys live in `lib.rs` (or a dedicated `storage.rs`) as a
  `#[contracttype] pub enum DataKey`.
- **Every contract must have at least 80% line coverage** — enforced by the
  `coverage` CI job. See `.github/workflows/CI.yaml`.

---

## 3. Data-model sync rule

Whenever you **add, rename, or remove** a TypeORM entity, column, index, or
relationship — or any database migration — you **must** also update
[`backend/docs/data-model.md`](backend/docs/data-model.md) in the same PR.

The **`verify-data-model`** CI job will fail any PR that:

1. Touches a path matching `entities/*.entity.ts` or `migrations/*.ts`, **and**
2. Does not also touch `backend/docs/data-model.md`.

The file contains:

- A Mermaid `erDiagram` block with all entities, columns, and relationships.
- A relationship cheat-sheet table.
- An index summary table.
- A conventions section.

When updating it, render the Mermaid locally (GitHub, mermaid.live, or any IDE
preview) to confirm the diagram parses before committing.

---

## 4. Pull-request checklist

Before opening a PR, confirm:

- [ ] `cd backend && npm run lint && npm run build` passes
- [ ] `cd frontend && npm run lint && npm run build` passes
- [ ] `cd contracts && cargo fmt --all -- --check` passes
- [ ] `cd contracts && cargo clippy --all-targets --all-features -- -D warnings`
      passes
- [ ] `cd contracts && cargo test --all` passes
- [ ] `backend/docs/data-model.md` updated (if any entity/migration changed)
- [ ] Commit messages follow Conventional Commits
- [ ] PR description includes `Closes #<issue>` for each issue resolved

---

## 5. Code coverage

Every PR and push to `main` automatically uploads coverage reports to
[Codecov](https://codecov.io/gh/NovaCoreLabs1/NovaLabs). The dashboard shows
historical trends and per-file breakdowns for each area.

### Running coverage locally

**Backend** (Jest)
```bash
cd backend
npm run test:cov
```
Output: `backend/coverage/lcov.info` and an HTML report.

**Frontend** (Vitest)
```bash
cd frontend
npm run test:cov
```
Output: `frontend/coverage/lcov.info` and a terminal summary.

**Contracts** (cargo-tarpaulin)
```bash
cd contracts
cargo tarpaulin --engine llvm --out Xml --fail-under 80
```
`cargo-tarpaulin` must be installed first (`cargo install cargo-tarpaulin` or
`cargo binstall cargo-tarpaulin`).

### Current targets

| Area | Target | Threshold | Tool |
|------|-------:|----------:|------|
| Contracts | 80% | 5% | cargo-tarpaulin |
| Backend | 10% | 5% | Jest |
| Frontend | 10% | 5% | Vitest |

Targets are intentionally set near current levels and will be raised as more
tests are written. The Codecov status check will not block your PR — it appears
as a comment so you can track progress over time.

See [`codecov.yml`](codecov.yml) for the full configuration.

---

## 6. Reporting bugs

Open an issue with:

- A clear, descriptive title.
- Steps to reproduce (or a minimal snippet).
- Expected vs. actual behaviour.
- Environment details (Node version, OS, browser if applicable).

Security issues should **not** be filed as public issues — follow the
[security policy](SECURITY.md) if one exists, otherwise contact a maintainer
directly.

---

Built with ❤️ by the NovaLabs community.