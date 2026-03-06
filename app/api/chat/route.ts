import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { GUIDE_SYSTEM_PROMPT } from "@/lib/prompts";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "メッセージが空です" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: GUIDE_SYSTEM_PROMPT(),
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: message }] }],
    });

    return NextResponse.json({ text: result.response.text() });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
