import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../config/logger.js';
import * as aiService from '../ai/ai.service.js';
import { getGenerationQueue, getEvaluationQueue } from '../../config/queue.js';
import {
  getRoundSequence,
  getRoundWeight,
  ROUND_DURATIONS,
  QUESTIONS_PER_ROUND,
  QUESTION_TYPE_MAP,
  DSA_TOPICS,
  HINTS_CONFIG,
  ADAPTIVE_THRESHOLDS,
  DIFFICULTY_PROGRESSION,
  ROUND_DIFFICULTY_RANGE,
} from './rounds/roundConfig.js';





export async function createSession(userId, { level, role, companyType, companyName }) {
  const roundTypes = getRoundSequence(level, companyType);
  const totalRounds = roundTypes.length;

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      level,
      role,
      companyType,
      companyName,
      totalRounds,
      rounds: {
        create: roundTypes.map((type, index) => ({
          roundNumber: index + 1,
          type,
          maxScore: 100,
        })),
      },
    },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        select: {
          id: true,
          roundNumber: true,
          type: true,
          status: true,
          maxScore: true,
        },
      },
    },
  });

  return session;
}

export async function getSession(sessionId, userId) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          questions: {
            orderBy: { questionNumber: 'asc' },
          },
        },
      },
    },
  });

  if (!session) throw ApiError.notFound('Session not found');
  if (session.userId !== userId) throw ApiError.forbidden('Not your session');

  return session;
}

export async function updateSessionStatus(sessionId, userId, status) {
  const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
  if (!session) throw ApiError.notFound('Session not found');
  if (session.userId !== userId) throw ApiError.forbidden('Not your session');

  return prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status,
      lastSavedAt: new Date(),
      ...(status === 'ABANDONED' ? { completedAt: new Date() } : {}),
    },
  });
}

export async function deleteSession(sessionId, userId) {
  const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
  if (!session) throw ApiError.notFound('Session not found');
  if (session.userId !== userId) throw ApiError.forbidden('Not your session');
  if (session.status === 'COMPLETED') throw ApiError.badRequest('Cannot delete completed sessions');

  return prisma.interviewSession.delete({ where: { id: sessionId } });
}





