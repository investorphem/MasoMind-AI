import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    const action = req.nextUrl.searchParams.get('action');

    if (!url) return new NextResponse("Missing URL", { status: 400 });

    // 🚀 THE FIREWALL BYPASS
    // We must trick Mixkit into thinking this request is coming from their own website
    const remoteRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://mixkit.co/', // This tells Mixkit the request originated from their site
        'Origin': 'https://mixkit.co'
      }
    });

    if (!remoteRes.ok) {
        console.error(`Media firewall blocked request: ${remoteRes.status} ${remoteRes.statusText}`);
        return new NextResponse(`Media provider blocked the request: ${remoteRes.status}`, { status: 403 });
    }

    // Strip their restrictive headers so MiniPay accepts the stream
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

    // Stream the raw byte data back to the frontend
    return new NextResponse(remoteRes.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error("Streaming Proxy Error:", error);
    return new NextResponse("Failed to stream media", { status: 500 });
  }
}

// ---------------------------------------------------------
// POST METHOD (For handling Base64 text downloads)
// ---------------------------------------------------------
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
      const base64Data = fileData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
       return new NextResponse("Invalid format. Expected Base64.", { status: 400 });
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
