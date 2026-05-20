import { NextResponse } from 'next/server';

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
      // Or fetch standard image URLs
      const response = await fetch(fileData);
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
       return new NextResponse("Invalid data format", { status: 400 });
    }

    // 🚀 THE MAGIC TRICK: "attachment" forces the OS to download the file natively
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="MasoMind-${fileType}-${Date.now()}.${ext}"`,
        'Content-Type': mime,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error("Download Proxy Error:", error);
    return new NextResponse("Failed to process download", { status: 500 });
  }
}
