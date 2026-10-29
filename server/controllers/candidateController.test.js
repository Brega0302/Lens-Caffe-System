/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import db from '../db/init.js';
import { createTestSession } from '../test/createTestSession.js';

describe('Candidate Controller API', () => {
  let token;
  beforeEach(async () => {
    db.exec('DELETE FROM Candidates');
    token = await createTestSession(request, app, db, 'candidate-test');
  });

  afterAll(() => {
    db.exec('DELETE FROM Candidates');
  });

  const sampleCandidate = {
    full_name: 'John Doe',
    dob: '1990-01-01',
    personal_id_number: '1234567890123',
    address: '123 Main St',
    phone_number: '555-1234',
    email: 'john@example.com',
    license_category: 'B',
    total_course_fee: 1500
  };

  it('should get all candidates (empty initially)', async () => {
    const res = await request(app).get('/api/candidates').set({ Authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('should create a new candidate', async () => {
    const res = await request(app).post('/api/candidates').set({ Authorization: `Bearer ${token}` }).send(sampleCandidate);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.full_name).toBe('John Doe');
  });

  it('should not create a candidate missing required fields', async () => {
    const res = await request(app).post('/api/candidates').set({ Authorization: `Bearer ${token}` }).send({ full_name: 'Jane' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should get a candidate by ID', async () => {
    const createRes = await request(app).post('/api/candidates').set({ Authorization: `Bearer ${token}` }).send(sampleCandidate);
    const id = createRes.body.data.id;

    const res = await request(app).get(`/api/candidates/${id}`).set({ Authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('should return 404 for non-existent candidate', async () => {
    const res = await request(app).get('/api/candidates/999').set({ Authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(404);
  });

  it('should update a candidate', async () => {
    const createRes = await request(app).post('/api/candidates').set({ Authorization: `Bearer ${token}` }).send(sampleCandidate);
    const id = createRes.body.data.id;

    const res = await request(app).put(`/api/candidates/${id}`).set({ Authorization: `Bearer ${token}` }).send({
      ...sampleCandidate,
      full_name: 'John Updated'
    });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.data.full_name).toBe('John Updated');
  });

  it('should delete a candidate', async () => {
    const createRes = await request(app).post('/api/candidates').set({ Authorization: `Bearer ${token}` }).send(sampleCandidate);
    const id = createRes.body.data.id;

    const res = await request(app).delete(`/api/candidates/${id}`).set({ Authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app).get(`/api/candidates/${id}`).set({ Authorization: `Bearer ${token}` });
    expect(getRes.statusCode).toBe(404);
  });
});
