import db from '../db/init.js';

// Get all payments (Global)
export const getAllPayments = (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, c.full_name as candidate_name, c.personal_id_number 
      FROM Payments p 
      JOIN Candidates c ON p.candidate_id = c.id 
      ORDER BY p.payment_date DESC, p.created_at DESC
    `).all();
    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
};

// Get payments for a specific candidate
export const getCandidatePayments = (req, res) => {
  try {
    const payments = db.prepare('SELECT * FROM Payments WHERE candidate_id = ? ORDER BY payment_date DESC, created_at DESC').all(req.params.candidateId);
    
    // Calculate total paid
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    
    // Get candidate's total course fee to calculate outstanding balance
    const candidate = db.prepare('SELECT total_course_fee FROM Candidates WHERE id = ?').get(req.params.candidateId);
    
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    const outstandingBalance = candidate.total_course_fee - totalPaid;

    res.json({ 
      success: true, 
      data: payments, 
      summary: { totalPaid, outstandingBalance, totalCourseFee: candidate.total_course_fee } 
    });
  } catch (error) {
    console.error('Error fetching candidate payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
};

// Record a new payment
export const recordPayment = (req, res) => {
  const { candidate_id, amount, payment_date, payment_method, notes } = req.body;

  if (!candidate_id || !amount || !payment_date || !payment_method) {
    return res.status(400).json({ success: false, message: 'Candidate, Amount, Date, and Method are required' });
  }

  try {
    const candidate = db.prepare('SELECT total_course_fee FROM Candidates WHERE id = ?').get(candidate_id);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const pastPayments = db.prepare('SELECT amount FROM Payments WHERE candidate_id = ?').all(candidate_id);
    const totalPaid = pastPayments.reduce((sum, p) => sum + p.amount, 0);

    if (totalPaid + amount > candidate.total_course_fee) {
      if (!notes || notes.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot overpay the course fee without an explanation. Please provide notes for additional fees (e.g. extra lessons, failed tests).' 
        });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO Payments (candidate_id, amount, payment_date, payment_method, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(candidate_id, amount, payment_date, payment_method, notes);
    const newPayment = db.prepare('SELECT * FROM Payments WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, message: 'Payment recorded successfully', data: newPayment });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
};
