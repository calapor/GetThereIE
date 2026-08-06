# GetThereIE — Portfolio Documentation

> Engineering documentation for this project.

GetThereIE is a live Dublin Bus and Luas tracker built on the National Transport Authority (NTA)
GTFS-Realtime feed and a locally imported static GTFS timetable. This folder documents how it is
designed, built, tested, and operated.

## Documents

| # | Document | Description |
|---|----------|-------------|
| 0 | [Product & Design Brief](0-product-design-brief.md) | The problem, what the app does, and scope boundaries |
| 1 | [Pre-Development Phase](1-pre-development-phase.md) | Why GTFS-RT over scraping, why SQLite for the schedule, data-source selection |
| 2 | [System Architecture](2-system-architecture.md) | Feed → protobuf decode → schedule join → ETA → API → client |
| 3 | [Data Model Reference](3-data-model-reference.md) | GTFS SQLite schema, Prisma models, key TypeScript types |
| 4 | [Testing Strategy](4-testing-strategy.md) | What is unit-tested and why, Vitest setup, CI integration |
| 5 | [GTFS Integration Deep Dive](5-gtfs-integration-deep-dive.md) | Protobuf decode, static/realtime join, the trip-ID rotation problem |
| 6 | [Security Considerations](6-security-considerations.md) | Public vs private data, API-key handling, reporting abuse surface |
| 7 | [Gamification & Reporting](7-gamification-and-reporting.md) | Points, the majority-bonus rule, the leaderboard, valid reports |
| 8 | [Deployment & Operations](8-deployment-and-operations.md) | k3s, Jenkins pipeline, GTFS refresh CronJob, seeding a fresh cluster |
| 9 | [Engineering Decision Log](9-engineering-decision-log.md) | The key architectural decisions and their trade-offs |

## Reading paths

**Recruiter (5 min):** [0 — Product & Design Brief](0-product-design-brief.md), then the
[main README](../../README.md) feature list.

**Hiring Manager (15 min):** [0 — Product Brief](0-product-design-brief.md) →
[2 — System Architecture](2-system-architecture.md) →
[9 — Engineering Decision Log](9-engineering-decision-log.md).

**Technical Interview (30 min):** [2 — System Architecture](2-system-architecture.md) →
[5 — GTFS Integration Deep Dive](5-gtfs-integration-deep-dive.md) →
[3 — Data Model Reference](3-data-model-reference.md) →
[4 — Testing Strategy](4-testing-strategy.md) →
[8 — Deployment & Operations](8-deployment-and-operations.md).
