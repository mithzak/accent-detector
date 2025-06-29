import { GoogleGenAI } from "@google/genai";
import { type AnalysisResult } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const PROMPT = `
You are an expert linguistic analysis AI. Your task is to analyze the provided audio clip and identify the primary language spoken and the speaker's accent.

You MUST provide your response ONLY as a valid JSON object. Do not include any explanatory text, markdown, or anything else outside of the JSON object.

The JSON object must follow this exact structure, with example values replaced by your analysis:
{
  "language": {
    "name": "English",
    "confidence": 95
  },
  "accent": {
    "name": "American",
    "confidence": 88
  }
}

The "name" values must be strings. The "confidence" values must be integers between 0 and 100.
`;

export const analyzeAudio = async (base64Audio: string): Promise<AnalysisResult> => {
    try {
        const audioPart = {
            inlineData: {
                mimeType: 'audio/webm',
                data: base64Audio,
            },
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-04-17',
            contents: {
                parts: [audioPart, { text: PROMPT }]
            },
            config: {
                responseMimeType: 'application/json',
            }
        });

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }

        const parsedData = JSON.parse(jsonStr);

        // Basic validation of the parsed data structure
        if (
            !parsedData.language || typeof parsedData.language.name !== 'string' || typeof parsedData.language.confidence !== 'number' ||
            !parsedData.accent || typeof parsedData.accent.name !== 'string' || typeof parsedData.accent.confidence !== 'number'
        ) {
            throw new Error("Invalid JSON structure received from API.");
        }
        
        // Clamp confidence values between 0 and 100
        parsedData.language.confidence = Math.max(0, Math.min(100, parsedData.language.confidence));
        parsedData.accent.confidence = Math.max(0, Math.min(100, parsedData.accent.confidence));

        return parsedData as AnalysisResult;

    } catch (e) {
        console.error("Error analyzing audio:", e);
        if (e instanceof Error) {
            throw new Error(`API call failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred while communicating with the AI model.");
    }
};
