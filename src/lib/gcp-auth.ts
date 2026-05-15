import { GoogleAuth } from 'google-auth-library';

let auth: GoogleAuth | null = null;

export async function getAccessToken(): Promise<string> {
  if (!auth) {
    auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
  }
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Failed to get GCP access token');
  return token.token;
}