export async function startRound(sessionId, roundNumber, userId) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { rounds: { where: { roundNumber } } },
  });

  if (!session) throw ApiError.notFound('Session not found');
  if (session.userId !== userId) throw ApiError.forbidden('Not your session');
  if (session.status !== 'IN_PROGRESS' && session.status !== 'PAUSED') {
    throw ApiError.badRequest('Session is not active');
  }

  const round = session.rounds[0];
  if (!round) throw ApiError.notFound('Round not found');

  
  const existingQuestions = await prisma.question.findMany({
    where: { roundId: round.id },
    orderBy: { questionNumber: 'asc' },
  });

  if (existingQuestions.length > 0) {
    
    await prisma.round.update({
      where: { id: round.id },
      data: { status: 'IN_PROGRESS', startedAt: round.startedAt || new Date() },
    });

    return {
      round: { ...round, status: 'IN_PROGRESS' },
      questions: existingQuestions,
      duration: ROUND_DURATIONS[round.type],
    };
  }

  const questionCount = QUESTIONS_PER_ROUND[round.type] || 2;
  const questionType = QUESTION_TYPE_MAP[round.type] || 'TEXT';
  const difficulty = getDifficulty(round.type);
  const questions = [];
  const previousTopics = [];
  const genQueue = getGenerationQueue();

  if (genQueue) {
    for (let i = 1; i <= questionCount; i++) {
      const topic = getRandomTopic(round.type, previousTopics);
      previousTopics.push(topic);

      await genQueue.add(
        `gen-${round.id}-${i}`,
        {
          roundId: round.id,
          questionNumber: i,
          sessionId,
          level: session.level,
          role: session.role,
          companyType: session.companyType,
          roundType: round.type,
          difficulty,
          topic,
          previousTopics: previousTopics.slice(0, -1),
          timeLimit: Math.floor(ROUND_DURATIONS[round.type] / 60 / questionCount),
          questionType,
        },
        { jobId: `gen-${round.id}-${i}` }
      );
    }

    await prisma.round.update({
      where: { id: round.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { currentRound: roundNumber, status: 'IN_PROGRESS', lastSavedAt: new Date() },
    });

    return {
      round: { ...round, status: 'IN_PROGRESS' },
      questions: [],
      duration: ROUND_DURATIONS[round.type],
      pendingGeneration: true,
      totalQuestions: questionCount,
    };
  }

  for (let i = 1; i <= questionCount; i++) {
    const topic = getRandomTopic(round.type, previousTopics);
    previousTopics.push(topic);

    try {
      const generated = await aiService.generateQuestion({
        level: session.level,
        role: session.role,
        companyType: session.companyType,
        roundType: round.type,
        difficulty,
        topic,
        previousTopics: previousTopics.slice(0, -1),
        timeLimit: Math.floor(ROUND_DURATIONS[round.type] / 60 / questionCount),
      });

      const question = await prisma.question.create({
        data: {
          roundId: round.id,
          questionNumber: i,
          type: questionType,
          content: generated.question || generated.content || `Question ${i}`,
          metadata: {
            difficulty: generated.difficulty || difficulty,
            topic: generated.topic || topic,
            hints: generated.hints || [],
            testCases: generated.testCases || [],
            sampleAnswer: generated.sampleAnswer || '',
            evaluationCriteria: generated.evaluationCriteria || [],
            timeLimit: generated.timeLimit || Math.floor(ROUND_DURATIONS[round.type] / 60 / questionCount),
          },
        },
      });

      questions.push(question);
    } catch (error) {
      logger.error(`Failed to generate question ${i} for round ${round.type}: ${error.message}`);
      const question = await prisma.question.create({
        data: {
          roundId: round.id,
          questionNumber: i,
          type: questionType,
          content: getFallbackQuestion(round.type, topic, i),
          metadata: {
            difficulty,
            topic,
            hints: ['Think about the basic approach first', 'Consider edge cases', 'Optimize your solution'],
            testCases: [],
            sampleAnswer: '',
            evaluationCriteria: ['Correctness', 'Code quality', 'Efficiency'],
          },
        },
      });
      questions.push(question);
    }
  }

  await prisma.round.update({
    where: { id: round.id },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
  });

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { currentRound: roundNumber, status: 'IN_PROGRESS', lastSavedAt: new Date() },
  });

  return {
    round: { ...round, status: 'IN_PROGRESS' },
    questions,
    duration: ROUND_DURATIONS[round.type],
  };
}





