import { NextRequest, NextResponse } from 'next/server';
import { generateMuseSparkDiagnosis, MuseSparkDiagnosisInput } from '@/lib/meta/museSparkClient';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MuseSparkDiagnosisInput;

    if (!body || typeof body !== 'object' || !body.parameters || !body.metrics) {
      return NextResponse.json(
        { error: 'Invalid payload: parameters and metrics are required.' },
        { status: 400 }
      );
    }

    if (
      typeof body.parameters.omega0Sq !== 'number' ||
      isNaN(body.parameters.omega0Sq) ||
      typeof body.parameters.damping !== 'number' ||
      isNaN(body.parameters.damping)
    ) {
      return NextResponse.json(
        { error: 'Invalid payload: parameters must contain valid numeric omega0Sq and damping.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.MODEL_API_KEY;
    const result = await generateMuseSparkDiagnosis(body, apiKey);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/diagnose:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate diagnostic reasoning',
      },
      { status: 500 }
    );
  }
}
