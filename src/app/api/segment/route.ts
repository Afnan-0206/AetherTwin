import { NextRequest, NextResponse } from 'next/server';
import { trackBobWithSam3, VideoSegmentationRequest } from '@/lib/meta/samClient';

export const runtime = 'edge';
// Allow larger payloads for short video base64
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VideoSegmentationRequest;

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request: JSON body required.' },
        { status: 400 }
      );
    }

    if (!body.width || !body.height || body.width <= 0 || body.height <= 0 || !body.pivot || !body.initialBobPoint) {
      return NextResponse.json(
        {
          error:
            'Invalid request payload: valid positive width, height, pivot, and initialBobPoint are required.'
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.MODEL_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          demoMode: true,
          message:
            'Meta AI API key (MODEL_API_KEY) is not configured in server environment. The application is running in Demo Mode. Use the built-in synthetic reference sample, or set MODEL_API_KEY in .env.local for live Meta SAM 3.1 video segmentation.'
        },
        { status: 200 }
      );
    }

    if (!body.videoUrl && !body.videoBase64) {
      return NextResponse.json(
        {
          error:
            'Invalid request payload: either videoUrl or videoBase64 must be provided for SAM 3.1 video segmentation.'
        },
        { status: 400 }
      );
    }

    // Call live Meta SAM 3.1 API
    const result = await trackBobWithSam3(body, apiKey);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/segment:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to segment video with Meta SAM 3.1',
        details: error.stack
      },
      { status: 500 }
    );
  }
}
