// Deploy: Extensions > Apps Script in a Google Sheet, paste this file as Code.gs,
// set SECRET_KEY below to a password of your choosing, then Deploy > New deployment
// > Web app (execute as: Me, access: Anyone). Paste the resulting /exec URL and this
// SECRET_KEY into the habit app's "Set up backup" screen.
//
// Storage model: full-state replace. The app sends its complete local entries +
// weeklyNotes on every push and this script overwrites the sheet contents to match.
// The client is responsible for merging before it pushes.

const SECRET_KEY = "change-me";

const ENTRIES_SHEET = "Entries";
const ENTRIES_HEADERS = ["id", "date", "categoryId", "data"];
const NOTES_SHEET = "WeeklyNotes";
const NOTES_HEADERS = ["weekStart", "text", "updatedAt"];

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action !== "pull") throw new Error("Unknown action: " + action);
    checkKey(e.parameter.key);
    return jsonResponse({
      entries: readEntries(),
      weeklyNotes: readWeeklyNotes(),
    });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action !== "push") throw new Error("Unknown action: " + body.action);
    checkKey(body.key);
    writeEntries(Array.isArray(body.entries) ? body.entries : []);
    writeWeeklyNotes(body.weeklyNotes && typeof body.weeklyNotes === "object" ? body.weeklyNotes : {});
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function checkKey(key) {
  if (key !== SECRET_KEY) throw new Error("Invalid key");
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function readEntries() {
  const sheet = getOrCreateSheet(ENTRIES_SHEET, ENTRIES_HEADERS);
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const [id, date, categoryId, data] = rows[i];
    if (!id) continue;
    let extra = {};
    try { extra = data ? JSON.parse(data) : {}; } catch (err) { extra = {}; }
    out.push(Object.assign({ id: String(id), date: String(date), categoryId: String(categoryId) }, extra));
  }
  return out;
}

function writeEntries(entries) {
  const sheet = getOrCreateSheet(ENTRIES_SHEET, ENTRIES_HEADERS);
  sheet.clear();
  sheet.appendRow(ENTRIES_HEADERS);
  if (entries.length === 0) return;
  const rows = entries.map((e) => {
    const { id, date, categoryId, ...rest } = e;
    return [id, date, categoryId, JSON.stringify(rest)];
  });
  sheet.getRange(2, 1, rows.length, ENTRIES_HEADERS.length).setValues(rows);
}

function readWeeklyNotes() {
  const sheet = getOrCreateSheet(NOTES_SHEET, NOTES_HEADERS);
  const rows = sheet.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const [weekStart, text, updatedAt] = rows[i];
    if (!weekStart) continue;
    out[String(weekStart)] = { text: String(text || ""), updatedAt: Number(updatedAt) || 0 };
  }
  return out;
}

function writeWeeklyNotes(weeklyNotes) {
  const sheet = getOrCreateSheet(NOTES_SHEET, NOTES_HEADERS);
  sheet.clear();
  sheet.appendRow(NOTES_HEADERS);
  const keys = Object.keys(weeklyNotes);
  if (keys.length === 0) return;
  const rows = keys.map((weekStart) => [weekStart, weeklyNotes[weekStart].text || "", weeklyNotes[weekStart].updatedAt || 0]);
  sheet.getRange(2, 1, rows.length, NOTES_HEADERS.length).setValues(rows);
}
