# Lotline — three-minute demo

**Read the quoted narration verbatim. Do not speak the screen directions.** 301 spoken words. Use the seeded fictional evaluation. The twelve units with no recorded lot are the turning point. Record the full sequence; shorten repetitive typing in the edit while preserving the actual results.

## Prepare once

1. Sign in and open a clean evaluation: 64 affected, 12 needing verification, 30 outside scope. All quantities refer to the synthetic fixture.
2. Confirm the source view shows catalog `LL-SYR-10`, lot `SY2608-A`, and return to the fictional supplier.
3. Copy the demonstration evidence text below into a scratch document so entry is quick. These are explicitly fictional records for the video, not evidence of real handling.
4. Rehearse the six actions—quarantine then return for each stock row of 40, 24, and 12 units. Reset to the clean evaluation before recording.
5. Record at desktop resolution with the fictional-data label visible. Hide notifications. Speak at about 130 words per minute and pause for state changes.

## 0:00–0:25 — Twelve units without an answer

**Screen:** Show the overview. Point first to 64 affected, then 12 needing verification, then the missing-lot row.

> A recall reaches a clinic. Sixty-four units match. But twelve more have no recorded lot. Are those twelve affected, or simply unknown?
>
> I’m Shivam Gupta. This is Lotline, a recall-response workspace built around one question: can we account for every potentially affected unit?

## 0:25–0:50 — Review the source

**Screen:** Click **View source notice**. Show the fictional notice, catalog, lot, and permitted return action. Close the source view.

> This is synthetic training data, with no patient information. We start from a human-reviewed notice: one product scope, exact lots, and the permitted disposition.
>
> The source says return. Lotline enforces that choice. It will not accept destruction as completion of a return-only response.

## 0:50–1:20 — Resolve the twelve

**Screen:** On the 12-unit row click **Verify label**. Set **Lot number** to `SY2608-A`. Enter verification evidence: `SIMULATED label check: all 12 individual packages show SY2608-A.` Click **Save verified label**. Pause on **76 affected** and **0 needing verification**.

> Those twelve units stay unresolved until someone verifies their labels. For this demonstration, we record a simulated check: the labels show the affected lot.
>
> Watch the totals change. We now have seventy-six affected units and zero needing verification. Missing information never became an automatic all-clear. It became a task with a recorded answer.

## 1:20–2:05 — Record what happened

**Screen:** On the 40-unit row select **Record action**, choose **Quarantine / segregate**, enter quantity 40 and the evidence below, then **Save action**. Next select **Record return**, choose **Returned to supplier**, enter 40 and the return evidence, then **Save action**. Repeat for the 24-unit and 12-unit rows. Show the final total of 76 accounted for. Edit repetitive typing for pace; do not replace the real state changes with animations.

> Next, we record quarantine and then return. Quantities must balance. We cannot record more stock than exists, or return more than has been quarantined.
>
> We follow the same sequence for forty, twenty-four, and twelve units. Each action has a supporting reference. These are reported actions in a fictional exercise, not independent proof that real stock moved.

## 2:05–2:35 — Complete and inspect the evidence

**Screen:** Select **Complete response**. Enter the final review text below in **Final review record**, check the attestation box for the fictional exercise, and choose **Complete and lock response**. Open **Evidence packet**, briefly show **Download evidence JSON**, **Export stock CSV**, and **Print / save PDF**. Open **Activity** to show the recorded history.

> With all seventy-six units accounted for, we can complete the final review and lock this local response. That does not terminate a regulatory recall.
>
> The evidence packet contains the scope, stock, recorded actions, and activity history. We can export the evidence, stock CSV, or a printable record.

## 2:35–3:00 — The business experiment

**Screen:** Return to the completed overview. End with the product name and creator credit.

> The first buyer hypothesis is a small US clinic group. Our pricing experiment is ninety-nine dollars monthly for up to three sites, plus nineteen per additional site. Willingness to pay is unvalidated.
>
> Forty-eight core tests support this MVP. Next comes a supervised pilot measuring response time and stock accounting.
>
> Lotline: every affected unit, every unresolved question, one reviewable response.

## Exact demonstration evidence

| Record | Quarantine evidence | Return evidence |
|---|---|---|
| 40 units | `SIMULATED: 40 Riverside units segregated in training hold Q-001.` | `SIMULATED supplier return receipt R-001: 40 Riverside units.` |
| 24 units | `SIMULATED: 24 Hillview units segregated in training hold Q-002.` | `SIMULATED supplier return receipt R-002: 24 Hillview units.` |
| 12 units | `SIMULATED: 12 verified Hillview units segregated in training hold Q-003.` | `SIMULATED supplier return receipt R-003: 12 verified Hillview units.` |

**Final review record:**

`SIMULATED final review: 76 affected individual units are recorded as quarantined and returned. All four stock records and both fictional locations reviewed; no unresolved records remain. Thirty units are outside this reviewed scope. Training exercise only.`

## Recording notes

The final script assumes the supplied clean fixture and current controls. If the build changes, rehearse again. Do not upload real patient or clinic records. Signed-in workspaces persist server-side under the individual account; reset only the evaluation intended for this recording.

No clinical outcome or time-saving claim is made. The counts demonstrate inventory accounting, not validation on real products. The product records operator statements and references; the video should not imply certified physical proof.

**Suggested end card:**  
Lotline · Every unit needs an answer.  
Shivam Gupta · Hack2Heal 2.0  
Synthetic demonstration · AI-assisted development
