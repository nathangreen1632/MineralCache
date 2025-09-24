type Level = 'info' | 'warn' | 'error';

function emit(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const entry = { ts: new Date().toISOString(), level, event, ...fields };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

export const logInfo = (event: string, fields?: Record<string, unknown>) => emit('info', event, fields);
export const logWarn = (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields);
export const logError = (event: string, fields?: Record<string, unknown>) => emit('error', event, fields);
