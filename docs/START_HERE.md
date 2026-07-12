# Start with INVOCORDER

INVOCORDER records machine-action boundary facts.

When an AI agent, MCP client, browser agent, workflow, desktop agent, tool
runner, or automation touches the world, INVOCORDER can create a hash-chained
record of what crossed that boundary.

## Install

```bash
npm install @invocorder/recorder
````

## Run the easiest demonstration

```bash
npx invocorder demo
```

The demonstration:

1. creates a small MCP-style machine interaction;
2. records every request and response frame;
3. creates hash-chained Machine Action Records;
4. compiles a Replay Bundle;
5. verifies the bundle;
6. prints a readable result.

## Inspect the ecosystem power map

Summary:

```bash
npx invocorder power-map
```

Complete public repository inventory:

```bash
npx invocorder power-map --all
```

From the repository:

```bash
npm run power:ecosystem
npm run power:ecosystem:verify
```

## The mental model

* Something acted.
* INVOCORDER recorded what crossed the boundary.
* A replayable evidence bundle was produced.
* Another system may later assess authority, safety, truth, or admissibility.

INVOCORDER is the recorder. It is not the judge.

## Explicit boundary

A working INVOCORDER package does not mean every adjacent repository, package,
organization, product, or sovereign-stack layer is complete.