export async function submitAnswer({ sessionId, roundId, questionId, answer, codeAnswer, language }, userId) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { round: { include: { session: true } } },
  });

  if (!question) throw ApiError.notFound('Question not found');
  if (question.round.session.userId !== userId) throw ApiError.forbidden('Not your session');
  if (question.round.sessionId !== sessionId) throw ApiError.badRequest('Question does not belong to this session');

  const roundType = question.round.type;
  const evalQueue = getEvaluationQueue();

  if (evalQueue) {
    const updated = await prisma.question.update({
      where: { id: questionId },
      data: { userAnswer: answer, codeAnswer },
    });

    await evalQueue.add(
      `eval-${questionId}`,
      {
        questionId,
        roundType,
        questionContent: question.content,
        answer: answer || '',
        codeAnswer: codeAnswer || '',
        language: language || 'javascript',
        difficulty: question.metadata?.difficulty || 'Medium',
        sessionId,
      },
      { jobId: `eval-${questionId}` }
    );

    return { question: updated, evaluation: null, pendingEvaluation: true };
  }

  let evaluation = null;

  try {
    if (['DSA_BASIC', 'DSA_MEDIUM', 'DSA_HARD'].includes(roundType)) {
      evaluation = await aiService.evaluateDSA({
        question: question.content,
        code: codeAnswer || answer || '',
        language: language || 'javascript',
        difficulty: question.metadata?.difficulty || 'Medium',
      });
    } else if (['HR', 'BEHAVIOURAL', 'HIRING_MANAGER'].includes(roundType)) {
      evaluation = await aiService.evaluateHR({
        question: question.content,
        answer: answer || '',
      });
    } else if (roundType === 'LLD') {
      evaluation = await aiService.evaluateLLD({
        question: question.content,
        answer: codeAnswer || answer || '',
      });
    } else {
      evaluation = await aiService.evaluateGeneric({
        question: question.content,
        answer: answer || '',
        roundType,
      });
    }
  } catch (error) {
    logger.error(`AI evaluation failed for question ${questionId}: ${error.message}`);
    evaluation = {
      totalScore: 0,
      error: 'AI evaluation temporarily unavailable. Your answer has been saved.',
      verdict: 'Pending',
    };
  }

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: {
      userAnswer: answer,
      codeAnswer,
      aiEvaluation: evaluation,
      score: evaluation.totalScore || 0,
      answeredAt: new Date(),
    },
  });

  return { question: updated, evaluation };
}

export async function getHint(questionId, userId, userPlan, isAdmin = false) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { round: { include: { session: true } } },
  });

  if (!question) throw ApiError.notFound('Question not found');
  if (question.round.session.userId !== userId) throw ApiError.forbidden('Not your session');

  const effectivePlan = isAdmin ? 'ADMIN' : userPlan;
  const maxHints = HINTS_CONFIG[effectivePlan] || HINTS_CONFIG.FREE;
  const hints = question.metadata?.hints || [];

  if (question.hintsUsed >= maxHints) {
    throw ApiError.badRequest('No more hints available for your plan');
  }

  if (question.hintsUsed >= hints.length) {
    throw ApiError.badRequest('No more hints available for this question');
  }

  const hint = hints[question.hintsUsed];

  await prisma.question.update({
    where: { id: questionId },
    data: { hintsUsed: { increment: 1 } },
  });

  return {
    hint,
    hintNumber: question.hintsUsed + 1,
    hintsRemaining: Math.min(maxHints, hints.length) - (question.hintsUsed + 1),
    maxHints: Math.min(maxHints, hints.length),
  };
}

export async function skipQuestion(questionId, userId) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { round: { include: { session: true } } },
  });

  if (!question) throw ApiError.notFound('Question not found');
  if (question.round.session.userId !== userId) throw ApiError.forbidden('Not your session');

  return prisma.question.update({
    where: { id: questionId },
    data: { skipped: true, score: 0, answeredAt: new Date() },
  });
}





export async function completeRound(sessionId, roundId, userId) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      questions: true,
      session: true,
    },
  });

  if (!round) throw ApiError.notFound('Round not found');
  if (round.session.userId !== userId) throw ApiError.forbidden('Not your session');

  
  const answeredQuestions = round.questions.filter((q) => q.answeredAt || q.skipped);
  const totalScore = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
  const roundScore = answeredQuestions.length > 0 ? totalScore / answeredQuestions.length : 0;

  const updated = await prisma.round.update({
    where: { id: roundId },
    data: {
      status: 'COMPLETED',
      score: Math.round(roundScore * 100) / 100,
      completedAt: new Date(),
      timeTaken: round.startedAt
        ? Math.floor((Date.now() - new Date(round.startedAt).getTime()) / 1000)
        : null,
    },
  });

  
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { rounds: { orderBy: { roundNumber: 'asc' } } },
  });

  const isLastRound = round.roundNumber >= session.totalRounds;
  const nextRound = isLastRound ? null : session.rounds.find((r) => r.roundNumber === round.roundNumber + 1);

  return {
    round: updated,
    roundScore: Math.round(roundScore * 100) / 100,
    isLastRound,
    nextRound,
  };
}

