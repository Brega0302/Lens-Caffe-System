import db from '../db/init.js';

export const getDashboardSummary = (req, res) => {
  try {
    // 1. Active Candidates (status = 'In Progress')
    const activeCandidatesQuery = db.prepare("SELECT COUNT(*) as count FROM Candidates WHERE status = 'In Progress'").get();
    const activeCandidates = activeCandidatesQuery.count;

    // 2. Today's Lessons
    const today = new Date().toISOString().split('T')[0];
    const todaysLessonsQuery = db.prepare("SELECT COUNT(*) as count FROM Lessons WHERE lesson_date = ?").get(today);
    const todaysLessons = todaysLessonsQuery.count;

    // 3. Monthly Revenue
    const currentMonth = today.slice(0, 7); // 'YYYY-MM'
    const monthlyRevenueQuery = db.prepare("SELECT SUM(amount) as total FROM Payments WHERE payment_date LIKE ?").get(`${currentMonth}%`);
    const monthlyRevenue = monthlyRevenueQuery.total || 0;

    // 4. Outstanding Balances
    // Sum of all total_course_fee
    const totalFeesQuery = db.prepare("SELECT SUM(total_course_fee) as total FROM Candidates").get();
    const totalFees = totalFeesQuery.total || 0;
    // Sum of all payments
    const totalPaymentsQuery = db.prepare("SELECT SUM(amount) as total FROM Payments").get();
    const totalPayments = totalPaymentsQuery.total || 0;
    const outstandingBalance = totalFees - totalPayments;

    // 5. Today's Schedule List
    const schedule = db.prepare(`
      SELECT l.id, l.lesson_date, l.lesson_time, l.instructor_name, l.duration_hours, c.full_name as candidate_name
      FROM Lessons l
      JOIN Candidates c ON l.candidate_id = c.id
      WHERE l.lesson_date = ?
      ORDER BY l.created_at ASC
    `).all(today);

    // 6. Alerts (Candidates with unpaid fees)
    // We fetch candidates, then sum their payments, and only return those whose paid < fee.
    // For simplicity, we can do it in SQL:
    const alerts = db.prepare(`
      SELECT c.id, c.full_name, c.total_course_fee, COALESCE(SUM(p.amount), 0) as total_paid
      FROM Candidates c
      LEFT JOIN Payments p ON c.id = p.candidate_id
      GROUP BY c.id
      HAVING total_paid < c.total_course_fee
      ORDER BY (c.total_course_fee - total_paid) DESC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        activeCandidates,
        todaysLessons,
        monthlyRevenue,
        outstandingBalance,
        schedule,
        alerts: alerts.map(a => ({
          ...a,
          owed: a.total_course_fee - a.total_paid
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard summary' });
  }
};
