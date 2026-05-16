import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { celo } from 'viem/chains';

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    // 1. Initialize viem's Public Client instead of ethers JsonRpcProvider
    const publicClient = createPublicClient({
      chain: celo,
      transport: http('https://forno.celo.org')
    });

    // (Optional) If you ever need to read contract state on the backend:
    // await publicClient.readContract({ ... })

    // 2. Call your OpenAI API key
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

    throw new Error("OpenAI did not return an image");

  } catch (error) {
    console.log("Using fallback generator due to:", error.message);
    
    let promptText = "Futuristic canvas";
    try {
      const body = await req.json();
      if (body.prompt) promptText = body.prompt;
    } catch (e) {}

    const testFallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=512&height=512&nologo=true`;
    
    return NextResponse.json({ imageUrl: testFallbackUrl });
  }
}
