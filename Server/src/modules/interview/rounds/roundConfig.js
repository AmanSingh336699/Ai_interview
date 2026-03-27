




export const ROUND_SEQUENCES = {
  SDE_1: {
    DEFAULT: ['APTITUDE', 'DSA_BASIC', 'TECH_FUNDAMENTALS', 'HR'],
    FAANG: ['APTITUDE', 'DSA_BASIC', 'DSA_BASIC', 'TECH_FUNDAMENTALS', 'HR'],
    STARTUP: ['DSA_BASIC', 'TECH_FUNDAMENTALS', 'HR'],
  },
  SDE_2: {
    DEFAULT: ['DSA_MEDIUM', 'LLD', 'TECH_DEEP_DIVE', 'BEHAVIOURAL'],
    FAANG: ['DSA_MEDIUM', 'DSA_MEDIUM', 'LLD', 'BEHAVIOURAL'],
    FINTECH: ['DSA_MEDIUM', 'LLD', 'TECH_DEEP_DIVE', 'BEHAVIOURAL'],
  },
  SDE_3: {
    DEFAULT: ['DSA_HARD', 'HLD', 'LLD', 'BEHAVIOURAL', 'HIRING_MANAGER'],
  },
  SDE_4: {
    DEFAULT: ['HLD', 'HLD', 'LLD', 'BEHAVIOURAL', 'HIRING_MANAGER'],
  },
};





export const ROUND_DURATIONS = {
  APTITUDE: 900,       
  DSA_BASIC: 1500,     
  DSA_MEDIUM: 2100,    
  DSA_HARD: 2400,      
  HR: 900,             
  LLD: 1800,           
  HLD: 2400,           
  BEHAVIOURAL: 1200,   
  TECH_FUNDAMENTALS: 1200, 
  TECH_DEEP_DIVE: 1500,   
  HIRING_MANAGER: 1200,   
};





export const SCORE_WEIGHTS = {
  SDE_1: {
    APTITUDE: 0.15,
    DSA_BASIC: 0.40,
    TECH_FUNDAMENTALS: 0.30,
    HR: 0.15,
  },
  SDE_2: {
    DSA_MEDIUM: 0.35,
    LLD: 0.30,
    TECH_DEEP_DIVE: 0.20,
    BEHAVIOURAL: 0.15,
  },
  SDE_3: {
    DSA_HARD: 0.20,
    HLD: 0.35,
    LLD: 0.25,
    BEHAVIOURAL: 0.10,
    HIRING_MANAGER: 0.10,
  },
  SDE_4: {
    HLD: 0.40,
    LLD: 0.25,
    BEHAVIOURAL: 0.15,
    HIRING_MANAGER: 0.20,
  },
};





export const QUESTIONS_PER_ROUND = {
  APTITUDE: 10,
  DSA_BASIC: 3,
  DSA_MEDIUM: 3,
  DSA_HARD: 2,
  HR: 5,
  LLD: 2,
  HLD: 2,
  BEHAVIOURAL: 5,
  TECH_FUNDAMENTALS: 6,
  TECH_DEEP_DIVE: 5,
  HIRING_MANAGER: 4,
};





export const QUESTION_TYPE_MAP = {
  APTITUDE: 'MCQ',
  DSA_BASIC: 'CODING',
  DSA_MEDIUM: 'CODING',
  DSA_HARD: 'CODING',
  HR: 'VOICE',
  LLD: 'DESIGN',
  HLD: 'TEXT',
  BEHAVIOURAL: 'VOICE',
  TECH_FUNDAMENTALS: 'TEXT',
  TECH_DEEP_DIVE: 'TEXT',
  HIRING_MANAGER: 'VOICE',
};





export const HINTS_CONFIG = {
  FREE: 2,
  PRO: 4,
  PREMIUM: 8,
  TEAM: 8,
  ADMIN: Infinity,
};





export const ADAPTIVE_THRESHOLDS = {
  upgradeThreshold: 75,
  downgradeThreshold: 35,
  minQuestionsForAdaptation: 1,
};

export const DIFFICULTY_PROGRESSION = {
  Easy: { up: 'Medium', down: 'Easy' },
  Medium: { up: 'Hard', down: 'Easy' },
  Hard: { up: 'Hard', down: 'Medium' },
};

export const ROUND_DIFFICULTY_RANGE = {
  APTITUDE: ['Easy', 'Medium'],
  DSA_BASIC: ['Easy', 'Medium'],
  DSA_MEDIUM: ['Medium', 'Hard'],
  DSA_HARD: ['Hard'],
  HR: ['Medium'],
  LLD: ['Medium', 'Hard'],
  HLD: ['Hard'],
  BEHAVIOURAL: ['Medium'],
  TECH_FUNDAMENTALS: ['Easy', 'Medium', 'Hard'],
  TECH_DEEP_DIVE: ['Medium', 'Hard'],
  HIRING_MANAGER: ['Medium'],
};





export const DSA_TOPICS = {
  EASY: ['Arrays', 'Strings', 'Hash Maps', 'Two Pointers', 'Stack', 'Queue', 'Linked List', 'Sorting', 'Binary Search'],
  MEDIUM: ['Trees', 'Graphs', 'Dynamic Programming', 'Backtracking', 'Sliding Window', 'Heap', 'Trie', 'BFS/DFS', 'Greedy'],
  HARD: ['Advanced DP', 'Segment Trees', 'Graph Advanced', 'String Algorithms', 'Network Flow', 'Geometry', 'Bit Manipulation Advanced'],
};

export function getRoundSequence(level, companyType) {
  const levelConfig = ROUND_SEQUENCES[level];
  if (!levelConfig) {
    return ROUND_SEQUENCES.SDE_1.DEFAULT;
  }
  return levelConfig[companyType] || levelConfig.DEFAULT;
}

export function getRoundWeight(level, roundType, totalRounds) {
  const weights = SCORE_WEIGHTS[level];
  if (weights && weights[roundType] !== undefined) {
    return weights[roundType];
  }
  
  return 1 / totalRounds;
}
