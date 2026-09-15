# Product and business case

## Focus

Initial users: operations and stockroom staff in small US clinic groups. Initial buyer hypothesis: the operations lead. A medical distributor could sponsor clinic access when better response evidence reduces its own follow-up effort. These are hypotheses, not validated customers.

Lotline targets the work after a recall notice: identify affected stock, surface missing identifiers, record source-permitted action, reconcile quantities and preserve the response record. It avoids patient data and clinical decision-making in its first version.

## Competitive reality

Staritas now includes ECRI’s former recall-management business. Historical ECRI materials document supply alerts and response tracking. GHX offers inventory and supply-chain tools; capabilities depend on the product and region. See the dated source boundaries in [SOURCES.md](SOURCES.md). Lotline does not claim to invent recall management. Its proposed wedge is a small, low-friction workspace for groups working from basic stock exports, with missing identifiers and closure conditions made explicit. No competitor price or feature absence is asserted without evidence.

## Pricing experiment

Test **$99 per clinic group per month for up to three sites**, then **$19 per additional site**. A five-site group would pay $137/month under this proposed model. This is an unvalidated experiment, not an offered contract or established willingness to pay.

Break-even labor example, all assumptions: at $30/hour loaded staff cost, $99/month requires 3.3 hours/month of saved work. With six relevant response tasks a month, that is 33 minutes/task. Sparse recall frequency, onboarding effort and support can make the value insufficient. Test distribution-sponsored pricing if direct site economics fail.

The core workflow has no per-action LLM charge. Optional FDA lookup uses the public API within its published limits. Hosted platform limits and support costs still apply; free development does not imply zero cost to operate a business.

Illustrative monthly contribution at 50 three-site groups: revenue 50 × $99 = $4,950. If allocated infrastructure is $100, and 20 minutes of support per group costs $30/hour, contribution before sales/founder labor, tax and overhead is $4,350. At two support hours per group, the same contribution falls to $1,850. These are sensitivity scenarios, not forecasts or measured margins.

## Four-week validation plan

1. Interview 5 clinic operations leads and 3 distributor recall staff. Ask them to walk through a recent response and show redacted artifacts; avoid pitching first. Record time, incomplete fields, handoffs, systems and budget ownership.
2. Recruit 3 willing clinics for an offline supervised historical/synthetic exercise. No live inventory decisions or patient data. Obtain written consent for any data use.
3. Compare current process and Lotline on the same pre-adjudicated cases, randomizing order where practical. Report participant count, case count, time distributions and error categories, not just averages.
4. Benchmark exact lots, missing identifiers, wrong packaging, conflicting codes, overlapping notices and unsupported range/serial scope. Ground truth must come from a qualified human reviewer. Any unsupported scope must reject or stay manual.
5. Measure median active operator time, unresolved-unit balance, erroneous outside-scope classifications, duplicate movement attempts, completed receipt fields and willingness to continue at the proposed price.

Pilot success targets to test: ≥30% lower median active time with no increase in erroneous clearance and ≥95% required receipt fields completed. Targets are not current results. Stop or narrow the scope if an uncertain item is incorrectly cleared. Choose the final thresholds with the pilot partner before collecting results.

## Growth and defensibility

Start with one clinic group's unglamorous, recurring response work. If it proves useful, add distributor evidence intake and reusable source-scope mappings. An advantage could develop through validated identifier mappings and adopted workflows. Neither a generic LLM wrapper nor a hash chain is a defensible business alone.

## Production gaps

Organizational users and roles; ongoing source amendments; attachment evidence; shared resolution for overlapping recalls; backups and retention; operational monitoring; validated inventory connectors; clinician escalation for already-used stock. These require customer-led scope and safety review. Do not expand into diagnosis to make the demo look more impressive.
