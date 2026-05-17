import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { code } = await req.json();
    
    // Using standard fetch to call Gemini securely from the backend
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `You are an expert Web3 Smart Contract Auditor. Analyze the following code for vulnerabilities, reentrancy risks, gas optimizations, and syntax errors. Provide a concise, highly professional markdown report. Code:\n\n${code}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });

    const data = await response.json();
    const auditReport = data.candidates[0].content.parts[0].text;

    return NextResponse.json({ report: auditReport });

  } catch (error) {
    console.error("Audit API Error:", error);
    return NextResponse.json({ error: "Failed to process audit" }, { status: 500 });
  }
}
