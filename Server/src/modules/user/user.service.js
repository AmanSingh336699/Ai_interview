import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      level: true,
      role: true,
      targetCompany: true,
      plan: true,
      planExpiry: true,
      isAdmin: true,
      createdAt: true,
      profile: true,
    },
  });

  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function updateProfile(userId, data) {
  const { name, level, role, targetCompany, avatar } = data;
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(name && { name }),
      ...(level && { level }),
      ...(role && { role }),
      ...(targetCompany !== undefined && { targetCompany }),
      ...(avatar && { avatar }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      level: true,
      role: true,
      targetCompany: true,
      plan: true,
      isAdmin: true,
    },
  });
}

export async function getAnalytics(userId) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });

  
  const recentSessions = await prisma.interviewSession.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      level: true,
      finalScore: true,
      completedAt: true,
      rounds: {
        select: { type: true, score: true },
      },
    },
  });

  return {
    profile: profile || { totalSessions: 0, averageScore: null, weakAreas: [], strongAreas: [] },
    recentSessions,
    trends: recentSessions.map((s) => ({
      date: s.completedAt,
      score: s.finalScore,
      level: s.level,
    })),
  };
}

export async function getDashboard(userId) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });

  const [inProgressCount, completedCount, recentSessions] = await Promise.all([
    prisma.interviewSession.count({ where: { userId, status: 'IN_PROGRESS' } }),
    prisma.interviewSession.count({ where: { userId, status: 'COMPLETED' } }),
    prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        level: true,
        role: true,
        companyType: true,
        status: true,
        finalScore: true,
        startedAt: true,
        completedAt: true,
      },
    }),
  ]);

  return {
    stats: {
      totalSessions: profile?.totalSessions || 0,
      completedSessions: completedCount,
      inProgress: inProgressCount,
      averageScore: profile?.averageScore || null,
      totalTimeMin: profile?.totalTimeMin || 0,
      currentStreak: profile?.currentStreak || 0,
    },
    weakAreas: profile?.weakAreas || [],
    strongAreas: profile?.strongAreas || [],
    recentSessions,
  };
}
