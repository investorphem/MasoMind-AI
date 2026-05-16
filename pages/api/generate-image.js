import { ethers } from 'ethers';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;

  try {
    // Connect to Celo RPC to verify on-chain events if required
    const provider = new ethers.JsonRpcProvider('https://forno.celo.org');

    // Call your preferred AI image generator API (e.g., OpenAI, Stability, or Pollinations)
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
    const imageUrl = data.data[0].url;

    return res.status(200).json({ imageUrl });
  } catch (error) {
    // Fallback template for quick testing if your API key isn't active yet
    const testFallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;
    return res.status(200).json({ imageUrl: testFallbackUrl });
  }
}
