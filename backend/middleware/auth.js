import prisma from '../lib/prisma.js';

/**
 * Standard Authentication Middleware
 * Checks passport user (req.user) or session user (req.session.localUser)
 */
export const requireAuth = (req, res, next) => {
  const user = req.user || req.session?.localUser;
  if (!user || !user.id) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in.',
      code: 'UNAUTHORIZED',
      retryable: false
    });
  }
  req.authUser = user;
  next();
};

/**
 * Helper to safely extract user without requiring auth (returns null if unauthenticated)
 */
export const getAuthUser = (req) => {
  return req.user || req.session?.localUser || null;
};

/**
 * Verifies that the authenticated user owns the given project.
 * Throws an error with a status code property if unauthorized.
 */
export const verifyProjectOwnership = async (projectId, userId) => {
  if (!projectId || !userId) {
    const err = new Error('Project ID and User ID are required for verification');
    err.status = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: userId
    }
  });

  if (!project) {
    const err = new Error('Project not found or access denied');
    err.status = 404;
    err.code = 'PROJECT_NOT_FOUND';
    throw err;
  }

  return project;
};

/**
 * Verifies that the authenticated user owns the project associated with the given document.
 */
export const verifyDocumentOwnership = async (documentId, userId) => {
  if (!documentId || !userId) {
    const err = new Error('Document ID and User ID are required for verification');
    err.status = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      project: true,
      versions: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!document || !document.project || document.project.userId !== userId) {
    const err = new Error('Document not found or access denied');
    err.status = 404;
    err.code = 'DOCUMENT_NOT_FOUND';
    throw err;
  }

  return document;
};

/**
 * Verifies that the authenticated user owns the project associated with the given task.
 */
export const verifyTaskOwnership = async (taskId, userId) => {
  if (!taskId || !userId) {
    const err = new Error('Task ID and User ID are required for verification');
    err.status = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: true
    }
  });

  if (!task || !task.project || task.project.userId !== userId) {
    const err = new Error('Task not found or access denied');
    err.status = 404;
    err.code = 'TASK_NOT_FOUND';
    throw err;
  }

  return task;
};
