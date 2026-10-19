# Synthetic NCA SDK / NCALayer prototype

R7.6.3.1, 2026-10-19. **SCOPED PASS / overall phase PARTIAL**, not a production verifier.
No application API, database, real document or NCALayer configuration is changed.
Only the supplied public SDK test fixtures may be used. Private keys, passwords,
SDK binaries and generated evidence stay outside Git.

## Latest negative evidence, 19.10 22:03

`node scripts/nca-prototype/run.mjs negative-evidence` passes six checks on
Windows (`negative-evidence-2026-10-19T17-02-34-158Z.json`) and Linux
(`linux/negative-evidence-2026-10-19T17-02-58-318Z.json`). It requires the same
SDK test password and existing synthetic `original.txt` as the offline mode.
No external service is contacted by this mode; its ephemeral HTTP server binds
only to loopback and is stopped in `finally`.

The SDK 2024–2025 head certificate is actually expired (29.10.2025), without
clock injection. Both its validity check and Kalkan verification of a CMS made
with that fixture reject expiry. `createCAdES` alone permits creation: signing
success is not verification success. HTTP503 from CRL/OCSP and malformed HTTP200
responses cannot produce a successful check. Exceptions are checked by type;
the SDK CRL parser's null result is explicitly rejected before use.

These are controlled transport faults through real SDK parsers, not evidence
of an actual NCA outage or production fallback/retry policy. Timeout, OCSP UNKNOWN
and production recovery are not certified. The first two Windows attempts failed
because expected SDK exceptions/operation boundaries were incorrect; the third
passed after isolating rejection to `verifyCMS`. Linux passed on its first run.

Regression: Windows live CRL/OCSP 3 PASS (`17-02-21-926Z`), NCALayer receipts
4 PASS (`17-02-35-657Z`); Linux TSP 9 PASS (`17-03-03-138Z`), all exit0.
These results supersede the unavailable-revocation and actual-expiry coverage
gaps below. Desktop prototype scope is demonstrated; overall R7.6.3.1 remains
PARTIAL because mobile API access/contract and actual mobile evidence are absent.
Production adapter, authority model and UI belong to the dependent phases.

## Latest TSP result, 19.10 21:57

