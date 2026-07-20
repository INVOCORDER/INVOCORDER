
# Readable Evidence Reports

INVOCORDER creates a self-contained local HTML report for every `capture` command.

```bash
invocorder capture -- npm test
```

The report includes:

* integrity state
* command
* exit code
* duration
* record count
* omission count
* file-effect count
* boundary timeline
* file-effect table
* session and bundle paths

The report intentionally excludes raw captured payloads by default.

This keeps the first human-readable surface useful without turning the report into an uncontrolled content mirror.

Generate or regenerate a report:

```bash
invocorder report latest
invocorder report latest --out evidence/npm-test.html
```

Machine-readable result:

```bash
invocorder report latest --json
```
