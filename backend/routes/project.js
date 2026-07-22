import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Middleware to ensure authentication
const requireAuth = (req, res, next) => {
  const user = req.user || req.session?.localUser;
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.authUser = user;
  next();
};

// GET /api/projects
// Fetch all projects for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.authUser.id },
      include: {
        documents: {
          orderBy: { updatedAt: 'desc' },
          take: 3 // Include up to 3 recent documents for preview
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects
// Create a new project
router.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  try {
    const project = await prisma.project.create({
      data: {
        userId: req.authUser.id,
        name,
        description,
        status: 'active'
      }
    });
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id
// Fetch project details and all its documents
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
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

// DELETE /api/projects/:id
// Delete a project
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const project = await prisma.project.findFirst({
      where: { id, userId: req.authUser.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.project.delete({ where: { id } });
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// GET /api/projects/:id/tasks (or /api/project/:id/tasks)
// Fetch all tasks for a given project
router.get('/:id/tasks', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching project tasks:', error);
    res.status(500).json({ error: 'Failed to fetch project tasks' });
  }
});

export default router;

