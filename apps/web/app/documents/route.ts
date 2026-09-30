// Legacy links do not identify a workspace. Login resolves verified membership.
export function GET() {
  return new Response(null, { status: 307, headers: { Location: "/login?returnTo=%2Fdocuments" } });
}