export async function completeSession(sessionId, userId) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      rounds: { orderBy: { roundNumber: 'asc' } },
      user: { select: { id: true } },
    },
  });

  if (!session) throw ApiError.notFound('Session not found');
  if (session.userId !== userId) throw ApiError.forbidden('Not your session');

  
  let finalScore = 0;
  let totalWeight = 0;

  for (const round of session.rounds) {
    if (round.score !== null) {
      const weight = getRoundWeight(session.level, round.type, session.totalRounds);
      finalScore += round.score * weight;
      totalWeight += weight;
    }
  }

  
  if (totalWeight > 0 && totalWeight !== 1) {
    finalScore = finalScore / totalWeight;
  }

  finalScore = Math.round(finalScore * 100) / 100;

  
  const percentile = calculatePercentile(finalScore);

  
  let feedback = '';
  try {
    const roundSummary = session.rounds
      .map((r) => `${r.type}: ${r.score ?? 'N/A'}/100`)
      .join(', ');
    feedback = `Final Score: ${finalScore}/100. Percentile: ${percentile}%. Rounds: ${roundSummary}.`;
  } catch {
    feedback = `Final Score: ${finalScore}/100.`;
  }

  
  const updated = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      finalScore,
      percentile,
      feedback,
      completedAt: new Date(),
      lastSavedAt: new Date(),
    },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: { questions: true },
      },
    },
  });

  
  await updateUserProfile(userId);

  return updated;
}

export async function getResults(sessionId, userId) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          questions: {
            orderBy: { questionNumber: 'asc' },
          },
        },
      },
    },
  });

  if (!session) throw ApiError.notFound('Session not found');
  if (session.userId !== userId) throw ApiError.forbidden('Not your session');

  return session;
}

export async function getHistory(userId, { page, limit, level, status }) {
  const where = { userId };
  if (level) where.level = level;
  if (status) where.status = status;

  const [sessions, total] = await Promise.all([
    prisma.interviewSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        level: true,
        role: true,
        companyType: true,
        companyName: true,
        status: true,
        currentRound: true,
        totalRounds: true,
        finalScore: true,
        percentile: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    prisma.interviewSession.count({ where }),
  ]);

  return {
    sessions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}





function getDifficulty(roundType) {
  const map = {
    APTITUDE: 'Easy',
    DSA_BASIC: 'Easy',
    DSA_MEDIUM: 'Medium',
    DSA_HARD: 'Hard',
    HR: 'Medium',
    LLD: 'Medium',
    HLD: 'Hard',
    BEHAVIOURAL: 'Medium',
    TECH_FUNDAMENTALS: 'Easy',
    TECH_DEEP_DIVE: 'Medium',
    HIRING_MANAGER: 'Medium',
  };
  return map[roundType] || 'Medium';
}

async function getAdaptiveDifficulty(roundId, roundType) {
  const baseDifficulty = getDifficulty(roundType);
  const allowedRange = ROUND_DIFFICULTY_RANGE[roundType] || [baseDifficulty];

  if (allowedRange.length <= 1) return baseDifficulty;

  try {
    const answeredQuestions = await prisma.question.findMany({
      where: { roundId, score: { not: null } },
      select: { score: true, metadata: true },
      orderBy: { questionNumber: 'asc' },
    });

    if (answeredQuestions.length < ADAPTIVE_THRESHOLDS.minQuestionsForAdaptation) {
      return baseDifficulty;
    }

    const avgScore = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0) / answeredQuestions.length;
    const lastDifficulty = answeredQuestions[answeredQuestions.length - 1]?.metadata?.difficulty || baseDifficulty;
    const progression = DIFFICULTY_PROGRESSION[lastDifficulty] || DIFFICULTY_PROGRESSION.Medium;

    let newDifficulty = lastDifficulty;
    if (avgScore >= ADAPTIVE_THRESHOLDS.upgradeThreshold) {
      newDifficulty = progression.up;
    } else if (avgScore <= ADAPTIVE_THRESHOLDS.downgradeThreshold) {
      newDifficulty = progression.down;
    }

    if (!allowedRange.includes(newDifficulty)) {
      return allowedRange.includes(lastDifficulty) ? lastDifficulty : baseDifficulty;
    }

    logger.info(`Adaptive difficulty: round=${roundId} avg=${avgScore.toFixed(1)} ${lastDifficulty}→${newDifficulty}`);
    return newDifficulty;
  } catch (err) {
    logger.warn(`Adaptive difficulty fallback: ${err.message}`);
    return baseDifficulty;
  }
}

