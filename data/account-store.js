'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'account.json');

function readAccount() {
  try {
    const value = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

function writeAccount(account) {
  fs.mkdirSync(__dirname, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(account, null, 2), 'utf8');
}

function updateAccount(mutator) {
  const account = readAccount();
  mutator(account);
  writeAccount(account);
  return account;
}

function readUsers() {
  const users = readAccount().users;
  return Array.isArray(users) ? users : [];
}

function writeUsers(users) {
  updateAccount(account => {
    account.version = account.version || 1;
    account.users = Array.isArray(users) ? users : [];
  });
}

function readSessions() {
  const sessions = readAccount().sessions;
  if (Array.isArray(sessions)) return sessions;
  if (sessions && typeof sessions === 'object') {
    return Object.entries(sessions).map(([token, session]) => ({ token, ...session }));
  }
  return [];
}

function writeSessions(sessions) {
  updateAccount(account => {
    account.version = account.version || 1;
    account.sessions = Array.isArray(sessions) ? sessions : [];
  });
}

function readChatStore() {
  const store = readAccount().chat_store;
  return store && typeof store === 'object' ? store : {
    groupMessages: { lobby: [] },
    privateMessages: {},
    groupMembers: { lobby: [] }
  };
}

function writeChatStore(store) {
  updateAccount(account => {
    account.version = account.version || 1;
    account.chat_store = store && typeof store === 'object' ? store : {};
  });
}

module.exports = {
  FILE,
  readAccount,
  writeAccount,
  readUsers,
  writeUsers,
  readSessions,
  writeSessions,
  readChatStore,
  writeChatStore
};
