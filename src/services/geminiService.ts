import { GoogleGenAI, Type } from "@google/genai";
import { MangaPage, Manga } from '../types';

// Initialize the Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface MangaStory {
  title: string;
  pages: MangaPage[];
}

/**
 * Generates a detailed manga storyboard using Gemini 3.1 Pro.
 * Uses structured JSON output for maximum reliability.
 */
export const generateStoryboard = async (prompt: string, pageCount: number, language: string, style: 'bw' | 'color'): Promise<MangaStory> => {
  const systemInstruction = `You are a professional manga storyboard artist and editor. 
  Your task is to create a detailed storyboard for a manga. 
  
  CRITICAL RULES:
  1. Page 1 MUST be a "Title Page" with a single full-page panel.
  2. The LAST page MUST be an "End Page" with a single panel.
  3. For all other pages, use dynamic multi-panel layouts (1-3 panels).
  4. Coordinates (x, y) are percentages (0-100) for the CENTER of the bubble.
  5. Descriptions must be highly detailed, focusing on character expressions, camera angles (low angle, close up, etc.), and background details.
  6. Explicitly mention "screentones", "hatching", and "manga line art" in descriptions.
  
  Return the response in JSON format.`;

  const userPrompt = `Create a professional manga storyboard for: "${prompt}". 
  Total Pages: ${pageCount}. 
  Language: ${language}.
  Style: ${style === 'bw' ? 'Classic Black and White Manga (Screentones, Ink)' : 'Modern Full Color Manga (Digital Art)'}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  page_number: { type: Type.NUMBER },
                  panels: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        scene_description: { type: Type.STRING },
                        layout_hint: { 
                          type: Type.STRING,
                          enum: ["full", "half-vertical", "half-horizontal", "quarter"]
                        },
                        dialogues: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              text: { type: Type.STRING },
                              x: { type: Type.NUMBER },
                              y: { type: Type.NUMBER },
                              width: { type: Type.NUMBER },
                              height: { type: Type.NUMBER }
                            },
                            required: ["text", "x", "y", "width", "height"]
                          }
                        }
                      },
                      required: ["scene_description", "layout_hint", "dialogues"]
                    }
                  }
                },
                required: ["page_number", "panels"]
              }
            }
          },
          required: ["title", "pages"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    
    const story = JSON.parse(text) as MangaStory;
    
    // Add unique IDs for React keys and database storage
    story.pages = story.pages.map(p => ({
      ...p,
      id: crypto.randomUUID(),
      panels: p.panels.map(panel => ({
        ...panel,
        id: crypto.randomUUID(),
        dialogues: panel.dialogues.map(d => ({ ...d, id: crypto.randomUUID() }))
      }))
    }));
    
    return story;
  } catch (error) {
    console.error("Gemini Storyboard Error:", error);
    throw error;
  }
};

/**
 * Generates a manga-style image using Pollinations.ai (Flux model).
 * This is used for the "Inking" phase.
 */
export const generateMangaImage = async (sceneDescription: string, style: 'bw' | 'color'): Promise<string> => {
  const stylePrompt = style === 'bw' 
    ? 'authentic japanese manga style, black and white ink, professional screentones, G-pen lineart, high contrast, detailed hatching, white background, masterpiece, 8k' 
    : 'modern high-quality anime/manga illustration, vibrant colors, clean lineart, professional digital coloring, soft shading, masterpiece, 8k';
  
  const fullPrompt = `${stylePrompt}. Scene: ${sceneDescription}. IMPORTANT: Ensure the art style is strictly Japanese Manga. Leave clear white space for dialogue bubbles.`;
  const encodedPrompt = encodeURIComponent(fullPrompt);
  
  const seed = Math.floor(Math.random() * 1000000);
  // Using Flux model via Pollinations for high-quality manga art
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=1200&nologo=true&seed=${seed}&model=flux`;
  
  return imageUrl;
};