function getRandomTopic(roundType, previousTopics) {
  if (roundType.startsWith('DSA')) {
    const difficulty = roundType === 'DSA_BASIC' ? 'EASY' : roundType === 'DSA_MEDIUM' ? 'MEDIUM' : 'HARD';
    const topics = DSA_TOPICS[difficulty] || DSA_TOPICS.MEDIUM;
    const available = topics.filter((t) => !previousTopics.includes(t));
    return available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : topics[Math.floor(Math.random() * topics.length)];
  }
  return roundType.replace(/_/g, ' ');
}


function getFallbackQuestion(roundType, topic, questionNumber) {
  const fallbacks = {
    DSA_BASIC: [
      `Given an array of integers, find two numbers that add up to a target sum. Return their indices.`,
      `Write a function that reverses a string in-place.`,
      `Determine if a given string is a valid palindrome.`,
      `Find the maximum sum of a contiguous subarray.`
    ],
    DSA_MEDIUM: [
      `Given a binary tree, find the lowest common ancestor of two given nodes.`,
      `Implement a LRU Cache.`,
      `Find the number of islands in a 2D grid.`,
      `Given an array of intervals, merge all overlapping intervals.`
    ],
    DSA_HARD: [
      `Given a string s and a dictionary of words, add spaces to s to construct sentences where each word is a valid dictionary word. Return all possible sentences.`,
      `Find the median of two sorted arrays.`,
      `Serialize and deserialize a binary tree.`,
      `Find the longest valid parentheses substring.`
    ],
    HR: [
      `Tell me about a time when you had to deal with a difficult team member. How did you handle the situation?`,
      `What is your greatest weakness, and how are you working to overcome it?`,
      `Describe a time you failed and what you learned from it.`,
      `Why do you want to work for our company?`
    ],
    BEHAVIOURAL: [
      `Describe a project where you had to make a critical technical decision under pressure. What was your approach?`,
      `Tell me about a time you had a disagreement with a manager.`,
      `How do you handle scope creep in a project?`,
      `Give an example of a time you went above and beyond your standard duties.`
    ],
    LLD: [
      `Design a parking lot system. Define the classes, relationships, and key methods.`,
      `Design an elevator system.`,
      `Design an ATM system.`,
      `Design a library management system.`
    ],
    HLD: [
      `Design a URL shortener like bit.ly. Discuss the system architecture, database design, and scalability considerations.`,
      `Design a chat application like WhatsApp.`,
      `Design a rate limiter.`,
      `Design a notification system.`
    ],
    TECH_FUNDAMENTALS: [
      `Explain the difference between REST and GraphQL. When would you choose one over the other?`,
      `What are the core differences between SQL and NoSQL databases?`,
      `Explain the concept of containerization and Docker.`,
      `Describe how HTTPS works.`
    ],
    TECH_DEEP_DIVE: [
      `Explain how the JavaScript event loop works. Include microtasks, macrotasks, and the callback queue.`,
      `How does garbage collection work in modern browsers?`,
      `Explain the concept of closures and provide a practical use case.`,
      `Describe React's reconciliation process and virtual DOM.`
    ],
    HIRING_MANAGER: [
      `Where do you see yourself in 5 years? How does this role fit into your career plan?`,
      `What is your expected salary, and how did you arrive at that number?`,
      `What are you looking for in your next role?`,
      `What distinguishes you from other candidates?`
    ],
    APTITUDE: [
      `A train travels 60 km in 40 minutes. What is its speed in km/h?\n\nA) 80 km/h\nB) 90 km/h\nC) 100 km/h\nD) 120 km/h`,
      `If a factory produces 200 widgets in 5 hours, how many will it produce in 8 hours?\n\nA) 300\nB) 320\nC) 400\nD) 250`,
      `What is 15% of 350?\n\nA) 45\nB) 50\nC) 52.5\nD) 55`,
      `A pipe fills a tank in 4 hours, another empties it in 6 hours. How long to fill it together?\n\nA) 10h\nB) 12h\nC) 8h\nD) 5h`
    ],
  };
  
  const options = fallbacks[roundType];
  if (!options || options.length === 0) return `Question ${questionNumber} about ${topic}`;
  return options[(questionNumber - 1) % options.length];
}

