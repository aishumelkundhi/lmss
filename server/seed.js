const db = require('./config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('Seeding database...');

  // Create sample users
  const adminId = uuidv4();
  const instructor1Id = uuidv4();
  const instructor2Id = uuidv4();
  const studentId = uuidv4();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Insert users
  const users = [
    [adminId, 'admin@lms.com', hashedPassword, 'Admin User', 'admin'],
    [instructor1Id, 'john@lms.com', hashedPassword, 'John Smith', 'instructor'],
    [instructor2Id, 'jane@lms.com', hashedPassword, 'Jane Doe', 'instructor'],
    [studentId, 'student@lms.com', hashedPassword, 'Student User', 'student']
  ];

  for (const user of users) {
    db.run(
      'INSERT OR IGNORE INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
      user
    );
  }

  console.log('Users created');

  // Create sample courses
  const course1Id = uuidv4();
  const course2Id = uuidv4();
  const course3Id = uuidv4();

  const courses = [
    [course1Id, 'Complete Web Development Bootcamp', 'Learn HTML, CSS, JavaScript, React, Node.js and more in this comprehensive course.', 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800', 'Development', instructor1Id],
    [course2Id, 'Python for Data Science', 'Master Python programming and learn data analysis, visualization, and machine learning.', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800', 'Data Science', instructor2Id],
    [course3Id, 'UI/UX Design Fundamentals', 'Learn the principles of user interface and user experience design with practical projects.', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800', 'Design', instructor1Id]
  ];

  for (const course of courses) {
    db.run(
      'INSERT OR IGNORE INTO courses (id, title, description, thumbnail_url, category, instructor_id) VALUES (?, ?, ?, ?, ?, ?)',
      course
    );
  }

  console.log('Courses created');

  // Create sections for course 1
  const section1Id = uuidv4();
  const section2Id = uuidv4();
  const section3Id = uuidv4();

  const sections = [
    [section1Id, course1Id, 'HTML & CSS Basics', 1],
    [section2Id, course1Id, 'JavaScript Fundamentals', 2],
    [section3Id, course1Id, 'React Framework', 3]
  ];

  for (const section of sections) {
    db.run(
      'INSERT OR IGNORE INTO sections (id, course_id, title, section_order) VALUES (?, ?, ?, ?)',
      section
    );
  }

  console.log('Sections created');

  // Create lessons for sections
  const lessons = [
    // Section 1: HTML & CSS
    [uuidv4(), section1Id, 'Introduction to HTML', 1, 'https://www.youtube.com/embed/qz0aGYrrlhU', '15:30'],
    [uuidv4(), section1Id, 'HTML Document Structure', 2, 'https://www.youtube.com/embed/UB1O30fR-EE', '12:45'],
    [uuidv4(), section1Id, 'CSS Basics and Selectors', 3, 'https://www.youtube.com/embed/yfoY53QXEnI', '18:20'],
    [uuidv4(), section1Id, 'CSS Box Model', 4, 'https://www.youtube.com/embed/rIO5326FgPE', '14:15'],
    
    // Section 2: JavaScript
    [uuidv4(), section2Id, 'JavaScript Introduction', 1, 'https://www.youtube.com/embed/W6NZfCO5SIk', '20:00'],
    [uuidv4(), section2Id, 'Variables and Data Types', 2, 'https://www.youtube.com/embed/9emXNzqCKyg', '16:30'],
    [uuidv4(), section2Id, 'Functions and Scope', 3, 'https://www.youtube.com/embed/N8ap4k_1QEQ', '22:15'],
    
    // Section 3: React
    [uuidv4(), section3Id, 'React Introduction', 1, 'https://www.youtube.com/embed/w7ejDZ8SWv8', '25:00'],
    [uuidv4(), section3Id, 'Components and Props', 2, 'https://www.youtube.com/embed/9hb_0TZ_Mcg', '19:45']
  ];

  for (const lesson of lessons) {
    db.run(
      'INSERT OR IGNORE INTO lessons (id, section_id, title, lesson_order, youtube_url, duration) VALUES (?, ?, ?, ?, ?, ?)',
      lesson
    );
  }

  console.log('Lessons created');

  // Create sections and lessons for course 2 (Python)
  const pySection1Id = uuidv4();
  const pySection2Id = uuidv4();

  db.run(
    'INSERT OR IGNORE INTO sections (id, course_id, title, section_order) VALUES (?, ?, ?, ?)',
    [pySection1Id, course2Id, 'Python Basics', 1]
  );
  db.run(
    'INSERT OR IGNORE INTO sections (id, course_id, title, section_order) VALUES (?, ?, ?, ?)',
    [pySection2Id, course2Id, 'Data Analysis with Pandas', 2]
  );

  const pyLessons = [
    [uuidv4(), pySection1Id, 'Python Setup and Basics', 1, 'https://www.youtube.com/embed/_uQrJ0TkZlc', '30:00'],
    [uuidv4(), pySection1Id, 'Variables and Data Types', 2, 'https://www.youtube.com/embed/k9TUPpGqYTo', '24:00'],
    [uuidv4(), pySection2Id, 'Introduction to Pandas', 1, 'https://www.youtube.com/embed/vmEHCJofslg', '28:00']
  ];

  for (const lesson of pyLessons) {
    db.run(
      'INSERT OR IGNORE INTO lessons (id, section_id, title, lesson_order, youtube_url, duration) VALUES (?, ?, ?, ?, ?, ?)',
      lesson
    );
  }

  // Create sections and lessons for course 3 (Design)
  const designSection1Id = uuidv4();
  db.run(
    'INSERT OR IGNORE INTO sections (id, course_id, title, section_order) VALUES (?, ?, ?, ?)',
    [designSection1Id, course3Id, 'Design Principles', 1]
  );

  const designLessons = [
    [uuidv4(), designSection1Id, 'Introduction to UI/UX', 1, 'https://www.youtube.com/embed/c9Wg6Cb_YlU', '21:00'],
    [uuidv4(), designSection1Id, 'Color Theory Basics', 2, 'https://www.youtube.com/embed/Qj1FK8n7WgY', '17:30']
  ];

  for (const lesson of designLessons) {
    db.run(
      'INSERT OR IGNORE INTO lessons (id, section_id, title, lesson_order, youtube_url, duration) VALUES (?, ?, ?, ?, ?, ?)',
      lesson
    );
  }

  console.log('Additional course content created');
  console.log('Seeding completed!');
  console.log('\nSample accounts:');
  console.log('  Admin: admin@lms.com / password123');
  console.log('  Instructor: john@lms.com / password123');
  console.log('  Student: student@lms.com / password123');
}

seed().catch(console.error);
