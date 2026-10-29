/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import db from '../db/init.js';
import bcrypt from 'bcrypt';

describe('Dashboard Controller API', () => {
  let token;
  beforeEach(async () => {
    db.exec('DELETE FROM Lessons');
    db.exec('DELETE FROM Payments');
    db.exec('DELETE FROM Candidates');
    db.exec('DELETE FROM UserSessions; DELETE FROM Users');
    const hash = await bcrypt.hash('dashboard-test', 4);
    db.prepare("INSERT INTO Users(username,password_hash,role,is_active) VALUES('dashboard-test',?,'OWNER',1)").run(hash);
    token = (await request(app).post('/api/auth/login').send({ username: 'dashboard-test', password: 'dashboard-test' })).body.token;
  });

  afterAll(() => {
    db.exec('DELETE FROM Lessons');
    db.exec('DELETE FROM Payments');
    db.exec('DELETE FROM Candidates');
  });

  it('should return dashboard summary metrics', async () => {
    // Insert dummy candidate
    const stmt = db.prepare(`INSERT INTO Candidates (full_name, dob, personal_id_number, license_category, total_course_fee) VALUES (?, ?, ?, ?, ?)`);
    stmt.run('Dash Tester', '1995-01-01', '11111', 'B', 1500);
    
    const res = await request(app).get('/api/quattrodrive/dashboard/summary').set({ Authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('activeCandidates');
    expect(res.body.data).toHaveProperty('todaysLessons');
    expect(res.body.data).toHaveProperty('monthlyRevenue');
    expect(res.body.data).toHaveProperty('outstandingBalance');
    expect(res.body.data.activeCandidates).toBe(1);
    expect(res.body.data.outstandingBalance).toBe(1500);
  });
});
