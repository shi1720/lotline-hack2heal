export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({ok:true, product:'Lotline', runtime:'firebase', revision:process.env.LOTLINE_REVISION || 'local'}, {headers:{'Cache-Control':'no-store'}});
}
