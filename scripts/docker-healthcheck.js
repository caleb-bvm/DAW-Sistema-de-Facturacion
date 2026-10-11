// Liveness only: SQL Server and SMTP are checked separately during deployment.
const basePath = (process.env.APP_BASE_PATH || '').replace(/\/$/, '');
try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}${basePath}/`, {
    redirect: 'error',
    signal: AbortSignal.timeout(4000),
  });
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('Unexpected HTTP response');
  }
  await response.arrayBuffer();
} catch {
  console.error('La aplicación no responde al chequeo HTTP.');
  process.exitCode = 1;
}
