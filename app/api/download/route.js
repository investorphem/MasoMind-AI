import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');
    const type = searchParams.get('type') || 'MEDIA';

    if (!targetUrl) {
      return new NextResponse("Missing URL", { status: 400 });
    }

    // Fetch the media file from the AI provider (Pollinations/Google)
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error("Failed to fetch media");

    // Convert to a raw data buffer
    const data = await response.arrayBuffer();

    // Determine the correct file extension and type
    let ext = 'jpg';
    let mime = 'image/jpeg';
    if (type === 'MUSIC') { ext = 'mp3'; mime = 'audio/mp3'; }
    if (type === 'VIDEO') { ext = 'mp4'; mime = 'video/mp4'; }

    // 🚀 THE MAGIC TRICK: "attachment" forces the OS to download the file natively
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="MasoMind-${type}-${Date.now()}.${ext}"`,
        'Content-Type': mime,
      },
    });

  } catch (error) {
    console.error("Download Proxy Error:", error);
    return new NextResponse("Failed to download file", { status: 500 });
  }
}
