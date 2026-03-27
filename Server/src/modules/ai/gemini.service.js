import { geminiClient } from '../../config/ai.js';
import { logger } from '../../config/logger.js';

const MODEL = "gemini-3-flash-preview";

export async function callGemini(systemPrompt, userMessage, options = {}) {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized — API key not set');
  }

  const startTime = Date.now();

  try {
    const model = geminiClient.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        responseMimeType: 'application/json',
      },
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(userMessage);
    const content = result.response.text();

    if (!content) {
      throw new Error('Empty response from Gemini');
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Gemini call completed in ${elapsed}ms`);

    
    try {
      return JSON.parse(content);
    } catch {
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse Gemini response as JSON');
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`Gemini call failed after ${elapsed}ms: ${error.message}`);
    throw error;
  }
}
