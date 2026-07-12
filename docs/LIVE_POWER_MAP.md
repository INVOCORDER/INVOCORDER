
# Live ecosystem power map

INVOCORDER exposes a readable map of the public npm and GitHub ecosystem around
the recorder.

Primary artifacts:

* `POWER_PLANE/INVOCORDER_LIVE_ECOSYSTEM_MAP.json`
* `POWER_PLANE/INVOCORDER_PUBLIC_ECOSYSTEM_INVENTORY_RECEIPT.json`

The map binds:

* the native `@invocorder/recorder` product;
* the Verifrax package plane;
* the KAAFFILM package surface;
* the ANTIMATTERIUM package surface;
* the named GitHub organizations;
* every public repository returned for those owners at capture time.

Private repository names are intentionally excluded from the committed public
inventory.

## Commands

```bash
npx invocorder power-map
npx invocorder power-map --all
npx invocorder demo
```

Repository verification:

```bash
npm run power:ecosystem:verify
npm run power:ecosystem:live
```

The live command verifies current npm package and GitHub-owner availability.
The deterministic release gate verifies the committed bounded inventory without
requiring network access.

This map does not claim truth, safety, authorization, admissibility, external
reality, or whole-stack completion.
