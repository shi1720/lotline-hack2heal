# Lotline

**Tagline:** Turn a medical product recall into a completed, documented response.

> Working submission draft. Transfer presentation content into the mandatory Hack2Heal 2.0 template before submission. No claim of official-template compliance is made here.

## Inspiration

Picture a small clinic group receiving a recall notice during a busy afternoon. The notice names a product and a manufacturing lot. Someone still has to check the stockroom, compare the identifiers, separate affected units, resolve incomplete records, and document what happened.

The difficult question is simple: **Can we account for every potentially affected unit?**

Lotline is built around that question. It connects a reviewed recall scope to local inventory and follows the response through to an auditable receipt. The opening clinic scenario is illustrative, not a reported incident or customer interview.

## What it does

Lotline is a recall-response workspace for small US clinic groups. Users import stock records, review product and lot identifiers against the source notice, and run deterministic matching. The workspace distinguishes exact matches, items outside the reviewed scope, and records that need investigation.

Missing data stay visible. An item with a missing lot is not silently declared unaffected. Operators record quarantine and disposition, reconcile quantities, and export a response receipt with the remaining exceptions.

The demo uses synthetic stock and recall data. It needs no patient records.

## How we built it

The workflow separates three responsibilities:

1. **Review the source.** A person verifies the notice, affected product identifiers, lots, and handling instructions.
2. **Apply explicit rules.** Deterministic matching compares the reviewed scope with stock identifiers. A product name alone is insufficient evidence for an exact match.
3. **Account for the response.** Inventory outcomes, quantity reconciliation, and an event history support a reviewable receipt.

CSV import accepts a defined nine-column stock format with stable unique IDs, individual-unit quantities, and a 500-record workspace limit. Supported GS1 identifier parsing can reduce transcription; it does not imply universal scanner or label compatibility. Signed-in evaluation workspaces persist server-side in Cloudflare D1 and are scoped to the individual account through Sites authentication. Shared organizational access, staff roles, retention policies, and production integrations require further work.

## What makes it different

The focus is the operational gap between receiving a recall notice and demonstrating a completed response at a small clinic. Lotline makes uncertain inventory records part of the task rather than hiding them in a successful-match total.

Recall-management products already exist. Our differentiation hypothesis is a lightweight, clinic-focused workflow that works with basic stock exports, needs no patient data, and makes incomplete identifiers and unresolved quantities obvious. Customer discovery must establish whether that focus is valuable enough to switch or pay.

## Challenges

The easiest way to make a convincing recall demo is to start with perfectly clean identifiers. Real workflows cannot rely on that. The product therefore keeps missing or placeholder identifiers unresolved and blocks completion while affected quantities remain unaccounted for. Scope entry supports at most one catalog and one individual-unit GTIN, with exact shared lots or explicitly all lots. A reviewer must attest that the source fits this simple scope. Multi-product entries and recognized range or wildcard expressions are rejected; complex notices require separate, reviewed handling.

A second challenge is the meaning of “done.” A checked box is not evidence that a product was physically removed. Lotline records an operator's actions and references; it cannot independently certify the physical stockroom.

## Accomplishments

The project brings recall scope review, stock matching, exception handling, response accounting, and an evidence packet into one coherent MVP workflow. Forty-eight core tests pass, covering the implemented rules and failure cases; that is engineering validation, not a clinical or customer study. Its key design commitment is explainability: a reviewer should be able to understand why a record was matched, left unresolved, or considered outside a reviewed scope.

This is an engineering demonstration. It is not a clinically validated product, a regulatory certification, or evidence of reduced patient harm.

## What we learned

The central design insight is that recall response is an accountability problem as well as a search problem. Accurate matching only helps when the remaining stock and unresolved records are visible to the person responsible for acting.

## What's next

Start with discovery sessions involving clinic operations staff and distributor recall teams. Then run a supervised, nonclinical pilot using historical or simulated notices and de-identified stock records. Compare response time, unresolved records, reconciliation errors, and receipt completeness against the existing process.

After that validation, the project can expand from individual account workspaces to shared organizational access, staff roles, robust source-version handling, organization-controlled retention, and customer-specific integrations.

## Commercial model — hypothesis to test

The initial buyer is an operations lead at a small clinic group. A distributor could also sponsor access for its customers to improve recall follow-through. The initial pricing experiment is US$99 per group per month for up to three sites, plus US$19 for each additional site. This is an unvalidated willingness-to-pay test, not a revenue forecast. There is no customer, revenue, or partnership claim.

The value proposition is less manual follow-up and a clearer response record. A useful pilot would measure minutes spent per recall and the proportion of stock records fully accounted for. An ROI estimate should use those observed results, not assumed patient outcomes.

## Team

**Shivam Gupta — project creator and product direction.** Developed with substantial AI assistance for research, software implementation, testing, and submission drafting. Institution and enrollment details must be completed truthfully before entry. See `acknowledgements.md` for the full disclosure.

---

# Content for the six mandatory presentation sections

## 1. Problem Statement

A recall notice does not tell a clinic whether its own stock is affected or whether every unit has been handled. Small clinic groups must connect product and lot identifiers to local records, resolve incomplete data, coordinate action, and keep evidence. The opportunity is a simpler way to complete and document that response.

## 2. Proposed Solution

Lotline connects a human-reviewed recall scope to clinic stock. It identifies exact matches, separates unresolved records, and tracks quarantine, disposition, and quantity accounting through a response receipt. The workflow uses no patient data.

## 3. Innovation & Technology

A transparent chain from source scope to stock match to recorded action. Deterministic product-and-lot matching within a supported simple scope; explicit unresolved states; defined-format CSV import and supported GS1 identifier parsing; permitted disposition enforced from the reviewed notice; quantity reconciliation; exportable event history. Account-scoped D1 persistence, revision checks, and workspace-lifetime request deduplication support reliable recorded actions. The novelty claim is the focused workflow and accessibility for small clinics, not invention of recall management or automated medical judgment.

## 4. Target Users & Impact

Users: clinic operations leads, stockroom staff, and the person responsible for recall follow-up. Potential buyers: small US clinic groups or distributor sponsors. Intended benefits: faster investigation, fewer unaccounted stock records, and clearer evidence of response. These benefits remain hypotheses pending measured field validation.

## 5. Implementation Approach

Demonstrate the complete workflow using synthetic data. Test exact matches, nonmatches, missing identifiers, invalid input, and reconciliation boundaries. Follow with discovery and a supervised historical-notice pilot. Build on the current account-scoped persistence with shared organizational access, staff roles, retention controls, security review, and production integrations only after requirements and validation.

## 6. Team Details

Shivam Gupta — project creator and product direction. AI-assisted research, implementation, testing, and drafting. Complete institution, enrollment, and any other required personal fields truthfully. Do not list the AI assistant as an eligible human teammate.


## Research references

- [FDA explanation of medical device recalls](https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/what-medical-device-recall).
- [FDA historical recall Z-2614-2026](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRES/res.cfm?id=220342), used to understand inventory checks, quarantine, response, and return workflows. This source is historical; the synthetic demo does not execute its instructions.

No FDA, GS1, clinic, or distributor endorsement is claimed.