Issuer revocation blocker resolved using the [official RCA CRL directory](https://crl.root.gov.kz/),
which publishes the test RSA2020 CRL at
`https://crl.root.gov.kz/test_rsa2020.crl`. The test profile uses this explicit
override for the broken distribution point in the issuer certificate. Trust
still comes exclusively from the hash-pinned SDK root; the downloaded CRL must
verify with that root and pass issuer, thisUpdate, nextUpdate and revocation checks.
Observed validity: 2026-10-02T05:05:43Z to 2026-11-06T05:05:43Z.

`verify-timestamp-evidence-2026-10-19T16-56-09-936Z.json` (Windows) and
`linux/verify-timestamp-evidence-2026-10-19T16-56-26-849Z.json` each contain nine
PASS, exit0. These include trusted chain, TSA OCSP GOOD, issuer CRL GOOD,
stale CRL rejection, wrong imprint and corrupted timestamp rejection. This was
the third issuer-revocation attempt, justified by a newly found official source.
The known TSP blocker is closed. Remaining prototype coverage limitations
(e.g. unavailable-revocation fixture and validity-date injection), production
adapter/authorization/UI and mobile are not certified by these scoped results.
The 21:54 diagnosis below is retained as history, superseded by this result.

### Diagnosis at 21:54

The earlier assertion that the RSA test root was absent from the entire SDK was
incorrect: it is absent from the Java trust store/main CA directory, but present
in `C/Linux/ca-certs/ca-certs_old/test.zip`. This archive from the owner's supplied
official SDK contains both the current RSA2020 test root and RSA TEST issuer.
Archive SHA256: `622b758f00d957a215dcfb895a549b86d3adcadf08cc5e548fb49a20323c77b9`.
Root DER hash matches the previously downloaded candidate exactly; issuer DER
SHA256: `5b92d85a88fdeee7ccdb06771d82fa1faae3de87839edb368ea1ac07fca04f2a`.
The harness now loads those exact, hash-pinned archive entries as test-only trust.
No AIA download, OS trust store or NCALayer configuration supplies this trust.

`verify-timestamp-evidence-2026-10-19T16-51-45-043Z.json`: seven checks PASS,
including the formerly failing trusted chain and current TSA OCSP GOOD.
The expanded gate `verify-timestamp-evidence-2026-10-19T16-52-24-361Z.json`
adds corrupted timestamp rejection (PASS) and issuer revocation (FAIL):
eight PASS, one FAIL. The issuer's signed CRL distribution point is
`http://test.pki.gov.kz/crl/root_rsa_test.crl`, which returns404. The published
directory index lists only NCA-level CRLs; it is saved as `test-crl-index.html`.
A bounded diagnostic to the known test OCSP endpoint for that issuer returned
`OCSPException: Unsuccessful request. Status: 1` (not GOOD). No further probes
were made without a new supported endpoint. This is a separate external
revocation blocker, not the original missing-root error.

The full timestamp decision therefore remains INDETERMINATE pending a valid,
root-signed fresh CRL for the RSA intermediate or a working authenticated OCSP
response. Current root provenance and TSA leaf revocation are now established.
The common CRL helper regression passed all three existing revocation checks:
`revocation-2026-10-19T16-53-38-740Z.json`. SDK/Windows/Linux evidence otherwise
remains scoped as recorded. No SDK request or support message was sent.
Historical missing-root conclusions below are superseded by this section.

## Linux / WSL preparation, 19.10

**Latest result, 21:48: Linux runtime SCOPED PASS.** After the owner's reboot,
WSL3.0.1 was available; Ubuntu was installed successfully (installer exit0).
The actual host is Ubuntu26.04.1 x86_64, kernel
6.18.40.1-microsoft-standard-WSL2. Linux Node24.18.0 and Temurin8u504 were
downloaded from nodejs.org/Adoptium and their SHA256 values verified. They live
only in ignored `.tmp/nca-prototype/linux-runtime/`; system Java/Node was not
replaced. Tests ran as root in the new WSL distribution, not a deployed service.

`run-linux.sh`: offline11 PASS, both NCALayer receipts4 PASS, live CRL/OCSP3 PASS;
all modes exit0 on their first Linux attempt. Summary with hashes and manifest
names: `.tmp/nca-prototype/linux/summary.json`. SDK/SLF4J artifact hashes and
original/signer/receipt hashes match the Windows evidence. The blocked TSP gate
was not repeated. This closes standalone Linux compatibility, not production
deployment or TSP trust. Installation history below is superseded by this result.

Update 21:25: installation was subsequently authorized and launched by the agent
with Windows RunAs. CBS confirms VirtualMachinePlatform installed successfully
at 21:17:39 (HRESULT0), with reboot required. Full WSL/Ubuntu installation has
not yet returned a result. Save work and restart Windows, then inspect WSL and
the distribution state before retrying installation. Diagnostic evidence is
`.tmp/nca-prototype/wsl-diagnostic.txt`. No automatic reboot was performed.
The preflight and manual installation instructions below describe the initial
state; do not start a duplicate installer while the current one remains active.

Host preflight: Windows build22631, no installed WSL package/distribution,
Docker/Podman unavailable, current process not elevated. Linux execution remains
BLOCKED on host setup, not a failed cryptographic test. Owner authorized Linux
verification. In an Administrator PowerShell run the official installation:

```powershell
wsl --install -d Ubuntu --no-launch
```

Restart Windows only when installation requests it and after saving work, then
launch Ubuntu and complete its initial user setup. This installation/restart
has not been performed by the agent. See [Microsoft WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install).

Once Linux is available, provision Linux Node.js and Linux JDK8 (Windows binaries
are not valid Linux evidence), then run from the same mounted canonical checkout:

```bash
cd /mnt/c/Users/user/Desktop/dentmarket-kz-main
export NCA_SDK_ROOT='/mnt/c/Users/user/Downloads/SDK/SDK/SDK/SDK/SDK 2.0'
export NCA_JAVA_HOME='<Linux JDK8 directory>'
# Set NCA_TEST_KEY_PASSWORD locally from the public SDK README.
bash scripts/nca-prototype/run-linux.sh
```

The script checks the Linux host and Linux Node/JDK, copies only synthetic
browser receipts, then runs offline, browser and CRL/OCSP verification. Sources remain
in the canonical checkout. Linux classes/dependencies/manifests/evidence use
`.tmp/nca-prototype/linux/` so existing Windows evidence is preserved.
TSP is deliberately a separate gate after resolving trusted-root input.
Validation so far: `node --check run.mjs`, `bash -n run-linux.sh` PASS; invocation
under Windows Git Bash correctly refuses execution (exit1). This is not a Linux
runtime PASS. Next step is host WSL installation, then runtime provisioning and
actual offline/browser checks with matching SDK hashes.

## Reproduce

Requirements: Node.js, supplied SDK 2.0, JDK 8, SLF4J API and Simple 1.7.36.
The runner validates the two Maven dependency SHA256 values before execution.
It records SDK artifact hashes, source hash, Java version, checks and evidence
hashes in `.tmp/nca-prototype/<mode>-<timestamp>.json`. The evidence list is a
directory snapshot, not proof that every listed file was created by that run.
Commands below are PowerShell, from the canonical repository root:

```powershell
$env:NCA_SDK_ROOT='<path to SDK 2.0>'
$env:NCA_JAVA_HOME='<path to JDK 8>'
$env:NCA_DEPENDENCIES='<directory containing the two SLF4J jars>'
# Set NCA_TEST_KEY_PASSWORD locally from the SDK test README; do not commit it.
node scripts/nca-prototype/run.mjs offline
node scripts/nca-prototype/run.mjs online
node scripts/nca-prototype/run.mjs inspect-timestamp
node scripts/nca-prototype/run.mjs verify-browser
node scripts/nca-prototype/run.mjs verify-timestamp-evidence
node scripts/nca-prototype/browser.mjs
```

`offline` creates a detached GOST CMS over the fixed synthetic text.
`online` requires that original and contacts only test.pki.gov.kz CRL/OCSP/TSP.
`inspect-timestamp` reads the previously saved timestamp CMS without a network
request or signing key. Java subprocesses have a 60-second time budget.
Do not repeat failed gates blindly: the project maximum of three attempts applies
across commands and sessions. The initial online cycle has exhausted that limit.

The browser page is http://127.0.0.1:4079. Select only the test key path shown
there in NCALayer, then separately exercise cancellation. It requests detached
CMS without TSP; the independent TSP gate is still failed. Receipts are saved
under `.tmp/nca-prototype/evidence/ncalayer-*.json`; a saved response alone does
not mean its CMS was independently verified. Stop the local server with Ctrl+C.

## Observed results, Windows / JDK 8u504

| Evidence | Result | Limits |
| --- | --- | --- |
| `offline-3.log` | 11 PASS | SDK-direct signing, not NCALayer |
| `online-3.log` | CRL + good/revoked OCSP PASS; TSP FAIL | `ISSUER_CERT_NOT_FOUND` |
| `inspect-timestamp-2026-10-19T10-11-28-514Z.json` | Runner/compilation/inspection exit 0 | No crypto gate rerun; no checks in this diagnostic mode |
| Browser signing | Two receipts, four checks PASS on 19.10 | Original, expected test signer/role/BIN/chain, modified-byte rejection |
| Browser cancellation | Captured at 16:07:40 UTC | `status:true, body:{}`; no CMS, client refuses success |
| Linux runtime | 18 PASS, first run | Ubuntu26.04.1 / WSL2 / Linux JDK8u504; not production deployment |

Offline checks cover original CMS, byte mutation, malformed CMS, current test
chain, empty trust rejection, validity boundaries, head EKU, employee-as-head
rejection, wrong expected BIN and missing mandatory timestamp. Validity boundary
cases inject a test date; they do not use an actually expired signing fixture.
The BIN/role checks are prototype assertions, not application authorization.

The timestamp signature/imprint steps precede the failed chain check. Its issuer
is RSA TEST, unlike the GOST signing fixture. The bundled test trust store did
not complete that chain. AIA advertises `nca_rsa_test.cer` and then
`root_rsa_test.cer`; fetching a root is not sufficient grounds to trust it.
Next step: establish the current official test RSA trust chain/provenance and
approve a new bounded verification cycle. TSA revocation and negative timestamp
imprint evidence remain unproven. Never downgrade this failure to PASS.

Attempt history: offline 1 failed at provider overload; offline 2 at an empty
CRL list incorrectly used for a chain-only check; offline 3 passed after those
fixes. Online 1 failed PowerShell JVM-option parsing; online 2 and 3 failed TSA
chain discovery. Revocation is explicitly separate from chain-only validation.

SDK utility 0.8.5 `CMSUtil.getX509Certificates(cms, provider)` was observed to
recurse into itself; this harness avoids that helper. The browser response
envelope was captured as `body.result: [PEM]`. The application client now accepts
this single-CMS array, strips PEM into base64 and rejects malformed/multiple
results. Legacy top-level result handling is preserved. Targeted tests, package
types/lint and the supplier signing helper's tests passed.

## Follow-up 19.10: received browser signatures and TSP diagnosis

`verify-browser-2026-10-19T16-03-21-530Z.json` verifies both captured NCALayer
responses (16:01:10 and 16:01:34 UTC), independently through Kalkan. Four checks
PASS; this is genuine NCALayer evidence, without a timestamp in those requests.
`verify-browser` reads saved response JSON, validates the envelope/PEM and writes
DER CMS next to each receipt; Java checks the trusted original and expected
test certificate. It needs no private key or network.

`verify-timestamp-evidence-2026-10-19T16-05-28-625Z.json` records five PASS
(CMS original, timestamp signature/imprint, wrong imprint rejection, TSA EKU/date,
candidate-chain signatures), one trusted-chain FAIL. This is attempt 1 of the
new diagnosis cycle authorized by the owner; it reuses the saved timestamp.
Candidate-chain signatures are not trust acceptance. Both SDK 0.8.5 and the
installed NCALayer utils 0.9.2 bundle contain older RSA test roots, with different
public keys from the candidate. No trust store was changed.

The issuer AIA root path under `/crl/` returns 404. The candidate is available at
`http://test.pki.gov.kz/cert/root_rsa_test.cer`, SHA256
`1778a7639bcbf3333e7a83461d1e126bff46a0f74b73d3345356540dad138b11`.
HTTPS requests for root and issuer each timed out after 20 seconds. A historical
[official forum exchange](https://forum.pki.gov.kz/t/0x8f00038-get-pki-data-properties-failed/1819)
identifies that endpoint, but does not authenticate today's file bytes.
Trust remains INDETERMINATE. Required external input: current test RSA root and
issuer from an authenticated SDK update, or their fingerprint confirmed by NCA.
Suggested technical support question: confirm the SHA256 above for TEST_2020(RSA),
the current RSA TEST issuer (2023–2028), and the intended authenticated download
and TSA revocation endpoints. No message has been sent.

Full acceptance still requires completed timestamp/trust/revocation policy,
remaining required negative cases. Linux standalone runtime is now verified; the production adapter,
authority model, transactional persistence and product UI belong to later steps.

Cancellation follow-up: the first cancel-labelled receipt at 16:06:32 contained
a signature, so it was not counted as cancellation. After the owner's second
manual cancellation, the 16:07:40 receipt contained `status:true, body:{}`.
Success therefore requires a CMS result, not merely the status flag. A targeted
regression rejects this empty response (`SIGNATURE_MISSING`); final client suite
10 PASS, types/lint PASS. The test page now distinguishes presence of CMS from
the status flag. Manual server can be stopped once receipts are captured.
