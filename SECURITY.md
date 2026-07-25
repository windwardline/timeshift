# Security Policy

## Reporting a Vulnerability

Do not disclose suspected vulnerabilities, credentials, personal data, or
exploit details in a public issue or pull request.

Use this repository's private vulnerability-reporting workflow (Security →
Report a vulnerability). Include only what is needed to reproduce and assess
the issue: affected component, prerequisites and reproduction steps, observed
and expected behavior, and potential impact. Do not include real user data,
active credentials, or production secrets.

You should receive a reply within 72 hours.

## Scope

- This repository and the deployment at https://timeshift.windwardline.com
- Security-critical boundaries: authentication (magic-link sign-in),
  cross-user data isolation, and secret handling in application code and CI.
