#!/usr/bin/env node
'use strict';

/**
 * Tourbine — Password Reset Tool
 *
 * Run with:  node reset-password.js
 *
 * Works even when the server is not running (accesses SQLite directly).
 * Requires that a password has already been set via the /dashboard/setup page.
 */

const path = require('path');
const readline = require('readline');

let Database, bcrypt;
try {
  Database = require('better-sqlite3');
  bcrypt = require('bcrypt');
} catch (e) {
  console.error('Missing dependencies. Run `npm install` first.');
  process.exit(1);
}

const DB_PATH = path.join(__dirname, 'data', 'tourbine.db');

// ── helpers ──────────────────────────────────────────────────────────────────

function prompt(rl, question, hidden = false) {
  return new Promise((resolve) => {
    if (hidden && process.stdout.isTTY) {
      // Suppress echo for password input
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      let input = '';
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = (ch) => {
        if (ch === '\n' || ch === '\r' || ch === '\u0003') {
          if (ch === '\u0003') { process.stdout.write('\n'); process.exit(0); }
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(input);
        } else if (ch === '\u007f' || ch === '\b') {
          if (input.length > 0) { input = input.slice(0, -1); }
        } else {
          input += ch;
          process.stdout.write('•');
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(question, resolve);
    }
  });
}

function box(text) {
  const line = '─'.repeat(text.length + 2);
  return `┌${line}┐\n│ ${text} │\n└${line}┘`;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + box('Tourbine — Password Reset') + '\n');

  let db;
  try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  } catch (e) {
    console.error(`Could not open database at ${DB_PATH}`);
    console.error('Make sure Tourbine has been started at least once to initialise the database.');
    process.exit(1);
  }

  // Check that a password has already been set
  const row = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get();
  if (!row || !row.value) {
    console.error('No password has been set yet. Use the /dashboard/setup page to create one first.');
    db.close();
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  const newPassword = await prompt(rl, 'Enter new password: ', true);
  if (!newPassword || newPassword.length < 8) {
    console.error('\n✖ Password must be at least 8 characters.');
    db.close();
    rl.close();
    process.exit(1);
  }

  const confirm = await prompt(rl, 'Confirm new password: ', true);
  rl.close();

  if (newPassword !== confirm) {
    console.error('\n✖ Passwords do not match. No changes were made.');
    db.close();
    process.exit(1);
  }

  console.log('\nHashing password…');
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare("UPDATE settings SET value = ? WHERE key = 'password_hash'").run(hash);
  db.close();

  console.log('\n✔ Password updated successfully. You can now log in at /dashboard/login.\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
