import { env } from './env.js';

let groqClient = null;

let geminiClient = null;

function getGroq() {
  if (groqClient) return groqClient;
  if (!env.GROQ_API_KEY) {
    console.warn('⚠️  GROQ_API_KEY not set — AI generation disabled');
    return null;
  }

  import('openai').then(({ default: OpenAI }) => {
    groqClient = new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
  });

  return groqClient;
}


function getGemini() {
  if (geminiClient) return geminiClient;
  if (!env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not set — Gemini features disabled');
    return null;
  }

  import('@google/generative-ai').then(({ GoogleGenerativeAI }) => {
    geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  });

  return geminiClient;
}

async function initAIProviders() {
  if (env.GROQ_API_KEY) {
    const { default: OpenAI } = await import('openai');
    groqClient = new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
    console.log('✅ Groq client initialized');
  } else {
    console.warn('⚠️  GROQ_API_KEY not set — Generation disabled');
  }

  if (env.GEMINI_API_KEY) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    console.log('✅ Gemini client initialized');
  } else {
    console.warn('⚠️  GEMINI_API_KEY not set — Gemini disabled');
  }
}

export { groqClient, geminiClient, getGroq, getGemini, initAIProviders };
