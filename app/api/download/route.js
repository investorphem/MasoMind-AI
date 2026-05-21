import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    const action = req.nextUrl.searchParams.get('action');

    if (!url) return new NextResponse("Missing URL", { status: 400 });

    // 🚀 FIX: Spoof a real Chrome browser so Mixkit doesn't block Vercel
    const remoteRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    if (!remoteRes.ok) {
        throw new Error(`Media provider blocked the request: ${remoteRes.status}`);
    }

    const headers = new Headers(remoteRes.headers);
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    let ext = '.bin';
    const contentType = headers.get('content-type') || '';
    if (contentType.includes('audio')) ext = '.mp3';
    if (contentType.includes('video')) ext = '.mp4';
    if (contentType.includes('image')) ext = '.png';

    if (action === 'download') {
      headers.set('Content-Disposition', `attachment; filename="MasoMind-Asset${ext}"`);
    } else {
      headers.set('Content-Disposition', 'inline');
    }

    return new NextResponse(remoteRes.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error("Streaming Proxy Error:", error);
    return new NextResponse("Failed to stream media", { status: 500 });
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const fileData = formData.get('fileData');
    const fileType = formData.get('fileType') || 'MEDIA';

    if (!fileData) return new NextResponse("Missing file data", { status: 400 });

    let buffer;
    let ext = 'jpg';
    let mime = 'image/jpeg';

    if (fileType === 'MUSIC') { ext = 'mp3'; mime = 'audio/mp3'; }
    if (fileType === 'VIDEO') { ext = 'mp4'; mime = 'video/mp4'; }

    if (fileData.startsWith('data:')) {
      // Handle standard AI Base64 generations
      const base64Data = fileData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else if (fileData.startsWith('http')) {
      // 🚀 FIX: If the Library accidentally POSTs a URL, catch it and fetch it anyway
      const response = await fetch(fileData, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
       return new NextResponse("Invalid format", { status: 400 });
    }

    const headers = new Headers();
    headers.set('Content-Type', mime);
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Content-Disposition', `attachment; filename="MasoMind-${fileType}-${Date.now()}.${ext}"`);

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error("POST Proxy Error:", error);
    return new NextResponse("Failed to process download", { status: 500 });
  }
}
