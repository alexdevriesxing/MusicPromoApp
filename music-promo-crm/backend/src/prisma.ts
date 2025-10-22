import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export { prisma };

// Example usage:
// import { prisma } from './prisma';
// const users = await prisma.user.findMany();
