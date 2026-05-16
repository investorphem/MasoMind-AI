import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(req) {
  try {
    // 1. In App Router, parse the body like this:
    const { prompt } = await req.json();

    // Connect to Celo RPC to verify on-chain events if required
    const provider = new ethers.JsonRpcProvider('https://forno.celo.org');

    // 2. Call your OpenAI API key (ensure OPENAI_API_KEY is set in Vercel)
    const aiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        prompt: prompt,
        n: 1,
        size: "512x512"
      })
    });

    const data = await aiResponse.json();
    
    if (data && data.data && data.data[0]) {
      const imageUrl = data.data[0].url;
      return NextResponse.json({ imageUrl });
    }

    // Throw error to trigger fallback if OpenAI payload is empty
    throw new Error("OpenAI did not return an image");

  } catch (error) {
    console.log("Using fallback generator due to:", error.message);
    
    // Fallback template for quick testing or if your API key isn't active yet
    // Read the prompt again safely from the stream fallback if parsing failed
    let promptText = "Futuristic canvas";
    try {
      const body = await req.json();
      if (body.prompt) promptText = body.prompt;
    } catch (e) {}

    const testFallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=512&height=512&nologo=true`;
    
    return NextResponse.json({ imageUrl: testFallbackUrl });
  }
}
