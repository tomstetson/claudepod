# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in ClaudePod, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Measures

ClaudePod implements the following security measures:

- **Helmet.js** - Security headers
- **Rate limiting** - 100 requests per 15 minutes on API endpoints
- **WebSocket origin validation** - Only localhost, private IPs, and Tailscale
- **Path traversal protection** - Directory browsing restricted to configured root
- **No secrets in codebase** - All sensitive config via environment variables

## Automated Security Scanning

This repository uses free, built-in GitHub security tools:

- **CodeQL** - Static code analysis (GitHub native)
- **Dependabot** - Automatic dependency updates & security alerts
- **Secret Scanning** - Detects accidentally committed secrets (GitHub native)
- **npm audit** - Package vulnerability checks
- **OSSF Scorecard** - Security health metrics

## Network Security

ClaudePod is designed for **trusted networks only**:

- Run behind Tailscale or another VPN for remote access
- Never expose directly to the public internet
- The server binds to `0.0.0.0` but should be firewall-protected

## Dependencies

All dependencies are regularly audited:

| Package | Purpose | License |
|---------|---------|---------|
| express | Web server | MIT |
| ws | WebSocket | MIT |
| node-pty | Terminal emulation | MIT |
| helmet | Security headers | MIT |
| express-rate-limit | Rate limiting | MIT |
| dotenv | Environment config | BSD-2-Clause |
