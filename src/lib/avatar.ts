/**
 * Helper to proxy Google, GitHub, and Facebook user profile photos.
 * Bypasses cross-origin referrer restrictions and CSP blocks.
 */
export function getProxiedAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const isThirdParty =
    url.includes('googleusercontent.com') ||
    url.includes('githubusercontent.com') ||
    url.includes('facebook.com') ||
    url.includes('fbcdn.net');

  if (isThirdParty) {
    return `/api/user/avatar?url=${encodeURIComponent(url)}`;
  }

  return url;
}
