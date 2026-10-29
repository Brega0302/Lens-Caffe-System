import db from '../db/init.js';

// Get lessons for a specific candidate
export const getCandidateLessons = (req, res) => {
  try {
    const lessons = db.prepare('SELECT * FROM Lessons WHERE candidate_id = ? ORDER BY lesson_date DESC, created_at DESC').all(req.params.candidateId);
    
    // Calculate total duration
    const totalDuration = lessons.reduce((sum, l) => sum + l.duration_hours, 0);

    res.json({ 
      success: true, 
      data: lessons, 
      summary: { totalDuration, totalLessons: lessons.length } 
    });
  } catch (error) {
    console.error('Error fetching candidate lessons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lessons' });
  }
};

// Log a new lesson
export const logLesson = (req, res) => {
  const { candidate_id, lesson_date, lesson_time, instructor_name, duration_hours, notes } = req.body;

  if (!candidate_id || !lesson_date || !instructor_name || !duration_hours) {
    return res.status(400).json({ success: false, message: 'Candidate, Date, Instructor, and Duration are required' });
  }

  try {
    const candidate = db.prepare('SELECT license_category FROM Candidates WHERE id = ?').get(candidate_id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (candidate.license_category === 'B') {
      const existingLessons = db.prepare('SELECT SUM(duration_hours) as total_duration FROM Lessons WHERE candidate_id = ?').get(candidate_id);
      const currentTotal = existingLessons.total_duration || 0;
      const newTotal = currentTotal + duration_hours;

      if (newTotal > 35 && (!notes || notes.trim() === '')) {
        return res.status(400).json({ 
          success: false, 
          message: `Category B limits to 35 hours. Since this pushes total to ${newTotal} hours, an explanation in notes is required.` 
        });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO Lessons (candidate_id, lesson_date, lesson_time, instructor_name, duration_hours, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(candidate_id, lesson_date, lesson_time || null, instructor_name, duration_hours, notes);
    const newLesson = db.prepare('SELECT * FROM Lessons WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, message: 'Lesson logged successfully', data: newLesson });
  } catch (error) {
    console.error('Error logging lesson:', error);
    res.status(500).json({ success: false, message: 'Failed to log lesson' });
  }
};
