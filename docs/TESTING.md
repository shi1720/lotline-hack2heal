# Verification

## Automated checks

```sh
npm test
npm run typecheck
npm run build
```

**48 core tests passed** in the recorded local verification. They cover exact assessment, missing/placeholder identifiers, case-only mismatches, manufacturer/GTIN conflicts, GTIN checksum and packaging distinctions, GS1 parsing, CSV quoting and invalid units/quantities, import atomicity, uncertainty/completion gates, permitted disposition, quantity limits, edit locks, 200+ action replay, reused-key payload conflicts, a full 76-unit lifecycle, unsupported scope rejection, formula-safe CSV cells, and byte-bounded/chunked/invalid-UTF8 request handling.

The earlier independent review found three material classes of issue (disposition permissions, unsupported product/lot combinations, and replay expiry). The implemented guards and tests are regressions for those actual findings.

## Browser and API journey

With `npm run dev` already running:

```sh
npx playwright install chromium
npm run test:e2e
```

The test uses loopback development sign-in and **resets that account's practice workspace**. It is deliberately restricted to localhost/127.0.0.1. Do not run it on an evaluation whose records you intend to keep. `LOTLINE_TEST_URL` can select a different loopback port. Live FDA reference lookup requires network access and may fail if the upstream is unavailable. Outputs go to ignored `test-results/`.

The recorded run passed **16 browser/API checks**:

1. Initial completion gate.
2. Source snapshot modal.
3. WebMCP registration, valid input, invalid input and stage behavior in an emulated registry.
4. Label verification updates 12 uncertain units.
5. Persistence after reload.
6. Quarantine and allowed return for 40/24/12 units.
7. Completion at 76/76 and record locking.
8. JSON digest verification and printable report.
9. CSV export.
10. Concurrent writers produce one success and one 409 without double accounting.
11. Unauthenticated and cross-origin request rejection.
12. Malformed and oversized body rejection.
13. Invalid CSV recovery and successful import.
14. Live FDA lookup without automatic scope approval.
15. 390px mobile layout and label form.
16. No page runtime errors.

Local migrations were also applied twice to a fresh temporary D1 store: the first application succeeded and the second correctly found nothing to apply.

## What these checks do not establish

No patient outcome, clinical safety, customer ROI, native WebMCP browser availability, regulatory compliance, or two-real-user hosted identity isolation was tested. The current system is an evaluation MVP, not an approved live clinical workflow. Hashes are consistency evidence rather than a digital signature.
