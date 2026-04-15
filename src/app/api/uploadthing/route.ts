/**
 * @deprecated — UploadThing has been replaced by Firebase Storage.
 * All uploads now go through /api/upload.
 * This route returns 410 Gone so any stale client calls fail clearly.
 */

import { NextResponse } from 'next/server';

export function GET()  { return NextResponse.json({ error: 'UploadThing removed. Use /api/upload.' }, { status: 410 }); }
export function POST() { return NextResponse.json({ error: 'UploadThing removed. Use /api/upload.' }, { status: 410 }); }
