const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all courses with instructor info
router.get('/', (req, res) => {
  const query = `
    SELECT c.*, u.name as instructor_name,
      (SELECT COUNT(*) FROM sections WHERE course_id = c.id) as section_count,
      (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) as lesson_count
    FROM courses c
    JOIN users u ON c.instructor_id = u.id
    ORDER BY c.created_at DESC
  `;

  db.all(query, [], (err, courses) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching courses', error: err.message });
    }
    res.json({ courses });
  });
});

// Get single course with sections and lessons
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT c.*, u.name as instructor_name 
     FROM courses c 
     JOIN users u ON c.instructor_id = u.id 
     WHERE c.id = ?`,
    [id],
    (err, course) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching course', error: err.message });
      }
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      // Get sections with lessons
      db.all(
        `SELECT * FROM sections WHERE course_id = ? ORDER BY section_order`,
        [id],
        (err, sections) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching sections', error: err.message });
          }

          if (sections.length === 0) {
            return res.json({ course, sections: [] });
          }

          const sectionIds = sections.map(s => s.id);
          const placeholders = sectionIds.map(() => '?').join(',');

          db.all(
            `SELECT * FROM lessons WHERE section_id IN (${placeholders}) ORDER BY lesson_order`,
            sectionIds,
            (err, lessons) => {
              if (err) {
                return res.status(500).json({ message: 'Error fetching lessons', error: err.message });
              }

              const sectionsWithLessons = sections.map(section => ({
                ...section,
                lessons: lessons.filter(l => l.section_id === section.id)
              }));

              res.json({ course, sections: sectionsWithLessons });
            }
          );
        }
      );
    }
  );
});

// Create course (instructor/admin only)
router.post('/', authenticateToken, requireRole('instructor', 'admin'), (req, res) => {
  const { title, description, thumbnail_url, category } = req.body;
  const instructor_id = req.user.id;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  const courseId = uuidv4();

  db.run(
    'INSERT INTO courses (id, title, description, thumbnail_url, category, instructor_id) VALUES (?, ?, ?, ?, ?, ?)',
    [courseId, title, description || '', thumbnail_url || '', category || '', instructor_id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error creating course', error: err.message });
      }

      db.get('SELECT * FROM courses WHERE id = ?', [courseId], (err, course) => {
        if (err) {
          return res.status(500).json({ message: 'Error fetching created course', error: err.message });
        }
        res.status(201).json({ message: 'Course created successfully', course });
      });
    }
  );
});

// Add section to course
router.post('/:courseId/sections', authenticateToken, requireRole('instructor', 'admin'), (req, res) => {
  const { courseId } = req.params;
  const { title, section_order } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  // Verify course exists and user owns it
  db.get('SELECT * FROM courses WHERE id = ?', [courseId], (err, course) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (course.instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this course' });
    }

    const sectionId = uuidv4();
    db.run(
      'INSERT INTO sections (id, course_id, title, section_order) VALUES (?, ?, ?, ?)',
      [sectionId, courseId, title, section_order || 0],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error creating section', error: err.message });
        }

        db.get('SELECT * FROM sections WHERE id = ?', [sectionId], (err, section) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching created section', error: err.message });
          }
          res.status(201).json({ message: 'Section created successfully', section });
        });
      }
    );
  });
});

// Add lesson to section
router.post('/:courseId/sections/:sectionId/lessons', authenticateToken, requireRole('instructor', 'admin'), (req, res) => {
  const { courseId, sectionId } = req.params;
  const { title, lesson_order, youtube_url, duration } = req.body;

  if (!title || !youtube_url) {
    return res.status(400).json({ message: 'Title and YouTube URL are required' });
  }

  // Verify course ownership
  db.get('SELECT * FROM courses WHERE id = ?', [courseId], (err, course) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (course.instructor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this course' });
    }

    const lessonId = uuidv4();
    db.run(
      'INSERT INTO lessons (id, section_id, title, lesson_order, youtube_url, duration) VALUES (?, ?, ?, ?, ?, ?)',
      [lessonId, sectionId, title, lesson_order || 0, youtube_url, duration || ''],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error creating lesson', error: err.message });
        }

        db.get('SELECT * FROM lessons WHERE id = ?', [lessonId], (err, lesson) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching created lesson', error: err.message });
          }
          res.status(201).json({ message: 'Lesson created successfully', lesson });
        });
      }
    );
  });
});

module.exports = router;
