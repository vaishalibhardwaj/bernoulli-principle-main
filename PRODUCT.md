# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Central Setup Team:** a six-person peer team that sets up and maintains file sources (bank statements, Credit MIS from payment aggregators), column mappings, transaction type mappings, narration tags, cutoff times and file pickups. Every change is made by one member and approved by another (maker-checker). They pick the AMC they are working on once per session.
- **Recon Ops:** run the daily reconciliation for their AMCs. They match and clear transactions, raise setup requests to the Central Setup Team and work against cutoff times.
- **Admins:** manage users, roles and access.

## Product Purpose

CAMS recon is an internal tool for reconciling mutual fund collections. Bank statements and Credit MIS files come in for each AMC, and the tool matches them so Ops can clear the day's transactions on time. Success means correct setups approved quickly and Ops finishing the day before cutoff.

## Operating Context

Desktop, office hours, used all day. Sessions are scoped to one AMC at a time. Approvals, sent-back items, requests from Ops and drafts make up a daily To do list.

## Capabilities and Constraints

- React prototype with mock seed data in the browser (`frontend/src/mock/seed.js`). There is no backend.
- Roles and permissions per screen live in `frontend/src/lib/access.js`.
- Terms used in the product: AMC, bank setup, Credit MIS, aggregator (PA), column mapping, transaction type mapping, narration tags, cutoff times, file pickups, maker-checker, sent back.
- A PRD in Claude Docs must reflect every prototype change in plain English.

## Brand Commitments

- The user pinned the visual reference: a pastel fintech app look with lilac and pink cards, bold rounded type, black round icon buttons, purple pill buttons and 3D clay-style illustrations generated with Higgsfield.

## Evidence on Hand

All data is synthetic seed data. There are no real customers, volumes or metrics, so none should be presented as real.

## Product Principles

- An average person should understand every screen without training.
- Show what needs doing first, and keep rarely used configuration out of the way.
- Approved values stay live while an edit waits for approval.
- One AMC at a time, chosen explicitly.
