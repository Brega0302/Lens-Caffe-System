/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import db from '../db/init.js';
import { createTestSession } from '../test/createTestSession.js';

describe('Lesson Controller API', () => {
  let candidateId;
  let token;

  beforeEach(async () => {
    db.exec('DELETE FROM Lessons');
    db.exec('DELETE FROM Candidates');
    token = await createTestSession(request, app, db, 'lesson-test');

    const stmt = db.prepare(`INSERT INTO Candidates (full_name, dob, personal_id_number, license_category) VALUES (?, ?, ?, ?)`);
    const info = stmt.run('Lesson Tester', '1990-01-01', '55555', 'B');
    candidateId = info.lastInsertRowid;
  });

  afterAll(() => {
    db.exec('DELETE FROM Lessons');
    db.exec('DELETE FROM Candidates');
  });

  it('should log a new lesson', async () => {
    const res = await request(app).post('/api/lessons').set({ Authorization: `Bearer ${token}` }).send({
      candidate_id: candidateId,
      lesson_date: '2023-10-10',
      lesson_time: '14:00-15:00',
      instructor_name: 'Suad',
      duration_hours: 2,
      notes: ''
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.duration_hours).toBe(2);
  });

  it('should enforce 35-hour limit for category B without notes', async () => {
    // Pre-insert 34 hours
    db.prepare('INSERT INTO Lessons (candidate_id, lesson_date, instructor_name, duration_hours) VALUES (?, ?, ?, ?)').run(candidateId, '2023-10-01', 'Suad', 34);

    const res = await request(app).post('/api/lessons').set({ Authorization: `Bearer ${token}` }).send({
      candidate_id: candidateId,
      lesson_date: '2023-10-10',
      instructor_name: 'Suad',
      duration_hours: 2, // Total: 36
      notes: ''
    });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Category B limits to 35 hours/);
  });

  it('should allow >35 hours for category B if notes provided', async () => {
    db.prepare('INSERT INTO Lessons (candidate_id, lesson_date, instructor_name, duration_hours) VALUES (?, ?, ?, ?)').run(candidateId, '2023-10-01', 'Suad', 34);

    const res = await request(app).post('/api/lessons').set({ Authorization: `Bearer ${token}` }).send({
      candidate_id: candidateId,
      lesson_date: '2023-10-10',
      instructor_name: 'Suad',
      duration_hours: 2,
      notes: 'Extra hours requested by candidate'
    });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should fetch lessons for a candidate', async () => {
    db.prepare('INSERT INTO Lessons (candidate_id, lesson_date, instructor_name, duration_hours) VALUES (?, ?, ?, ?)').run(candidateId, '2023-10-01', 'Suad', 2);
    const res = await request(app).get(`/api/lessons/candidate/${candidateId}`).set({ Authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});
