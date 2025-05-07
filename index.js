const { google } = require('googleapis');

class GSheetORM {
  constructor(auth, spreadsheetId, sheetName) {
    this.auth = auth;
    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
    this.headers = [];
    this.query = {};
  }

  static async authenticate({ credentials, spreadsheetId, sheetName }) {
    const { client_email, private_key } = credentials;
    const jwtClient = new google.auth.JWT(
      client_email,
      null,
      private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    await jwtClient.authorize();
    const orm = new GSheetORM(jwtClient, spreadsheetId, sheetName);
    await orm.initHeaders();
    return orm;
  }

  async initHeaders() {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.sheetName,
    });
    this.headers = res.data.values[0];
  }

  select(columns = []) {
    this.query.select = columns;
    return this;
  }

  where(condition = {}) {
    this.query.where = condition;
    return this;
  }

  orderBy(column, direction = 'asc') {
    this.query.orderBy = { column, direction };
    return this;
  }

  join(sheetName, localKey, foreignKey, alias = null, selectColumns = []) {
    if (!this.query.joins) this.query.joins = [];
    this.query.joins.push({ sheetName, localKey, foreignKey, alias, selectColumns });
    return this;
  }

  async run() {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.sheetName,
    });

    const rows = res.data.values.slice(1).map(row => {
      const obj = {};
      this.headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    let filtered = [...rows];

    if (this.query.where) {
      filtered = filtered.filter(row =>
        Object.entries(this.query.where).every(([key, value]) => row[key] == value)
      );
    }

    if (this.query.orderBy) {
      const { column, direction } = this.query.orderBy;
      filtered.sort((a, b) => {
        const valA = a[column] || '';
        const valB = b[column] || '';
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    if (this.query.joins && this.query.joins.length > 0) {
      for (const join of this.query.joins) {
        const resJoin = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: join.sheetName,
        });

        const joinHeaders = resJoin.data.values[0];
        const joinData = resJoin.data.values.slice(1).map(row => {
          const obj = {};
          joinHeaders.forEach((h, i) => {
            obj[h] = row[i];
          });
          return obj;
        });

        const joinMap = new Map();
        for (const row of joinData) {
          joinMap.set(row[join.foreignKey], row);
        }

        filtered = filtered.map(row => {
          const match = joinMap.get(row[join.localKey]);
          if (match) {
            const selectedJoinData = {};
            const aliasPrefix = join.alias || join.sheetName;

            join.selectColumns.forEach(col => {
              selectedJoinData[`${aliasPrefix}.${col}`] = match[col];
            });

            return { ...row, ...selectedJoinData };
          }
          return row;
        });
      }
    }

    if (this.query.select && this.query.select.length > 0) {
      filtered = filtered.map(row => {
        const selected = {};
        this.query.select.forEach(col => {
          selected[col] = row[col];
        });
        return selected;
      });
    }

    this.resetQuery();
    return filtered;
  }

  async insertOne(data) {
    const row = this.headers.map(h => data[h] || '');
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: this.sheetName,
      valueInputOption: 'RAW',
      resource: { values: [row] },
    });

    const updatedRange = res.data.updates.updatedRange;
    const match = updatedRange.match(/![A-Z]+(\d+)$/);
    const rowNumber = match ? parseInt(match[1]) : null;

    const totalCells = this.headers.length * rowNumber;
    const full = totalCells >= 500000;

    return { success: true, rowNumber, full };
  }

  async insertMany(dataArray) {
    const rows = dataArray.map(data =>
      this.headers.map(h => data[h] || '')
    );

    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: this.sheetName,
      valueInputOption: 'RAW',
      resource: { values: rows },
    });

    const updatedRange = res.data.updates.updatedRange;
    const match = updatedRange.match(/![A-Z]+(\d+)$/);
    const rowNumber = match ? parseInt(match[1]) : null;
    const totalCells = this.headers.length * rowNumber;
    const full = totalCells >= 500000;

    return { success: true, rowNumber, full };
  }

  async update(where, data) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.sheetName,
    });

    const values = res.data.values;
    const updated = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowObj = {};
      this.headers.forEach((h, j) => {
        rowObj[h] = row[j];
      });

      if (Object.entries(where).every(([k, v]) => rowObj[k] == v)) {
        const updatedRow = [...row];
        this.headers.forEach((h, j) => {
          if (h in data) updatedRow[j] = data[h];
        });
        values[i] = updatedRow;
        updated.push(i + 1);
      }
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: this.sheetName,
      valueInputOption: 'RAW',
      resource: { values },
    });

    return { success: true, updated };
  }

  // async delete(where) {
  //   const res = await this.sheets.spreadsheets.values.get({
  //     spreadsheetId: this.spreadsheetId,
  //     range: this.sheetName,
  //   });

  //   const values = res.data.values;
  //   const newValues = [values[0]];
  //   const deleted = [];

  //   for (let i = 1; i < values.length; i++) {
  //     const row = values[i];
  //     const rowObj = {};
  //     this.headers.forEach((h, j) => {
  //       rowObj[h] = row[j];
  //     });

  //     if (Object.entries(where).every(([k, v]) => rowObj[k] == v)) {
  //       deleted.push(i + 1);
  //     } else {
  //       newValues.push(row);
  //     }
  //   }

  //   await this.sheets.spreadsheets.values.update({
  //     spreadsheetId: this.spreadsheetId,
  //     range: this.sheetName,
  //     valueInputOption: 'RAW',
  //     resource: { values: newValues },
  //   });

  //   return { success: true, deleted };
  // }
  
  async delete(where) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.sheetName,
    });
  
    const values = res.data.values;
    const newValues = [values[0]];  // Baris header tetap
  
    const deleted = [];
  
    // Proses untuk mengecek baris yang sesuai dengan kondisi 'where'
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowObj = {};
      
      // Membuat objek rowObj berdasarkan header
      this.headers.forEach((h, j) => {
        rowObj[h] = row[j];
      });
  
      // Jika baris memenuhi kondisi 'where', maka baris tersebut "dihapus"
      if (Object.entries(where).every(([key, value]) => rowObj[key] == value)) {
        deleted.push(i + 1);  // Menyimpan nomor baris yang dihapus
      } else {
        // Jika baris tidak dihapus, tambahkan ke newValues
        newValues.push(row);
      }
    }
  
    // Melakukan update untuk menghapus baris yang sesuai
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: this.sheetName,
      valueInputOption: 'RAW',
      resource: { values: newValues },
    });
  
    return { success: true, deleted };  // Mengembalikan baris yang dihapus
  }
    
  resetQuery() {
    this.query = {};
  }
}

module.exports = GSheetORM;
