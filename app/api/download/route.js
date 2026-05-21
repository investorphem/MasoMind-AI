import { NextResponse } from 'next/server';

// 🚀 CRITICAL: Forces Vercel to stream the response instead of caching it
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    const action = req.nextUrl.searchParams.get('action'); // 'stream' or 'download'

    if (!url) return new NextResponse("Missing URL", { status: 400 });

    // Fetch the media server-to-server to bypass all browser CORS blocks
    const remoteRes = await fetch(url);
    if (!remoteRes.ok) throw new Error("Failed to fetch media");

    // Copy the original headers so we maintain the correct file size and type
    const headers = new Headers(remoteRes.headers);
    
    // 🚀 STRIP EXTERNAL SECURITY BLOCKS so MiniPay allows it to play
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    // Auto-detect if it is a video or music file
    const contentType = remoteRes.headers.get('content-type') || '';
    let ext = '.bin';
    if (contentType.includes('audio')) ext = '.mp3';
    if (contentType.includes('video')) ext = '.mp4';

    if (action === 'download') {
      // Force the phone's native download manager
      headers.set('Content-Disposition', `attachment; filename="MasoMind-Asset${ext}"`);
    } else {
      // Force inline playback in the browser
      headers.set('Content-Disposition', 'inline');
    }

    // 🚀 THE MAGIC: Instead of loading the whole file into RAM (which crashes Vercel),
    // we pipe the raw byte stream directly to the user. This allows instant chunked playback!
    return new NextResponse(remoteRes.body, {
      status: remoteRes.status,
      headers
    });

  } catch (error) {
    console.error("Streaming Proxy Error:", error);
    return new NextResponse("Failed to stream media", { status: 500 });
  }
}

// ---------------------------------------------------------
// EXISTING POST METHOD (For handling Base64 text downloads)
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
       return new NextResponse("Invalid Base64 format", { status: 400 });
    }

    const headers = new Headers();
    headers.set('Content-Type', mime);
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Content-Disposition', `attachment; filename="MasoMind-${fileType}-${Date.now()}.${ext}"`);

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    return new NextResponse("Failed to process base64 download", { status: 500 });
  }
}
