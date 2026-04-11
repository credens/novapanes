const request = require('supertest');
const app = require('../server'); // Assuming server exports the app

describe('API Tests', () => {
  test('GET /products should return products', async () => {
    const response = await request(app).get('/products');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('POST /api/contact should validate and respond', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        nombre: 'Test User',
        email: 'test@example.com',
        telefono: '123456789',
        mensaje: 'Test message'
      });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('POST /api/contact with invalid data should fail', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        nombre: '',
        email: 'invalid',
        telefono: '',
        mensaje: ''
      });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});