import { groqClient } from '../../config/ai.js';
import { logger } from '../../config/logger.js';

const MODEL = "llama-3.3-70b-versatile";
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.7;


export async function callGroq(systemPrompt, userMessage, options = {}) {
  if (!groqClient) {
    throw new Error('Groq client not initialized — API key not set');
  }

  const startTime = Date.now();

  try {
    const response = await groqClient.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: options.maxTokens || MAX_TOKENS,
      temperature: options.temperature ?? TEMPERATURE,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Groq');
    }

    const elapsed = Date.now() - startTime;
    const tokensUsed = response.usage?.total_tokens || 0;

    logger.info(`Groq call completed in ${elapsed}ms (${tokensUsed} tokens)`);

    
    try {
      return JSON.parse(content);
    } catch {
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse Groq response as JSON');
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`Groq call failed after ${elapsed}ms: ${error.message}`);
    throw error;
  }
}
