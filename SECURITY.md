# Security Policy

## Reporting a vulnerability
Please report security issues privately to **richard.oconnor@gmail.com**.
Do not open a public issue for undisclosed vulnerabilities. We aim to respond within 7 days.

## Supported versions
The latest `main` is supported. Older tags are not maintained.

## Secrets
This repository contains **no secrets**. All credentials (e.g. `NTA_API_KEY`) are supplied at
runtime via environment variables — locally through a git-ignored `.env.local` (see `.env.example`)
and in the cluster through a Kubernetes Secret (`deploy/helm/bustracker/templates/secret.yaml`).
CI runs gitleaks on every push to prevent accidental secret commits.
