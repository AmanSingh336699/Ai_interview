import { callGroq } from "./groq.service.js";
import { callGemini } from "./gemini.service.js";
import { CircuitBreaker } from "../../utils/circuitBreaker.js";
import { makeCacheKey, cacheWrap } from "../../utils/cache.js";
import { logger } from "../../config/logger.js";
import {
    DSA_EVALUATOR_PROMPT,
    buildDSAEvalPrompt,
} from "./prompts/dsa.prompts.js";
import {
    HR_EVALUATOR_PROMPT,
    buildHREvalPrompt,
} from "./prompts/hr.prompts.js";
import {
    LLD_EVALUATOR_PROMPT,
    buildLLDEvalPrompt,
} from "./prompts/lld.prompts.js";
import {
    buildQuestionGenPrompt,
    buildGenericEvalPrompt,
} from "./prompts/system.prompts.js";

const groqBreaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownMs: 60000,
    name: "groq",
});
const geminiBreaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownMs: 60000,
    name: "gemini",
});

function sanitizeInput(text) {
    if (!text) return "";

    // Truncate extremely long inputs
    let sanitized = text.slice(0, 15000);

    // Strip common prompt injection patterns
    const dangerousPatterns = [
        /ignore\s+(all\s+)?previous\s+instructions/gi,
        /you\s+are\s+now/gi,
        /SYSTEM\s*:/gi,
        /\[INST\]/gi,
        /<<SYS>>/gi,
        /forget\s+(all\s+)?(previous|prior)/gi,
        /disregard\s+(all\s+)?(previous|prior)/gi,
    ];

    for (const pattern of dangerousPatterns) {
        sanitized = sanitized.replace(pattern, "[FILTERED]");
    }

    // Remove potential file system / network operations from code
    sanitized = sanitized.replace(
        /require\s*\(\s*['"](?:fs|child_process|net|http|https|os|cluster)['"]|import\s+.*?from\s+['"](?:fs|child_process|net|http|https|os|cluster)['"]/g,
        "[FILTERED_IMPORT]",
    );

    return sanitized;
}

async function callAIWithFallback(
    preferredProvider,
    systemPrompt,
    userMessage,
) {
    const primary =
        preferredProvider === "groq"
            ? { call: callGroq, breaker: groqBreaker, name: "Groq" }
            : { call: callGemini, breaker: geminiBreaker, name: "Gemini" };

    const fallback =
        preferredProvider === "groq"
            ? { call: callGemini, breaker: geminiBreaker, name: "Gemini" }
            : { call: callGroq, breaker: groqBreaker, name: "Groq" };

    
    if (!primary.breaker.isOpen()) {
        try {
            const result = await primary.call(systemPrompt, userMessage);
            primary.breaker.recordSuccess();
            return result;
        } catch (error) {
            primary.breaker.recordFailure();
            logger.warn(
                `${primary.name} failed, switching to ${fallback.name}: ${error.message}`,
            );
        }
    } else {
        logger.warn(
            `${primary.name} circuit breaker is OPEN, using ${fallback.name}`,
        );
    }

    
    if (!fallback.breaker.isOpen()) {
        try {
            const result = await fallback.call(systemPrompt, userMessage);
            fallback.breaker.recordSuccess();
            return result;
        } catch (error) {
            fallback.breaker.recordFailure();
            logger.error(
                `Both AI providers failed. Last error: ${error.message}`,
            );
            throw new Error(
                "All AI providers are currently unavailable. Please try again later.",
            );
        }
    }

    throw new Error(
        "All AI providers are currently unavailable (circuit breakers open).",
    );
}





export async function generateQuestion(params) {
    const prompt = buildQuestionGenPrompt(params);
    
    const provider = "groq";
    return callAIWithFallback(
        provider,
        "You are an expert interviewer generating questions.",
        prompt,
    );
}

export async function evaluateDSA({ question, code, language, difficulty }) {
    const userMessage = buildDSAEvalPrompt({
        question: sanitizeInput(question),
        code: sanitizeInput(code),
        language,
        difficulty,
    });

    const cacheKey = makeCacheKey("eval:dsa", { question, code, language });
    return cacheWrap(
        cacheKey,
        () => callAIWithFallback("gemini", DSA_EVALUATOR_PROMPT, userMessage),
        3600,
    );
}

export async function evaluateHR({ question, answer }) {
    const userMessage = buildHREvalPrompt({
        question: sanitizeInput(question),
        answer: sanitizeInput(answer),
    });

    const cacheKey = makeCacheKey("eval:hr", { question, answer });
    return cacheWrap(
        cacheKey,
        () => callAIWithFallback("gemini", HR_EVALUATOR_PROMPT, userMessage),
        3600,
    );
}

export async function evaluateLLD({ question, answer }) {
    const userMessage = buildLLDEvalPrompt({
        question: sanitizeInput(question),
        answer: sanitizeInput(answer),
    });

    const cacheKey = makeCacheKey("eval:lld", { question, answer });
    return cacheWrap(
        cacheKey,
        () => callAIWithFallback("gemini", LLD_EVALUATOR_PROMPT, userMessage),
        3600,
    );
}

export async function evaluateGeneric({ question, answer, roundType }) {
    const userMessage = buildGenericEvalPrompt({
        question: sanitizeInput(question),
        answer: sanitizeInput(answer),
        roundType,
    });

    const cacheKey = makeCacheKey(`eval:${roundType.toLowerCase()}`, {
        question,
        answer,
    });
    return cacheWrap(
        cacheKey,
        () =>
            callAIWithFallback(
                "gemini",
                "You are an expert technical interviewer.",
                userMessage,
            ),
        3600,
    );
}

export function getAIStatus() {
    return {
        groq: groqBreaker.getStatus(),
        gemini: geminiBreaker.getStatus(),
    };
}
