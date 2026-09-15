# Evidence and source boundaries

Research accessed 15 September 2026. Product claims are distinguished from proposed benefits.

- FDA, [What is a medical device recall?](https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/what-medical-device-recall): recalls can involve removal or correction. Lotline's first version handles human-approved unused-stock removal only.
- FDA, [Recalls, Corrections and Removals](https://www.fda.gov/medical-devices/postmarket-requirements-devices/recalls-corrections-and-removals-devices): source guidance discusses consignee action and effectiveness checks. This does not make a Lotline completion record regulatory termination.
- FDA, [historical recall Z-2614-2026](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRES/res.cfm?id=220342): real example requiring inventory search, quarantine, communication, response and return. The notice's original return deadline was 7 August 2026 and is past. It is a reference example, not an instruction for the synthetic demo.
- [openFDA device recall API](https://open.fda.gov/apis/device/recall/): source for optional exact-reference lookup. The UI displays retrieval and dataset timestamps and requires current manufacturer-source review.
- [openFDA authentication and limits](https://open.fda.gov/apis/authentication/): public limits apply, including keyless request limits. The main workflow does not depend on the API being available.
- [Staritas](https://staritas.com/) now includes ECRI’s former recall-management business; see [ECRI’s transition announcement](https://home.ecri.org/pages/announcement). [Historical ECRI workflow evidence](https://home.ecri.org/blogs/ecri-news/ecri-announces-recipients-of-2023-alerts-impact-award) establishes an existing commercial category. Historical features should not be treated as a verified current feature list or price.
- [GHX](https://www.ghx.com/): established healthcare supply-chain vendor; direct vendor documentation informs competitive research. No claim of identical scope or verified pricing.
- [GS1 General Specifications](https://ref.gs1.org/standards/genspecs/): identifier conventions. Lotline implements a small explicitly supported GS1 text subset, not scanner certification.

## A useful source-data caution

The historical FDA record prints individual GTIN `00382903029952` and box GTIN `30382903029952`. The former passes the standard GTIN check digit; the latter does not. Lotline rejects the invalid checksum and asks for physical-label/source verification. It does not silently “correct” the official record. The tests use a separately labeled valid synthetic packaging GTIN when checking normalization.

## Claims not made

No measured reduction in patient injury, commercial revenue, confirmed willingness to pay, proprietary algorithm, universal barcode compatibility, authoritative real-time recall coverage, official-template compliance, or clinical/regulatory approval.
