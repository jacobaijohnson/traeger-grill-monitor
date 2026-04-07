## Description

Brief description of the changes in this PR.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Security fix

## Related Issues

Closes #

## Pre-Merge Checklist

### Code Quality
- [ ] TypeScript compiles with zero errors (`pnpm tsc --noEmit`)
- [ ] All tests pass (`pnpm test`)
- [ ] No new `console.log` calls (use structured pino logger)
- [ ] No unbounded `z.string()` or `z.number()` inputs
- [ ] New DB queries are scoped by `ctx.user.id`

### Security
- [ ] No hardcoded secrets, tokens, or API keys
- [ ] New endpoints use appropriate rate limiter tier
- [ ] Input validation includes `.max()` bounds

### Docker
- [ ] Dockerfile builds successfully (if applicable)
- [ ] No new local file dependencies

### Documentation
- [ ] README updated if user-facing behavior changed
- [ ] New environment variables documented in `env.example`

## Screenshots

If applicable, add screenshots showing the change.

## Testing

Describe how you tested these changes.
