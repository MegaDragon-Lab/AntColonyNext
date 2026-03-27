import { NextRequest, NextResponse } from 'next/server';

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_KEY!;

const headers = () => ({
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
});

// GET — top 10
export async function GET() {
  const res = await fetch(`${URL}/rest/v1/scores?order=score.desc&limit=10`, {
    headers: headers(),
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data);
}

// POST — guardar score
export async function POST(req: NextRequest) {
  const { name, score } = await req.json();
  if (!name || score === undefined) {
    return NextResponse.json({ error: 'name y score requeridos' }, { status: 400 });
  }
  const res = await fetch(`${URL}/rest/v1/scores`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ name: String(name).slice(0, 20), score: Number(score) }),
  });
  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 201 : 500 });
}
