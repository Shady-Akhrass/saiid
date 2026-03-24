// Lightweight helper for storing form availability and closed messages in localStorage
// This only affects the current browser (localStorage) and doesn't call any server.

const STORAGE_KEY = 'formsAvailability';

function _readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read formsAvailability from localStorage', err);
    return null;
  }
}

function _writeStorage(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || {}));
  } catch (err) {
    console.error('Failed to write formsAvailability to localStorage', err);
  }
}

// Returns an object like { orphan: true, aid: true, patient: true, shelter: true }
export function getFormsAvailability() {
  const data = _readStorage();
  if (data && typeof data === 'object') return data;
  // default: all enabled
  const defaults = { orphan: true, aid: true, patient: true, shelter: true };
  _writeStorage(defaults);
  return defaults;
}

// Returns boolean (true = visible/open). If unknown, returns default true.
export function isFormAvailable(formName) {
  const data = getFormsAvailability();
  if (!formName) return true;
  return !!data[formName];
}

// Set availability for a single formName (e.g. 'patient'). This updates localStorage immediately.
export function setFormAvailability(formName, available) {
  if (!formName) return;
  const data = getFormsAvailability();
  data[formName] = !!available;
  _writeStorage(data);
}

// Get or set the closed message shown when a form is closed. Stored separately per form key in localStorage.
export function getClosedMessage(formName) {
  if (!formName) return '';
  try {
    return localStorage.getItem(`${formName}FormClosedMessage`) || '';
  } catch (err) {
    console.error('Failed to get closed message', err);
    return '';
  }
}

export function setClosedMessage(formName, message) {
  if (!formName) return;
  try {
    localStorage.setItem(`${formName}FormClosedMessage`, message || '');
  } catch (err) {
    console.error('Failed to set closed message', err);
  }
}

// Replace the entire availability object
export function setAllFormsAvailability(obj) {
  if (!obj || typeof obj !== 'object') return;
  const allowed = ['orphan', 'aid', 'patient', 'shelter'];
  const out = {};
  for (const k of allowed) {
    out[k] = !!obj[k];
  }
  _writeStorage(out);
}

// Example usage (in comments):
// import { getFormsAvailability, setFormAvailability, getClosedMessage, setClosedMessage } from '../utils/formsAvailability';
// const avail = getFormsAvailability();
// setFormAvailability('patient', false);
// setClosedMessage('patient', 'النموذج مغلق مؤقتاً');

export default {
  getFormsAvailability,
  isFormAvailable,
  setFormAvailability,
  getClosedMessage,
  setClosedMessage,
  setAllFormsAvailability,
};
