# Contributing to Hermes Backend

Thank you for your interest in contributing to Hermes. This document outlines the process for contributing code, documentation, and bug reports.

## Code of Conduct

Hermes is a project by [Rhizomatica](https://www.rhizomatica.org/) dedicated to enabling communication in remote and disaster-affected communities. All contributors are expected to interact with respect and empathy.

## Getting Started

### Prerequisites

- **Node.js** ≥ 22 LTS
- **npm** ≥ 10
- **Git**

### Local Setup

```bash
# Clone the repository
git clone https://github.com/Rhizomatica/hermes-backend.git
cd hermes-backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Run tests to verify everything works
npm test
```

See [docs/development.md](docs/development/setup.md) for detailed setup instructions.

## Development Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code. Protected. |
| `develop` | Integration branch for features. |
| `feature/*` | Individual features (e.g., `feature/hal-sbitx-driver`) |
| `fix/*` | Bug fixes (e.g., `fix/conversation-pagination-offset`) |
| `docs/*` | Documentation-only changes |

### Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `style`, `chore`, `ci`

**Scopes** (examples): `auth`, `api`, `db`, `hal`, `gateway`, `messaging`, `clock`, `resilience`

**Examples**:
```
feat(hal): add SBitxCLIDriver with PTT command
fix(db): resolve conversation list pagination off-by-one
docs(adr): add ADR-004 for JWT token rotation
test(messaging): add idempotency tests for message creation
```

### Pull Request Process

1. Create a feature branch from `develop`
2. Write code with tests (see [docs/testing-strategy.md](docs/development/testing.md))
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Ensure formatting: `npm run format`
6. Open a PR against `develop` with a clear description
7. All PRs require at least one review before merge
8. The PR description must include:
   - What the change does
   - Which phase/task from `docs/development/plan.md` it addresses
   - Testing performed
   - Any deployment considerations

## Testing Requirements

- **Unit tests**: All new modules must have ≥ 80% unit test coverage
- **Integration tests**: All new API endpoints must have integration tests
- **E2E tests**: Critical flows (auth → create conversation → send message → receive via WebSocket) must have E2E tests

Run specific test suites:
```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

## Reporting Bugs

Open an issue with:

1. **Environment**: Node.js version, OS, Raspberry Pi model (if applicable)
2. **Steps to reproduce**
3. **Expected vs actual behavior**
4. **Logs**: Attach relevant Pino log output (redact sensitive data)

## Documentation

- API changes must update `docs/architecture/api.md`
- Schema changes must update `docs/architecture/database.md` and include migration files
- New architectural decisions require an ADR in `docs/adr/`
- Significant changes should include updates to `CHANGELOG.md`

## License

By contributing, you agree that your contributions will be licensed under the GNU General Public License v3.0 (see [LICENSE](LICENSE)).