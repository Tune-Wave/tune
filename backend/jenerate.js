require('dotenv').config();
const jwt = require('jsonwebtoken');

const payload = { userId: 123, role: 'admin' };  // Customize as needed
const secretKey = process.env.JWT_SECRET || 'your_secret_key';
const options = { expiresIn: '1h' };  // Token expires in 1 hour

const token = jwt.sign(payload, secretKey, options);

console.log('Generated JWT Token:', token);
