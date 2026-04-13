import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { IMAGE_MODEL } from "@/lib/ai/gemini-provider";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const prompt = formData.get("prompt") as string | null;

    if (!image) return NextResponse.json({ error: "No image provided" }, { status: 400 });
    if (!prompt?.trim()) return NextResponse.json({ error: "No prompt provided" }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = image.type || "image/jpeg";

    const client = new GoogleGenAI({ apiKey });

    console.log(`[dev-test] Sending request — model: ${IMAGE_MODEL}`);

    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
      config: { responseModalities: ["IMAGE", "TEXT"] },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p) => p.inlineData?.data && p.inlineData?.mimeType?.startsWith("image/")
    );
    const textPart = parts.find((p) => p.text)?.text ?? null;

    if (!imagePart?.inlineData?.data) {
      return NextResponse.json(
        { error: "No image returned by Gemini", text: textPart },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
      text: textPart,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
