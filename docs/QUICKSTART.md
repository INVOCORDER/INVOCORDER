
# Three-Second Quickstart

## Try it without configuring anything

```bash
npx --yes @invocorder/recorder@2.1.0 quickstart
```

This creates:

* a complete evidence session
* a hash-chained replay bundle
* an integrity result
* a readable local HTML report

## Record a real command

```bash
npx --yes @invocorder/recorder@2.1.0 capture -- npm test
```

## Read the latest result

```bash
npx --yes @invocorder/recorder@2.1.0 show latest
```

## Rebuild the readable report

```bash
npx --yes @invocorder/recorder@2.1.0 report latest
```

## Verify the replay bundle

```bash
npx --yes @invocorder/recorder@2.1.0 verify latest
```

## Check the installation

```bash
npx --yes @invocorder/recorder@2.1.0 doctor
```

No account is required.

No hosted service is required.

No source-code change is required.
