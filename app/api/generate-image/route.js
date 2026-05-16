import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    // 1. Initialize the new Google Gen AI SDK
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 2. Call Gemini's Imagen model for image generation
    const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '1:1', // Perfect for our mobile UI square
        },
    });

    // 3. The SDK returns the image in base64 format, so we format it for the frontend
    const base64Image = response.generatedImages[0].image.imageBytes;
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    return NextResponse.json({ imageUrl });

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    
    // Fallback template for quick testing
    let promptText = "Futuristic canvas";
    try {
        const body = await req.json();
        if (body.prompt) promptText = body.prompt;
    } catch (e) {}

    const testFallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=512&height=512&nologo=true`;
    
    return NextResponse.json({ imageUrl: testFallbackUrl });
  }
}
