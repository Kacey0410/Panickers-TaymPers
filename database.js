const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db;

// Initialize database connection
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // Check if database file exists and is corrupted
    const dbPath = path.join(__dirname, 'tasks.db');
    
    // Create database connection
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        // If database is corrupted, try to delete and recreate
        if (err.code === 'SQLITE_NOTADB' || err.errno === 26) {
          console.log('⚠️  Database file is corrupted. Attempting to recreate...');
          try {
            if (fs.existsSync(dbPath)) {
              fs.unlinkSync(dbPath);
              console.log('✓ Deleted corrupted database file');
            }
            // Retry connection
            db = new sqlite3.Database(dbPath, (retryErr) => {
              if (retryErr) {
                reject(retryErr);
              } else {
                createTables(resolve, reject);
              }
            });
          } catch (deleteErr) {
            reject(deleteErr);
          }
        } else {
          reject(err);
        }
      } else {
        createTables(resolve, reject);
      }
    });
  });
}

// Create database tables
function createTables(resolve, reject) {
  db.serialize(() => {
    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        console.error('Error enabling foreign keys:', err);
        reject(err);
        return;
      }
    });
    
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
        reject(err);
        return;
      }
    });

    // Tasks table
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        dueDate DATE NOT NULL,
        subject TEXT,
        priority TEXT DEFAULT 'medium',
        completed BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating tasks table:', err);
        reject(err);
        return;
      }
      console.log('✓ Database tables created successfully');
      resolve();
    });
  });
}

// User functions
function createUser(firstName, lastName, email, username, password) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (firstName, lastName, email, username, password) VALUES (?, ?, ?, ?, ?)`,
      [firstName, lastName, email, username, password],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id, firstName, lastName, email, username FROM users WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getAllUsers() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT id, firstName, lastName, email, username, createdAt FROM users ORDER BY createdAt DESC`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Task functions
function createTask(userId, title, description, dueDate, subject, priority) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO tasks (userId, title, description, dueDate, subject, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, title, description, dueDate, subject, priority || 'medium'],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getTasksByUserId(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM tasks WHERE userId = ? ORDER BY dueDate ASC`,
      [userId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

function getTaskById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM tasks WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function updateTask(id, title, description, dueDate, subject, priority, completed) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE tasks SET title = ?, description = ?, dueDate = ?, subject = ?, priority = ?, completed = ? WHERE id = ?`,
      [title, description, dueDate, subject, priority, completed ? 1 : 0, id],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function deleteTask(id) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM tasks WHERE id = ?`, [id], function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initializeDatabase,
  createUser,
  getUserById,
  getUserByUsername,
  getAllUsers,
  createTask,
  getTasksByUserId,
  getTaskById,
  updateTask,
  deleteTask,
  closeDatabase
};
