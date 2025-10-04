# Contributing to All Your Base64

Thank you for your interest in contributing to All Your Base64! This guide will help you get started.

## Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/skullzarmy/all-your-base64.git
   cd all-your-base64
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── base64-engine.ts    # Core conversion engine
├── output-formatter.ts # Output formatting logic
├── mime-detector.ts    # MIME type detection
├── error-handler.ts    # Error handling and validation
├── types.ts           # TypeScript type definitions
└── test/              # Test files
    ├── base64-engine.test.ts
    └── output-formatter.test.ts
```

## Development Scripts

- `npm run dev` - Run CLI in development mode with tsx
- `npm run build` - Build TypeScript to JavaScript
- `npm run test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier

## Testing

We use Vitest for testing. All new features should include comprehensive tests.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Writing Tests

- Place test files in `src/test/` directory
- Use `.test.ts` suffix for test files
- Follow existing test patterns
- Aim for high test coverage

Example test structure:

```typescript
import { describe, it, expect } from 'vitest';
import { YourClass } from '../your-class.js';

describe('YourClass', () => {
  it('should do something', () => {
    // Test implementation
  });
});
```

## Code Style

We use ESLint and Prettier for code formatting:

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Handle errors gracefully

## Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write tests for new functionality
   - Update documentation if needed
   - Ensure all tests pass
   - Run linting and formatting

4. **Commit your changes**

   ```bash
   git commit -m "feat: add new feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `test:` for test additions/changes
   - `refactor:` for code refactoring
   - `chore:` for maintenance tasks

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Provide a clear description of changes
   - Reference any related issues
   - Ensure CI passes

## Issue Reporting

When reporting issues, please include:

- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/stack traces
- Sample files (if applicable)

## Feature Requests

For new features:

- Check if the feature already exists
- Explain the use case and benefits
- Provide examples of expected usage
- Consider backward compatibility

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release commit
4. Tag release
5. Push to GitHub
6. GitHub Actions will publish to npm

## Guidelines

### Code Quality

- Write self-documenting code
- Add comments for complex logic
- Use TypeScript strictly (no `any` types)
- Handle edge cases and errors
- Optimize for performance when needed

### Dependencies

- Minimize external dependencies
- Use well-maintained packages
- Keep dependencies up to date
- Consider bundle size impact

### Documentation

- Update README for new features
- Add JSDoc comments for APIs
- Include usage examples
- Update help text in CLI

## Questions?

Feel free to:

- Open an issue for questions
- Start a discussion for ideas
- Join our community channels

Thank you for contributing! 🚀
