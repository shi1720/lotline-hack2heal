export const dynamic = 'force-dynamic';
export async function GET() {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
  const appId = process.env.FIREBASE_WEB_APP_ID;
  if (!apiKey || !projectId || !authDomain || !appId) return Response.json({error:'Sign-in configuration is unavailable.'},{status:503});
  return Response.json({apiKey, projectId, authDomain, appId,
    // Explicit local emulator support, never enabled in a deployed service.
    emulator: !process.env.K_SERVICE ? process.env.FIREBASE_AUTH_EMULATOR_HOST : undefined,
  },{headers:{'Cache-Control':'no-store'}});
}
