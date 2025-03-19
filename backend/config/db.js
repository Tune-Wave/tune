require('dotenv').config();
const mysql = require('mysql2/promise');  // Changed to promise version

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',  // XAMPP default is empty password
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
  ssl: false,  // XAMPP MySQL typically doesn't use SSL
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection (adjusted for promises)
async function testConnection() {
  try {
    const connection = await db.getConnection();
    console.log('Successfully connected to XAMPP MySQL');
    connection.release();
  } catch (err) {
    console.error('Error connecting to XAMPP MySQL:', err);
  }
}

testConnection();

module.exports = db;