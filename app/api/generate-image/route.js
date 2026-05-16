import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const prompt = body.prompt || "Futuristic AI core";

    // Injecting a random seed ensures Pollinations creates a NEW image every time!
    const randomSeed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${randomSeed}`;

    return NextResponse.json({ imageUrl });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
