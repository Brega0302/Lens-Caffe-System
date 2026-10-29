/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import db from '../db/init.js';
import { createTestSession } from '../test/createTestSession.js';

describe('Payment Controller API', () => {
  let candidateId;
  let token;

  beforeEach(async () => {
    db.exec('DELETE FROM Payments');
    db.exec('DELETE FROM Candidates');
    token = await createTestSession(request, app, db, 'payment-test');

    const stmt = db.prepare(`INSERT INTO Candidates (full_name, dob, personal_id_number, license_category, total_course_fee) VALUES (?, ?, ?, ?, ?)`);
    const info = stmt.run('Payment Tester', '1990-01-01', '66666', 'B', 1500);
    candidateId = info.lastInsertRowid;
  });

  afterAll(() => {
    db.exec('DELETE FROM Payments');
    db.exec('DELETE FROM Candidates');
  });

  it('should record a payment successfully', async () => {
    const res = await request(app).post('/api/quattrodrive/payments').set({ Authorization: `Bearer ${token}` }).send({
      candidate_id: candidateId,
      amount: 500,
      payment_date: '2023-10-10',
      payment_method: 'Cash'
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(500);
  });

  it('should prevent overpayment and negative balance', async () => {
    const res = await request(app).post('/api/quattrodrive/payments').set({ Authorization: `Bearer ${token}` }).send({
      candidate_id: candidateId,
      amount: 2000, // Fee is 1500
      payment_date: '2023-10-10',
      payment_method: 'Cash'
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Cannot overpay the course fee without an explanation/);
  });

  it('should fetch payments for a candidate', async () => {
    db.prepare('INSERT INTO Payments (candidate_id, amount, payment_date, payment_method) VALUES (?, ?, ?, ?)').run(candidateId, 200, '2023-10-01', 'Cash');
    const res = await request(app).get(`/api/quattrodrive/payments/candidate/${candidateId}`).set({ Authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});
