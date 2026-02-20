const explicitDebugSetting = process.env.DEBUG_SERVER_LOGS?.trim().toLowerCase();

export const isDevLoggingEnabled =
  explicitDebugSetting != null
    ? explicitDebugSetting === '1' || explicitDebugSetting === 'true' || explicitDebugSetting === 'yes'
    : process.env.NODE_ENV !== 'production';

function stamp() {
  return new Date().toISOString();
}

export function devLog(scope: string, message: string, metadata?: unknown) {
  if (!isDevLoggingEnabled) return;
  if (metadata === undefined) {
    console.log(`[DEV][${stamp()}][${scope}] ${message}`);
    return;
  }
  console.log(`[DEV][${stamp()}][${scope}] ${message}`, metadata);
}

export function devError(scope: string, message: string, error?: unknown) {
  if (!isDevLoggingEnabled) return;
  if (error === undefined) {
    console.error(`[DEV][${stamp()}][${scope}] ${message}`);
    return;
  }
  console.error(`[DEV][${stamp()}][${scope}] ${message}`, error);
}
