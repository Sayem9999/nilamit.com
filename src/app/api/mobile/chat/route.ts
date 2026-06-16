/**
 * POST /api/mobile/chat — send a coordination-chat message (Bearer Firebase ID
 * token). Delegates to sendMessageForUser (shared with the web chat action).
 * Body: { conversationId, content, imageUrl? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { sendMessageForUser } from '@/services/chat/chat-core';
import { ErrorType } from '@/lib/errors';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function statusFor(type?: ErrorType): number {
  switch (type) {
    case ErrorType.UNAUTHORIZED: return 401;
    case ErrorType.FORBIDDEN: return 403;
    case ErrorType.NOT_FOUND: return 404;
    case ErrorType.VALIDATION: return 400;
    default: return 400;
  }
}

export async function POST(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!token) return NextResponse.json({ success: false, error: { message: 'Missing bearer token' } }, { status: 401 });

  let uid: string;
  let name: string | null = null;
  try {
    const decoded = await adminAuth.instance.verifyIdToken(token);
    uid = decoded.uid;
    name = (decoded.name as string | undefined) ?? null;
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid or expired session token.' } }, { status: 401 });
  }

  let body: { conversationId?: unknown; content?: unknown; imageUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
  const content = typeof body.content === 'string' ? body.content : '';
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : undefined;
  if (!conversationId || !content.trim()) {
    return NextResponse.json({ success: false, error: { message: 'conversationId and content are required.' } }, { status: 400 });
  }

  try {
    const result = await sendMessageForUser(uid, name, conversationId, content, imageUrl);
    return NextResponse.json(result, { status: result.success ? 200 : statusFor(result.error?.type) });
  } catch (error) {
    log.error('[api/mobile/chat] unexpected failure', error, { uid, area: 'chat', severity: 'warning' });
    return NextResponse.json({ success: false, error: { message: 'Unexpected server error.' } }, { status: 500 });
  }
}