function calculatePercentile(score) {
  if (score >= 90) return Math.floor(95 + Math.random() * 4);
  if (score >= 80) return Math.floor(85 + Math.random() * 9);
  if (score >= 70) return Math.floor(70 + Math.random() * 14);
  if (score >= 60) return Math.floor(50 + Math.random() * 19);
  if (score >= 50) return Math.floor(30 + Math.random() * 19);
  return Math.floor(10 + Math.random() * 19);
}

async function updateUserProfile(userId) {
  try {
    const sessions = await prisma.interviewSession.findMany({
      where: { userId, status: 'COMPLETED' },
      include: { rounds: true },
    });

    const totalSessions = sessions.length;
    const scores = sessions.filter((s) => s.finalScore !== null).map((s) => s.finalScore);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    
    const roundScores = {};
    for (const session of sessions) {
      for (const round of session.rounds) {
        if (round.score !== null) {
          const type = round.type.toLowerCase().replace(/_/g, '');
          if (!roundScores[type]) roundScores[type] = [];
          roundScores[type].push(round.score);
        }
      }
    }

    const avg = (arr) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    
    const totalTimeMin = sessions.reduce((sum, s) => {
      if (s.startedAt && s.completedAt) {
        return sum + Math.floor((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60000);
      }
      return sum;
    }, 0);

    
    const areaScores = Object.entries(roundScores).map(([type, scores]) => ({
      type,
      avg: avg(scores),
    }));
    const weakAreas = areaScores.filter((a) => a.avg !== null && a.avg < 60).map((a) => a.type);
    const strongAreas = areaScores.filter((a) => a.avg !== null && a.avg >= 75).map((a) => a.type);

    await prisma.userProfile.upsert({
      where: { userId },
      update: {
        totalSessions,
        totalTimeMin,
        averageScore: averageScore ? Math.round(averageScore * 100) / 100 : null,
        dsaScore: avg(roundScores.dsabasic || roundScores.dsamedium || roundScores.dsahard || []),
        lldScore: avg(roundScores.lld || []),
        hldScore: avg(roundScores.hld || []),
        hrScore: avg(roundScores.hr || []),
        aptitudeScore: avg(roundScores.aptitude || []),
        weakAreas,
        strongAreas,
        lastActiveDate: new Date(),
      },
      create: {
        userId,
        totalSessions,
        totalTimeMin,
        averageScore: averageScore ? Math.round(averageScore * 100) / 100 : null,
        weakAreas,
        strongAreas,
        lastActiveDate: new Date(),
      },
    });
  } catch (error) {
    logger.error(`Failed to update user profile for ${userId}: ${error.message}`);
  }
}
