import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractText, getDocumentProxy } from 'unpdf';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Ensure the column exists (safe to run multiple times)
    await db.query(`
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS discharge_summary TEXT;
    `);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Parse the PDF in memory using unpdf (Edge/Node compatible, no canvas deps)
    const buffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });

    // Truncate to ~800 words to keep within AI token limits
    const words = text.split(/\s+/).filter(Boolean).slice(0, 800);
    const summary = words.join(' ');

    await db.query(
      `UPDATE patients SET discharge_summary = $1 WHERE id = $2`,
      [summary, id]
    );

    return NextResponse.json({ success: true, wordCount: words.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
