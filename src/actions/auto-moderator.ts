'use server';

import { GoogleGenAI } from '@google/genai';
import { log } from '@/lib/logger';

// Initialize the Gemini client
// Note: Requires GEMINI_API_KEY environment variable to be set.
const ai = new GoogleGenAI({});

export interface ModerationResult {
  isApproved: boolean;
  flags: string[];
  suggestedCategory?: string;
  reason?: string;
}

/**
 * Uses Gemini Pro to analyze an auction listing's text and images.
 * Detects counterfeit items, prohibited goods, and spam.
 */
export async function analyzeListing(
  title: string,
  description: string,
  category: string,
  imageUrls: string[]
): Promise<ModerationResult> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      log.warn('GEMINI_API_KEY is missing. Skipping auto-moderation.');
      return { isApproved: true, flags: [] }; // Fail-open if no key
    }

    // Prepare prompt
    const prompt = `
You are an expert AI moderator for an online auction marketplace based in Bangladesh called Nilamit.
Your job is to review the following new auction listing and determine if it violates our policies.

Policies:
1. No prohibited items (weapons, drugs, adult content, stolen goods, etc.).
2. No obvious counterfeit or fake branded goods.
3. No spam, gibberish, or misleading titles.

Listing Details:
- Title: "${title}"
- Description: "${description}"
- Category Selected by User: "${category}"
- Number of Images: ${imageUrls.length}

Based on the text provided, output a JSON object with the following fields EXACTLY (do not include markdown wrapping like \`\`\`json):
{
  "isApproved": boolean (true if the listing is safe, false if it violates policies),
  "flags": array of strings (e.g., ["Counterfeit", "Weapons"], empty if safe),
  "reason": string (a short explanation of your decision),
  "suggestedCategory": string (only if you believe the user's category is completely wrong, otherwise omit)
}
`;

    // Note: If we wanted to analyze images, we would fetch the image bytes 
    // and pass them as inlineData to Gemini 1.5 Pro. For simplicity, we are 
    // analyzing the text only in this V1 implementation.
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text() ?? '{}';
    const result = JSON.parse(responseText);

    log.info(`Auto-moderation completed for "${title}"`, { approved: result.isApproved });

    return {
      isApproved: Boolean(result.isApproved),
      flags: Array.isArray(result.flags) ? result.flags : [],
      reason: result.reason,
      suggestedCategory: result.suggestedCategory,
    };
  } catch (error) {
    log.error('Auto-moderator failed:', error);
    // Fail-open strategy to not block users if AI service is down
    return { isApproved: true, flags: [] };
  }
}
