# Security Policy

## Supported Versions

| Version | Supported          |
|---------|-------------------|
| 1.x     | ✅ Active support  |

## Reporting a Vulnerability

We take the security of FinMind AI seriously. If you believe you have found a
security vulnerability, please **do not** open a public issue.

Instead, report it privately by emailing the project maintainers. We will
acknowledge receipt within 48 hours and provide a timeline for resolution.

Please include:
- A brief description of the issue
- Steps to reproduce
- Potential impact
- Any suggested fix (if available)

## Disclosure Policy

- We will investigate and fix verified vulnerabilities as soon as possible
- A security advisory will be published after the fix is released
- Credit will be given to reporters unless anonymity is requested

## Best Practices

When deploying FinMind AI:

1. **API Keys**: Never commit API keys to version control. Use environment variables.
2. **Authentication**: Add proper authentication in production (OAuth2/JWT).
3. **Input Validation**: All API inputs are validated; keep validation enabled.
4. **Database**: Use strong passwords and network isolation for PostgreSQL.
5. **Dependencies**: Run `mvn dependency-check:check` regularly for CVE scanning.
