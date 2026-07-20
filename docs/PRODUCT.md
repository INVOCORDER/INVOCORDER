# INVOCORDER Product

## The product in one sentence

**Record any command. Get a tamper-evident replay bundle and a readable local report.**

```bash
invocorder capture -- npm test
````

INVOCORDER runs the command normally while recording the machine-action boundary around it.

The command still owns its exit code. INVOCORDER adds evidence.

## What appears immediately

After capture, INVOCORDER prints:

* command
* integrity status
* exit code
* record count
* omission count
* file-effect count
* session directory
* replay-bundle path
* readable HTML report path

## What is recorded

* redacted command and arguments
* bounded stdout and stderr
* normalized exit and signal facts
* created, modified, and deleted files
* hashed environment facts
* redaction records
* omission records
* hash-chained boundary records

## What is produced

```text
.invocorder/sessions/<session-id>/
⃴��⃴�⃴� session.json
⃴��⃴�⃴� records.jsonl
⃴��⃴�⃴� omissions.jsonl
⃴��⃴�⃴� replay-bundle.json
⃴��⃴�⃴� bundle-integrity-result.json
⃴��⃴�⃴� invocorder-report.html
```

## Product commands

```bash
invocorder quickstart
invocorder capture -- npm test
invocorder show latest
invocorder report latest
invocorder verify latest
invocorder doctor
invocorder explain
```

Advanced recording, signing, topology, integration, and public-control commands remain available.

## Boundary

INVOCORDER records machine-action boundary facts and may establish bundle integrity.

It does not decide truth, safety, authorization, admissibility, or external reality.
