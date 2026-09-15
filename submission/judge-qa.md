# Lotline — judge questions and answers

These answers are written to be spoken naturally. Use only claims supported by the final implementation and evidence. “We” refers to the project, not an invented human team.

## Why this problem?

A recall notice identifies a problem, but the receiving clinic still has to locate affected stock and complete the requested response. FDA notices can require inventory checks, quarantine, follow-up, and a response even when no affected stock is found. That creates a concrete workflow we can demonstrate and evaluate without making diagnostic claims.

## Is this actually new?

Recall-management platforms already exist. We do not claim to have invented them. Our hypothesis is that small US clinic groups need a lighter way to get from basic stock exports to an explainable, documented response. The distinguishing design choices are explicit missing-identifier exceptions, quantity accounting, and evidence linked to the reviewed scope. The market still needs to validate that differentiation.

## Why would a clinic pay?

The proposed value is less manual investigation and follow-up, with a clearer record for the responsible manager. We would first measure time per recall and the completeness of stock accounting. Our initial experiment is ninety-nine US dollars per group per month for up to three sites, plus nineteen dollars per additional site. That price is a hypothesis until buyers agree it is worth paying for. We have no revenue or signed-customer claim.

## Who is the buyer?

An operations lead managing several clinics is the first buyer hypothesis. A distributor could sponsor the workflow for customer clinics. Selling to groups may make onboarding and support more economical than acquiring one clinic at a time. Both routes need discovery.

## Why not use a spreadsheet?

A spreadsheet can be a reasonable starting point. Lotline adds a repeatable connection between the reviewed recall scope, matching reasons, unresolved records, quantity accounting, and the response receipt. A pilot should compare those benefits against the existing spreadsheet process; if they do not improve the workflow enough, the product needs to change.

## What does AI do here?

AI assisted the research, implementation, testing, and preparation of this project. The safety-relevant stock matching is deterministic. A person reviews the source scope, and the matching result can be explained from explicit identifiers. We do not depend on a language model deciding that a product is safe.

## What if the lot is missing?

The record remains unresolved and visible for investigation. The application should not transform missing information into an unaffected result. Resolution needs better source data or physical verification by the responsible staff member.

## What if the product name is similar but the identifier differs?

A similar name is not enough for an exact match. We compare supported identifiers within the reviewed scope. Unknown or conflicting identifiers require investigation. The matching rules and their supported cases should be inspected in the code and test results.

## How do you know the source notice is correct?

A human reviews the authoritative notice and attests that it fits the supported simple scope: at most one catalog and one individual-unit GTIN, with exact shared lots or explicitly all lots. Recognized range and wildcard expressions and multi-product entries are rejected. The MVP cannot detect every misunderstanding of a notice, and it does not guarantee that a notice is current or complete. A production workflow would need source provenance, version checks, amendment handling, and a clear owner for review. The source remains the authority for handling instructions.

## Does “outside scope” mean safe to use?

No. It means the record did not match this particular reviewed recall scope using the available supported identifiers. It is not a clinical safety determination, an expiration check, or a statement that no other recall applies.

## What proves the stock was actually removed?

The software records what an operator reports and any evidence reference they provide. It enforces the permitted disposition selected during source review; a return-only response cannot be completed with recorded destruction. It does not independently observe the stockroom. A real deployment needs appropriate organizational verification and controls. We describe the receipt as a response record, not certified physical proof.

## Can someone just enter false quantities?

Software cannot prevent every false report. It can validate input, expose inconsistent accounting, retain a history of recorded actions, and support review. The current service associates actions with an authenticated account and checks the workspace revision before saving. Shared organizational roles and verification responsibilities would make that accountability stronger. We must not imply the demo has controls that are not implemented.

## What is in scope for this MVP?

A synthetic recall-response workflow: review scope, import stock, match supported identifiers, investigate exceptions, record the response, reconcile quantities, and export a receipt. The final demo and test report establish which paths work. Real patient data, autonomous clinical decisions, and claims of regulatory compliance are outside the demonstrated product.

## How have you validated it?

Engineering validation and customer validation are different. We can show forty-eight passing core tests and a working synthetic walkthrough for implemented behavior. We have not yet performed a clinical study or established customer demand. The next step is a supervised historical-notice pilot with predetermined workflow measures.

## What would a pilot measure?

Time from notice review to stock reconciliation; the proportion of relevant stock records resolved; incorrect matches and missed matches against a manually reviewed reference; completeness of the response receipt; and operator effort. Patient harm reduction would require a different and much stronger study.

## Is it production ready?

It is a tested hackathon MVP. The current build includes Sites authentication and individual account-scoped persistence in Cloudflare D1. A production service still needs organizational roles, group access controls, backup and recovery procedures, retention policies, independent security testing, and organization-specific review. We would not present the demo as a certified clinical or compliance system.

## What data do you collect?

The demonstrated workflow uses synthetic product, lot, location, quantity, and response records. Signed-in workspace records persist on the server in Cloudflare D1, scoped to that individual account; this is not a local-only tool or a shared clinic-group workspace. It does not need patient names, diagnoses, or medical histories. Real clinic inventory and staff activity can still be sensitive operational information and need appropriate access and retention controls.

## What is the scaling strategy?

First standardize a small set of stock-import and response workflows across a few clinic groups. Then add distributor-specific imports and integrations only when a pilot shows recurring value. The matching work is computationally simple; adoption, identifier quality, and onboarding are more likely to be the difficult scaling problems.

## What is the biggest risk?

Poor identifier quality and insufficient demand. A clinic may lack usable lot records, or its existing process may already be good enough. The product must surface the first problem rather than hide it, and discovery must test the second before scaling.

## What did Shivam contribute, and was AI used?

Shivam is the project creator and provided the product direction and requirements for an end-to-end, commercially grounded healthcare project. The project used substantial AI assistance for research, software implementation, testing, and drafting. We disclose that directly and do not claim manual work, customer interviews, or clinical validation that has not occurred.

## Why should this win?

It takes a recognizable healthcare operations problem and demonstrates a complete response workflow. Its strongest design choice is treating uncertainty as work to resolve. The proposal also has a specific buyer hypothesis and a measurable pilot plan. The judges can inspect the implementation, reproduce the demo, and assess the limits of the claims.

## Evidence for preparation

- [FDA: What is a medical device recall?](https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/what-medical-device-recall)
- [FDA historical recall record Z-2614-2026](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRES/res.cfm?id=220342) — a workflow reference, not an active instruction for the synthetic demonstration. Its August 7 response deadline is historical.
- The product must not imply endorsement by FDA, GS1, a clinic, or a distributor.
