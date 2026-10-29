import db from '../db/init.js';

// Get all candidates
export const getAllCandidates = (req, res) => {
  try {
    // console.log("Fetching all candidates from DB..."); // TODO: remove later
    const candidates = db.prepare('SELECT * FROM Candidates ORDER BY created_at DESC').all();
    res.json({ success: true, data: candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch candidates' });
  }
};

// Get single candidate by ID
export const getCandidateById = (req, res) => {
  try {
    const candidate = db.prepare('SELECT * FROM Candidates WHERE id = ?').get(req.params.id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    res.json({ success: true, data: candidate });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch candidate' });
  }
};

// Create a new candidate
export const createCandidate = (req, res) => {
  const { full_name, dob, personal_id_number, address, phone_number, email, license_category } = req.body;

  // REQ-F-02: Validation
  if (!full_name || !personal_id_number || !license_category) {
    return res.status(400).json({ success: false, message: 'Full Name, ID Number, and License Category are required' });
  }

  // Exact 13 digits for JMBG
  if (!/^\d{13}$/.test(personal_id_number)) {
    return res.status(400).json({ success: false, message: 'Personal ID Number (JMBG) must be exactly 13 digits' });
  }

  try {
    // REQ-F-03: Duplicate check
    const existing = db.prepare('SELECT id FROM Candidates WHERE personal_id_number = ?').get(personal_id_number);
    if (existing) {
      return res.status(409).json({ success: false, message: 'A candidate with this Personal ID Number already exists' });
    }

    const categoryPrices = {
      'A': 900,
      'B': 1925,
      'C': 1850,
      'E': 710,
      'D': 3000
    };
    const total_course_fee = categoryPrices[license_category] || 0;

    const stmt = db.prepare(`
      INSERT INTO Candidates (full_name, dob, personal_id_number, address, phone_number, email, license_category, total_course_fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(full_name, dob, personal_id_number, address, phone_number, email, license_category, total_course_fee);
    
    // Fetch the newly created candidate to return
    const newCandidate = db.prepare('SELECT * FROM Candidates WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, message: 'Candidate registered successfully', data: newCandidate });
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ success: false, message: 'Failed to register candidate' });
  }
};

// Update existing candidate
export const updateCandidate = (req, res) => {
  const { id } = req.params;
  const { full_name, dob, personal_id_number, address, phone_number, email, license_category, status, theory_test_passed, practical_test_passed, total_course_fee } = req.body;

  if (!full_name || !personal_id_number || !license_category) {
    return res.status(400).json({ success: false, message: 'Full Name, ID Number, and License Category are required' });
  }

  // Exact 13 digits for JMBG
  if (!/^\d{13}$/.test(personal_id_number)) {
    return res.status(400).json({ success: false, message: 'Personal ID Number (JMBG) must be exactly 13 digits' });
  }

  try {
    // Check if duplicate ID exists for a DIFFERENT candidate
    const existing = db.prepare('SELECT id FROM Candidates WHERE personal_id_number = ? AND id != ?').get(personal_id_number, id);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Another candidate with this Personal ID Number already exists' });
    }

    const stmt = db.prepare(`
      UPDATE Candidates 
      SET full_name = ?, dob = ?, personal_id_number = ?, address = ?, phone_number = ?, email = ?, license_category = ?, status = ?, theory_test_passed = ?, practical_test_passed = ?, total_course_fee = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    // convert booleans to 1/0 for sqlite
    const theoryVal = theory_test_passed ? 1 : 0;
    const practicalVal = practical_test_passed ? 1 : 0;

    const result = stmt.run(full_name, dob, personal_id_number, address, phone_number, email, license_category, status, theoryVal, practicalVal, total_course_fee, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    const updatedCandidate = db.prepare('SELECT * FROM Candidates WHERE id = ?').get(id);
    res.json({ success: true, message: 'Profile updated successfully', data: updatedCandidate });
  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ success: false, message: 'Failed to update candidate' });
  }
};

// Delete candidate
export const deleteCandidate = (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM Candidates WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    res.json({ success: true, message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ success: false, message: 'Failed to delete candidate' });
  }
};
