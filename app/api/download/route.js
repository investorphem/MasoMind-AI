import { NextResponse } from 'next/server';

// ---------------------------------------------------------
// DYNAMIC GET METHOD (Handles URLs, Streaming, and native downloads)
// ---------------------------------------------------------
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get('url');
    const stream = searchParams.get('stream');

    if (!fileUrl) {
      return new NextResponse("Missing file URL", { status: 400 });
    }

    // Fetch the remote file
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("Failed to fetch from provider");

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamically detect what kind of file this is based on the remote server's headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    let ext = 'bin';
    if (contentType.includes('audio')) ext = 'mp3';
    else if (contentType.includes('video')) ext = 'mp4';
    else if (contentType.includes('image')) ext = 'png';

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Cache-Control', 'no-cache');

    if (stream === 'true') {
      // 🚀 INLINE: Forces Web3 wallets to play the audio natively (Fixes 0:00 bug)
      headers.set('Content-Disposition', 'inline');
    } else {
      // 🚀 ATTACHMENT: Forces Android/iOS to download the file directly
      headers.set('Content-Disposition', `attachment; filename="MasoMind-Premium.${ext}"`);
    }

    return new NextResponse(buffer, { status: 200, headers });

  } catch (error) {
    console.error("GET Download Proxy Error:", error);
    return new NextResponse("Failed to process media", { status: 500 });
  }
}

// ---------------------------------------------------------
// EXISTING POST METHOD (Handles Base64 outputs perfectly)
// ---------------------------------------------------------
export async function POST(req) {
  try {
    const formData = await req.formData();
    const fileData = formData.get('fileData');
    const fileType = formData.get('fileType') || 'MEDIA';

    if (!fileData) {
      return new NextResponse("Missing file data", { status: 400 });
    }

    let buffer;
    let ext = 'jpg';
    let mime = 'image/jpeg';

    if (fileType === 'MUSIC') { ext = 'mp3'; mime = 'audio/mp3'; }
    if (fileType === 'VIDEO') { ext = 'mp4'; mime = 'video/mp4'; }

    // Parse massive Base64 strings natively on the server
    if (fileData.startsWith('data:')) {
      const base64Data = fileData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else if (fileData.startsWith('http')) {
      // Or fetch standard URLs
      const response = await fetch(fileData);
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
       return new NextResponse("Invalid data format", { status: 400 });
    }

    const headers = new Headers();
    headers.set('Content-Type', mime);
    headers.set('Content-Length', buffer.length.toString());
    // 🚀 ATTACHMENT: Forces OS download natively
    headers.set('Content-Disposition', `attachment; filename="MasoMind-${fileType}-${Date.now()}.${ext}"`);

    return new NextResponse(buffer, { status: 200, headers });

  } catch (error) {
    console.error("Download Proxy Error:", error);
    return new NextResponse("Failed to process download", { status: 500 });
  }
}
