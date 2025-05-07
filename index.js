const { google } = require('googleapis');

class GSheetORM {
  constructor(config) {
    this.config = config;
    this.sheetId = config.sheetId;
    this.sheetName = config.sheetName || 'Sheet1';
    this.maxCols = 15;
    this.maxRows = 500000;
    this.data = [];
  }

  async authenticate() {
    const auth = new google.auth.GoogleAuth({
      credentials: this.config.credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.authClient = await auth.getClient();
    this.sheets = google.sheets({ version: 'v4', auth: this.authClient });
    return this;
  }

  async _loadSheet(sheetName) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: sheetName,
    });
    const [header, ...rows] = res.data.values || [];
    return rows.map(row =>
      Object.fromEntries(header.map((key, i) => [key, row[i] || null]))
    );
  }

  async select(columns = []) {
    const all = await this._loadSheet(this.sheetName);
    if (all.length > this.maxRows || (all[0] && Object.keys(all[0]).length > this.maxCols)) {
      throw new Error('Exceeded maximum allowed columns or rows');
    }
    this.data = all;
    if (columns.length > 0) {
      this.data = this.data.map(row =>
        Object.fromEntries(Object.entries(row).filter(([k]) => columns.includes(k)))
      );
    }
    return this;
  }

  where(fn) {
    this.data = this.data.filter(fn);
    return this;
  }

  orderBy(field, direction = 'asc') {
    this.data.sort((a, b) => {
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      if (valA === valB) return 0;
      return (direction === 'desc' ? valA < valB : valA > valB) ? 1 : -1;
    });
    return this;
  }

  async leftJoin({ sheetName, key, foreignKey, alias }) {
    const joinData = await this._loadSheet(sheetName);
    const joinMap = new Map();
    for (const row of joinData) {
      joinMap.set(row[key], row);
    }

    this.data = this.data.map(row => {
      const joined = joinMap.get(row[foreignKey]);
      return joined ? { ...row, [alias]: joined } : row;
    });
    return this;
  }

  async insert(data) {
    const values = Array.isArray(data) ? data : [data];
    const keys = Object.keys(values[0]);
    const rows = values.map(obj => keys.map(k => obj[k]));
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: this.sheetName,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
    return { inserted: rows.length };
  }

  async update(matchFn, updateFn) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: this.sheetName,
    });
    const [header, ...rows] = res.data.values || [];
    let updated = 0;
    const newRows = rows.map(row => {
      const obj = Object.fromEntries(header.map((k, i) => [k, row[i] || null]));
      if (matchFn(obj)) {
        const updatedObj = updateFn(obj);
        updated++;
        return header.map(k => updatedObj[k] || '');
      }
      return row;
    });
    newRows.unshift(header);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: this.sheetName,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newRows },
    });
    return { updated };
  }

  async delete(conditionFn) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: this.sheetName,
    });
    const [header, ...rows] = res.data.values || [];
    const filtered = rows.filter(row => {
      const obj = Object.fromEntries(header.map((k, i) => [k, row[i] || null]));
      return !conditionFn(obj);
    });
    filtered.unshift(header);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: this.sheetName,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: filtered },
    });
    return { deleted: rows.length - filtered.length + 1 };
  }

  getResults() {
    return this.data;
  }
}

module.exports = GSheetORM;