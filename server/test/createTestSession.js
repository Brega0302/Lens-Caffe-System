import bcrypt from 'bcrypt';

export async function createTestSession(request, app, db, username = 'test-owner') {
  db.exec('DELETE FROM UserSessions; DELETE FROM Users');
  const hash = await bcrypt.hash('test-password', 4);
  db.prepare("INSERT INTO Users(username,password_hash,role,is_active) VALUES(? ,?,'OWNER',1)").run(username, hash);
  const response = await request(app).post('/api/auth/login').send({ username, password: 'test-password' });
  return response.body.token;
}
