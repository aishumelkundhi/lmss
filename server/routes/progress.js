const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get course progress for current user
router.get('/course/:courseId', authenticateToken, (req, res) => {
  const { courseId } = req.params;
  const user_id = req.user.id;

  // Check enrollment
  db.get(
    'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
    [user_id, courseId],
    (err, enrollment) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      if (!enrollment) {
        return res.status(403).json({ message: 'Not enrolled in this course' });
      }

      // Get all progress for this course
      db.all(
        `SELECT p.*, l.title as lesson_title, l.section_id, s.title as section_title, l.lesson_order, s.section_order
         FROM progress p
         JOIN lessons l ON p.lesson_id = l.id
         JOIN sections s ON l.section_id = s.id
         WHERE p.user_id = ? AND p.course_id = ?
         ORDER BY s.section_order, l.lesson_order`,
        [user_id, courseId],
        (err, progress) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching progress', error: err.message });
          }

          // Calculate overall progress
          const totalLessons = progress.length;
          const completedLessons = progress.filter(p => p.status === 'completed').length;
          const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

          // Find last watched lesson
          const lastWatched = progress
            .filter(p => p.last_watched_at)
            .sort((a, b) => new Date(b.last_watched_at) - new Date(a.last_watched_at))[0];

          res.json({
            progress,
            summary: {
              total_lessons: totalLessons,
              completed_lessons: completedLessons,
              progress_percentage: progressPercentage,
              last_watched_lesson_id: lastWatched ? lastWatched.lesson_id : null
            }
          });
        }
      );
    }
  );
});

// Update lesson progress
router.post('/lesson/:lessonId', authenticateToken, (req, res) => {
  const { lessonId } = req.params;
  const { status } = req.body;
  const user_id = req.user.id;

  if (!status || !['not_started', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ message: 'Valid status is required (not_started, in_progress, completed)' });
  }

  // Get lesson info
  db.get(
    `SELECT l.*, s.course_id FROM lessons l
     JOIN sections s ON l.section_id = s.id
     WHERE l.id = ?`,
    [lessonId],
    (err, lesson) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      if (!lesson) {
        return res.status(404).json({ message: 'Lesson not found' });
      }

      // Check enrollment
      db.get(
        'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
        [user_id, lesson.course_id],
        (err, enrollment) => {
          if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
          }
          if (!enrollment) {
            return res.status(403).json({ message: 'Not enrolled in this course' });
          }

          const now = new Date().toISOString();

          // Update or insert progress
          db.get(
            'SELECT * FROM progress WHERE user_id = ? AND lesson_id = ?',
            [user_id, lessonId],
            (err, existing) => {
              if (err) {
                return res.status(500).json({ message: 'Database error', error: err.message });
              }

              if (existing) {
                db.run(
                  `UPDATE progress 
                   SET status = ?, last_watched_at = ?
                   WHERE user_id = ? AND lesson_id = ?`,
                  [status, now, user_id, lessonId],
                  function(err) {
                    if (err) {
                      return res.status(500).json({ message: 'Error updating progress', error: err.message });
                    }
                    res.json({ message: 'Progress updated successfully', progress: { lesson_id: lessonId, status, last_watched_at: now } });
                  }
                );
              } else {
                const progressId = uuidv4();
                db.run(
                  'INSERT INTO progress (id, user_id, course_id, lesson_id, status, last_watched_at) VALUES (?, ?, ?, ?, ?, ?)',
                  [progressId, user_id, lesson.course_id, lessonId, status, now],
                  function(err) {
                    if (err) {
                      return res.status(500).json({ message: 'Error creating progress', error: err.message });
                    }
                    res.status(201).json({ message: 'Progress created successfully', progress: { id: progressId, lesson_id: lessonId, status, last_watched_at: now } });
                  }
                );
              }
            }
          );
        }
      );
    }
  );
});

// Mark lesson as completed
router.post('/lesson/:lessonId/complete', authenticateToken, (req, res) => {
  const { lessonId } = req.params;
  const user_id = req.user.id;
  const status = 'completed';
  const now = new Date().toISOString();

  db.get(
    `SELECT l.*, s.course_id FROM lessons l
     JOIN sections s ON l.section_id = s.id
     WHERE l.id = ?`,
    [lessonId],
    (err, lesson) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      if (!lesson) {
        return res.status(404).json({ message: 'Lesson not found' });
      }

      db.get(
        'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
        [user_id, lesson.course_id],
        (err, enrollment) => {
          if (err || !enrollment) {
            return res.status(403).json({ message: 'Not enrolled in this course' });
          }

          db.run(
            `UPDATE progress 
             SET status = ?, last_watched_at = ?
             WHERE user_id = ? AND lesson_id = ?`,
            [status, now, user_id, lessonId],
            function(err) {
              if (err) {
                return res.status(500).json({ message: 'Error updating progress', error: err.message });
              }
              res.json({ message: 'Lesson marked as completed', lesson_id: lessonId, status });
            }
          );
        }
      );
    }
  );
});

// Get next and previous lessons
router.get('/navigation/:courseId/:lessonId', authenticateToken, (req, res) => {
  const { courseId, lessonId } = req.params;
  const user_id = req.user.id;

  // Check enrollment
  db.get(
    'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
    [user_id, courseId],
    (err, enrollment) => {
      if (err || !enrollment) {
        return res.status(403).json({ message: 'Not enrolled in this course' });
      }

      // Get all lessons in order
      db.all(
        `SELECT l.id, l.title, l.lesson_order, s.section_order
         FROM lessons l
         JOIN sections s ON l.section_id = s.id
         WHERE s.course_id = ?
         ORDER BY s.section_order, l.lesson_order`,
        [courseId],
        (err, lessons) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching lessons', error: err.message });
          }

          const currentIndex = lessons.findIndex(l => l.id === lessonId);
          if (currentIndex === -1) {
            return res.status(404).json({ message: 'Lesson not found in course' });
          }

          const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
          const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

          res.json({
            current: lessons[currentIndex],
            previous: prevLesson,
            next: nextLesson
          });
        }
      );
    }
  );
});

module.exports = router;
