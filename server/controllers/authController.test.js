/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import db from '../db/init.js';
import bcrypt from 'bcrypt';

describe('Auth Controller API', () => {
  beforeEach(async () => {
    db.exec('DELETE FROM Users');
    const hashedPassword = await bcrypt.hash('testpass', 10);
    db.prepare('INSERT INTO Users (username, password_hash) VALUES (?, ?)').run('testadmin', hashedPassword);
  });

  afterAll(() => {
    db.exec('DELETE FROM Users');
  });

  it('should login successfully with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'testadmin',
      password: 'testpass'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe('testadmin');
  });

  it('should fail login with incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'testadmin',
      password: 'wrongpass'
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should fail login with non-existent user', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'nobody',
      password: 'testpass'
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
