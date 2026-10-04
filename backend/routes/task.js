import express from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, verifyTaskOwnership } from '../middleware/auth.js';

const router = express.Router();

// GET /api/tasks/:id
// Get a single task (verifies ownership)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const task = await verifyTaskOwnership(req.params.id, req.authUser.id);
    res.json(task);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Failed to fetch task',
      code: error.code || 'TASK_FETCH_FAILED'
    });
  }
});

// PATCH /api/tasks/:id
// Update task status, assignee, priority, or title (verifies ownership)
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, assignee, priority, title, description } = req.body;

  try {
    await verifyTaskOwnership(id, req.authUser.id);

    const updateData = {};
    if (status !== undefined) {
      if (!['pending', 'in_progress', 'done'].includes(status)) {
        return res.status(400).json({ error: 'Invalid task status. Must be pending, in_progress, or done.', code: 'INVALID_STATUS' });
      }
      updateData.status = status;
    }

    if (assignee !== undefined) {
      updateData.assignee = assignee ? String(assignee).trim() : null;
    }

    if (priority !== undefined) {
      if (!['high', 'medium', 'low'].includes(String(priority).toLowerCase())) {
        return res.status(400).json({ error: 'Invalid priority. Must be high, medium, or low.', code: 'INVALID_PRIORITY' });
      }
      updateData.priority = String(priority).toLowerCase();
    }

    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Task title cannot be empty', code: 'INVALID_TITLE' });
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to update task',
      code: error.code || 'TASK_UPDATE_FAILED'
    });
  }
});

// DELETE /api/tasks/:id
// Delete a task (verifies ownership)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await verifyTaskOwnership(id, req.authUser.id);
    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to delete task',
      code: error.code || 'TASK_DELETE_FAILED'
    });
  }
});

export default router;
