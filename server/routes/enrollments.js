const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Enroll in a course
router.post('/', authenticateToken, (req, res) => {
  const { course_id } = req.body;
  const user_id = req.user.id;

  if (!course_id) {
    return res.status(400).json({ message: 'Course ID is required' });
  }

  // Check if course exists
  db.get('SELECT * FROM courses WHERE id = ?', [course_id], (err, course) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if already enrolled
    db.get('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?', [user_id, course_id], (err, enrollment) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      if (enrollment) {
        return res.status(409).json({ message: 'Already enrolled in this course' });
      }

      const enrollmentId = uuidv4();
      db.run(
        'INSERT INTO enrollments (id, user_id, course_id) VALUES (?, ?, ?)',
        [enrollmentId, user_id, course_id],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error creating enrollment', error: err.message });
          }

          // Initialize progress records for all lessons in the course
          db.all(
            `SELECT l.id as lesson_id FROM lessons l
             JOIN sections s ON l.section_id = s.id
             WHERE s.course_id = ?`,
            [course_id],
            (err, lessons) => {
              if (!err && lessons.length > 0) {
                const stmt = db.prepare(
                  'INSERT OR IGNORE INTO progress (id, user_id, course_id, lesson_id, status) VALUES (?, ?, ?, ?, ?)'
                );
                lessons.forEach(lesson => {
                  stmt.run(uuidv4(), user_id, course_id, lesson.lesson_id, 'not_started');
                });
                stmt.finalize();
              }
            }
          );

          res.status(201).json({ message: 'Enrolled successfully', enrollment: { id: enrollmentId, user_id, course_id } });
        }
      );
    });
  });
});

// Get user's enrolled courses
router.get('/my-courses', authenticateToken, (req, res) => {
  const user_id = req.user.id;

  const query = `
    SELECT c.*, u.name as instructor_name, e.enrolled_at,
      (SELECT COUNT(*) FROM progress WHERE user_id = ? AND course_id = c.id AND status = 'completed') as completed_lessons,
      (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) as total_lessons
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON c.instructor_id = u.id
    WHERE e.user_id = ?
    ORDER BY e.enrolled_at DESC
  `;

  db.all(query, [user_id, user_id], (err, courses) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching enrollments', error: err.message });
    }

    // Calculate progress percentage for each course
    const coursesWithProgress = courses.map(course => ({
      ...course,
      progress_percentage: course.total_lessons > 0 
        ? Math.round((course.completed_lessons / course.total_lessons) * 100) 
        : 0
    }));

    res.json({ courses: coursesWithProgress });
  });
});

// Check if user is enrolled in a specific course
router.get('/check/:courseId', authenticateToken, (req, res) => {
  const { courseId } = req.params;
  const user_id = req.user.id;

  db.get(
    'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
    [user_id, courseId],
    (err, enrollment) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      res.json({ enrolled: !!enrollment });
    }
  );
});

module.exports = router;
