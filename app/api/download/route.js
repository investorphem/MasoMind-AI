import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    const action = req.nextUrl.searchParams.get('action');

    if (!url) return new NextResponse("Missing URL", { status: 400 });

    // 🚀 BYPASS THE FIREWALL - Real browser headers
    const remoteRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://mixkit.co/',
        'Origin': 'https://mixkit.co'
      }
    });

    if (!remoteRes.ok) {
        console.error(`Media firewall blocked request: ${remoteRes.status}`);
        return new NextResponse(`Media provider blocked request: ${remoteRes.status}`, { status: 403 });
    }

    // Read the complete binary data into memory so we can manipulate chunks
    const arrayBuffer = await remoteRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentLength = buffer.length;

    // Parse incoming Content-Type or fall back dynamically
    const contentType = remoteRes.headers.get('content-type') || 
                        (url.endsWith('.mp3') ? 'audio/mpeg' : url.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream');

    let ext = '.bin';
    if (contentType.includes('audio')) ext = '.mp3';
    if (contentType.includes('video')) ext = '.mp4';
    if (contentType.includes('image')) ext = '.png';

    // Base cross-origin headers to defeat CORS inside mobile wallets
    const baseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes' // Crucial: Tells the browser it CAN ask for parts of this file
    };

    if (action === 'download') {
      baseHeaders['Content-Disposition'] = `attachment; filename="MasoMind-Asset${ext}"`;
    } else {
      baseHeaders['Content-Disposition'] = 'inline';
    }

    // 🎯 CRITICAL FIX: Handle Video/Audio Streaming Range Requests
    const rangeHeader = req.headers.get('range');
    
    if (rangeHeader && !contentType.includes('image')) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      
      const chunksize = (end - start) + 1;
      const slicedBuffer = buffer.subarray(start, end + 1);

      const responseHeaders = new Headers(baseHeaders);
      responseHeaders.set('Content-Range', `bytes ${start}-${end}/${contentLength}`);
      responseHeaders.set('Content-Length', chunksize.toString());

      return new NextResponse(slicedBuffer, {
        status: 206, // 206 Partial Content tells the player to start streaming instantly!
        headers: responseHeaders
      });
    }

    // Regular fallback response for complete files (like Images)
    const standardHeaders = new Headers(baseHeaders);
    standardHeaders.set('Content-Length', contentLength.toString());
    
    return new NextResponse(buffer, {
      status: 200,
      headers: standardHeaders
    });

  } catch (error) {
    console.error("Streaming Proxy Error:", error);
    return new NextResponse("Failed to stream media", { status: 500 });
  }
}

// ---------------------------------------------------------
// POST METHOD (For handling Base64 text downloads - Left untouched as it works fine)
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
