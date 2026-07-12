export interface ProcessExitCapture {
  exit_code: number | null;
  signal: NodeJS.Signals | null;
  spawn_error: string | null;
  succeeded: boolean;
  interrupted: boolean;
}

export function normalizeProcessExit(input: {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  spawnError?: Error | null;
}): ProcessExitCapture {
  return {
    exit_code: input.exitCode,
    signal: input.signal,
    spawn_error: input.spawnError
      ? input.spawnError.message
      : null,
    succeeded:
      input.spawnError == null &&
      input.signal == null &&
      input.exitCode === 0,
    interrupted: input.signal !== null
  };
}
