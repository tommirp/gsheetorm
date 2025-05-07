# GSheetORM

**GSheetORM** adalah sebuah ORM ringan untuk Google Spreadsheet yang memungkinkan kamu melakukan query seperti `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` dengan cara yang mirip dengan ORM tradisional seperti Entity Framework. Dengan `GSheetORM`, kamu dapat mengelola data di Google Sheets menggunakan sintaks query SQL-like, tanpa harus mengkhawatirkan implementasi teknis API Google Sheets.

---

## Fitur

- **SELECT** dengan opsi `WHERE` dan `ORDER BY`
- **LEFT JOIN** antar sheet
- **INSERT** (satu atau banyak data)
- **UPDATE** berdasarkan kondisi
- **DELETE** berdasarkan kondisi
- **Autentikasi dan konfigurasi langsung di dalam library**

---

## Cara Install

1. Install package via npm:

   ```bash
   npm install gsheetorm

2. Install googleapis

   ```bash
   npm install googleapis

---

## Cara Penggunaan

1. Autentikasi dan Konfigurasi
Untuk mulai menggunakan GSheetORM, kamu perlu mengonfigurasi autentikasi dengan GoogleAuth menggunakan kredensial JSON yang kamu dapatkan dari Google Cloud Console.
    ```bash
    const GSheetORM = require('gsheetorm');
    
    const orm = await new GSheetORM({
      credentials: require('./path-to-your-credentials.json'),
      sheetId: 'spreadsheetId', // ID dari spreadsheet
      sheetName: 'Sheet1', // Nama sheet di spreadsheet
    }).authenticate();

2. SELECT Data
Untuk mengambil data dari Google Sheets dengan filter dan urutan tertentu, gunakan method select() yang bisa di-chain dengan where() dan orderBy().
    ```bash
    // Ambil kolom Name dan Age, lalu filter hanya yang umur > 20 dan urutkan berdasarkan Name
    const data = await orm.select(['Name', 'Age'])
                          .where(row => row.Age > 20)
                          .orderBy('Name')
                          .getResults();
    
    console.log(data);

3. WHERE Clause
Filter data menggunakan where() yang menerima fungsi yang mengembalikan boolean.
      ```bash
      const data = await orm.select(['Name', 'Age'])
                      .where(row => row.Age > 25 && row.Name === 'Tommi')
                      .getResults();

      console.log(data);
      
4. ORDER BY Clause
Urutkan data menggunakan orderBy() berdasarkan kolom tertentu.
    ```bash
    const data = await orm.select(['Name', 'Age'])
                          .orderBy('Age', 'desc')
                          .getResults();

    console.log(data);
    
5. LEFT JOIN antar Sheet
Kamu bisa menggabungkan data dari sheet lain menggunakan method leftJoin().
    ```bash
    const data = await orm.select(['Name', 'Age'])
                          .leftJoin({
                            sheetName: 'AnotherSheet',
                            key: 'Name',
                            foreignKey: 'EmployeeName',
                            alias: 'employeeDetails'
                          })
                          .getResults();
    
    console.log(data);
    
6. INSERT Data
Menambahkan data ke Google Sheets bisa dilakukan dengan insert(). Kamu bisa menambah satu atau banyak data sekaligus.
    ```bash
    // Insert satu data
    await orm.insert({ Name: 'John Doe', Age: 30 });
    
    // Insert banyak data
    await orm.insert([{ Name: 'Jane Doe', Age: 25 }, { Name: 'Alex', Age: 28 }]);
    
7. UPDATE Data
Untuk mengupdate data berdasarkan kondisi, gunakan update().
    ```bash
    await orm.update(
      row => row.Name === 'John Doe', // kondisi yang sesuai dengan data
      row => ({ ...row, Age: 31 }) // update data
    );
    
8. DELETE Data
Untuk menghapus data berdasarkan kondisi, gunakan delete().
    ```bash
    await orm.delete(row => row.Name === 'John Doe');

---

## Struktur Data
1. select(columns): Menentukan kolom yang ingin ditampilkan.
2. where(fn): Menyaring data menggunakan fungsi filter.
3. orderBy(field, direction): Mengurutkan data berdasarkan kolom.
4. leftJoin({ sheetName, key, foreignKey, alias }): Melakukan join dengan sheet lain berdasarkan key yang ditentukan.
5. insert(data): Menambahkan satu atau banyak data ke spreadsheet.
6. update(matchFn, updateFn): Mengupdate data yang memenuhi kondisi tertentu.
7. delete(conditionFn): Menghapus data yang memenuhi kondisi tertentu.

---

## Kontribusi
Jika kamu menemukan bug atau ingin menambahkan fitur baru, silakan buka issue atau buat pull request di GitHub.

---

## Lisensi
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Buy me a Coffee
[![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/tommirp)
