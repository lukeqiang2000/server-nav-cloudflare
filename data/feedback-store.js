'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'feedback.json');

function readFeedback() {
  try {
    const value = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

function writeFeedback(feedback) {
  fs.mkdirSync(__dirname, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(feedback, null, 2), 'utf8');
}

function updateFeedback(mutator) {
  const feedback = readFeedback();
  mutator(feedback);
  writeFeedback(feedback);
  return feedback;
}

function readBugs() {
  const bugs = readFeedback().bugs;
  return Array.isArray(bugs) ? bugs : [];
}

function writeBugs(bugs) {
  updateFeedback(feedback => {
    feedback.bugs = Array.isArray(bugs) ? bugs : [];
  });
}

function readSuggestions() {
  const suggestions = readFeedback().suggestions;
  return Array.isArray(suggestions) ? suggestions : [];
}

function writeSuggestions(suggestions) {
  updateFeedback(feedback => {
    feedback.suggestions = Array.isArray(suggestions) ? suggestions : [];
  });
}

module.exports = {
  FILE,
  readFeedback,
  writeFeedback,
  readBugs,
  writeBugs,
  readSuggestions,
  writeSuggestions
};
