import express from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, verifyProjectOwnership } from '../middleware/auth.js';

const router = express.Router();

// GET /api/projects
// Fetch all projects for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.authUser.id },
      include: {
        documents: {
          orderBy: { updatedAt: 'desc' },
          take: 5
        },
        _count: {
          select: { tasks: true, documents: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error.message);
    res.status(500).json({ error: 'Failed to fetch projects', code: 'PROJECT_FETCH_FAILED' });
  }
});

// POST /api/projects
// Create a new project for the authenticated user
router.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required', code: 'INVALID_INPUT' });
  }

  try {
    const project = await prisma.project.create({
      data: {
        userId: req.authUser.id,
        name: name.trim(),
        description: description ? description.trim() : null,
        status: 'active'
      }
    });
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error.message);
    res.status(500).json({ error: 'Failed to create project', code: 'PROJECT_CREATE_FAILED' });
  }
});

// GET /api/projects/:id
// Fetch project details and all its documents (ensures user owns the project)
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: req.authUser.id
      },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' }
        },
        tasks: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied', code: 'PROJECT_NOT_FOUND' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error.message);
    res.status(500).json({ error: 'Failed to fetch project details', code: 'PROJECT_FETCH_FAILED' });
  }
});

// DELETE /api/projects/:id
// Delete a project (ensures ownership)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await verifyProjectOwnership(id, req.authUser.id);
    await prisma.project.delete({ where: { id } });
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to delete project',
      code: error.code || 'PROJECT_DELETE_FAILED'
    });
  }
});

// GET /api/projects/:id/tasks
// Fetch all tasks for a project (ensures project is owned by authenticated user)
router.get('/:id/tasks', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await verifyProjectOwnership(id, req.authUser.id);

    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching project tasks:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to fetch project tasks',
      code: error.code || 'TASK_FETCH_FAILED'
    });
  }
});

// POST /api/projects/:id/tasks
// Create a new task within a project (ensures ownership)
router.post('/:id/tasks', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, assignee } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required', code: 'INVALID_INPUT' });
  }

  try {
    await verifyProjectOwnership(id, req.authUser.id);

    const validPriority = ['high', 'medium', 'low'].includes(priority?.toLowerCase())
      ? priority.toLowerCase()
      : 'medium';

    const task = await prisma.task.create({
      data: {
        projectId: id,
        title: title.trim(),
        description: description ? description.trim() : null,
        priority: validPriority,
        assignee: assignee ? assignee.trim() : null,
        status: 'pending',
        source: 'manual'
      }
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to create task',
      code: error.code || 'TASK_CREATE_FAILED'
    });
  }
});

export default router;
