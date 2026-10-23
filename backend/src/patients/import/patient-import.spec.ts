import { Workbook } from 'exceljs';
import {
  addToDuplicateIndex,
  buildSheet,
  cellToString,
  emptyDuplicateIndex,
  findDuplicate,
  ImportFileError,
  importFileKind,
  mapImportRow,
  normalizeCnic,
  parseAge,
  parseBloodGroup,
  parseCsv,
  parseDate,
  parseGender,
  parseImportFile,
  parseMaritalStatus,
  phoneKey,
  splitPhones,
  suggestMapping,
  validateImportRow,
} from './patient-import';

const TODAY = new Date(2026, 9, 24); // 24 Oct 2026

describe('patient import — header mapping', () => {
  it('maps English and Roman Urdu headers', () => {
    const m = suggestMapping([
      'S.No',
      'Patient Name',
      'Mobile #',
      'CNIC No.',
      'Sex',
      'D.O.B',
      'Umar',
      'E-mail',
      'Pata',
      'City',
      'Blood Group',
      'Allergies',
      'Remarks',
      'MR No',
    ]);
    expect(m).toEqual({
      'S.No': null,
      'Patient Name': 'fullName',
      'Mobile #': 'phone',
      'CNIC No.': 'cnic',
      Sex: 'gender',
      'D.O.B': 'dob',
      Umar: 'age',
      'E-mail': 'email',
      Pata: 'address',
      City: 'city',
      'Blood Group': 'bloodGroup',
      Allergies: 'allergies',
      Remarks: 'notes',
      'MR No': 'legacyNumber',
    });
  });

  it('prefers the longer synonym and uses each field once', () => {
    const m = suggestMapping([
      'Name',
      'Contact No',
      'Emergency Contact No',
      'Phone',
      'Old File No',
    ]);
    expect(m['Name']).toBe('fullName');
    expect(m['Contact No']).toBe('phone');
    expect(m['Emergency Contact No']).toBe('emergencyContactPhone');
    expect(m['Phone']).toBeNull(); // phone already taken
    expect(m['Old File No']).toBe('legacyNumber');
  });

  it('matches headers that only contain a synonym', () => {
    const m = suggestMapping([
      'Patient Mobile Number',
      'Patient Date of Birth',
    ]);
    expect(m['Patient Mobile Number']).toBe('phone');
    expect(m['Patient Date of Birth']).toBe('dob');
  });
});

describe('patient import — file parsing', () => {
  it('parses CSV with quotes, escaped quotes, CRLF and a BOM', () => {
    const csv =
      '\uFEFFName,Notes\r\n"Khan, Ali","said ""hi""\nline 2"\r\nSara,\r\n';
    expect(parseCsv(csv)).toEqual([
      ['Name', 'Notes'],
      ['Khan, Ali', 'said "hi"\nline 2'],
      ['Sara', ''],
    ]);
  });

  it('detects semicolon and tab delimiters', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('builds keyed rows, skipping blank rows, naming blank/repeated headers', () => {
    const sheet = buildSheet([
      ['', ''],
      ['Name', 'Phone', '', 'Phone'],
      ['Ali', '0300', 'x', '0301'],
      ['', '', '', ''],
      [' Sara ', '0321'],
    ]);
    expect(sheet.headers).toEqual(['Name', 'Phone', 'Column 3', 'Phone (2)']);
    expect(sheet.rows).toEqual([
      { Name: 'Ali', Phone: '0300', 'Column 3': 'x', 'Phone (2)': '0301' },
      { Name: 'Sara', Phone: '0321', 'Column 3': '', 'Phone (2)': '' },
    ]);
  });

  it('rejects empty files and files over the row cap', () => {
    expect(() => buildSheet([])).toThrow(ImportFileError);
    expect(() => buildSheet([['Name']])).toThrow('no patient rows');
    expect(() => buildSheet([['Name'], ['a'], ['b'], ['c']], 2)).toThrow(
      'more than 2',
    );
  });

  it('turns exceljs cell values into strings', () => {
    expect(cellToString(new Date(Date.UTC(1990, 4, 7)))).toBe('1990-05-07');
    expect(cellToString(3001234567)).toBe('3001234567');
    expect(cellToString(4210112345671)).toBe('4210112345671');
    expect(cellToString(2.5)).toBe('2.5');
    expect(cellToString({ richText: [{ text: 'Al' }, { text: 'i ' }] })).toBe(
      'Ali',
    );
    expect(cellToString({ formula: 'A1', result: 42 })).toBe('42');
    expect(cellToString({ text: 'a@b.pk', hyperlink: 'mailto:a@b.pk' })).toBe(
      'a@b.pk',
    );
    expect(cellToString({ error: '#N/A' })).toBe('');
    expect(cellToString(null)).toBe('');
  });

  it('accepts .xlsx and .csv only', () => {
    const zip = Buffer.from([0x50, 0x4b, 3, 4, 0]);
    expect(importFileKind('a.CSV', Buffer.from('x'))).toBe('csv');
    expect(importFileKind('a.xlsx', zip)).toBe('xlsx');
    expect(importFileKind('a.xlsx', Buffer.from('nope!'))).toBeNull();
    expect(importFileKind('a.xls', zip)).toBeNull();
    expect(importFileKind('a.pdf', zip)).toBeNull();
  });

  it('reads the first sheet of a real xlsx', async () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Patients');
    ws.addRow(['Patient Name', 'Mobile', 'DOB']);
    ws.addRow(['Ali Khan', 3001234567, new Date(Date.UTC(1985, 0, 15))]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parseImportFile(buffer, 'old.xlsx');
    expect(parsed.headers).toEqual(['Patient Name', 'Mobile', 'DOB']);
    expect(parsed.rows).toEqual([
      { 'Patient Name': 'Ali Khan', Mobile: '3001234567', DOB: '1985-01-15' },
    ]);
    expect(parsed.suggestedMapping).toEqual({
      'Patient Name': 'fullName',
      Mobile: 'phone',
      DOB: 'dob',
    });
  });
});

describe('patient import — value normalisers', () => {
  it('splits and cleans phone numbers', () => {
    expect(splitPhones('0300-1234567')).toEqual(['0300-1234567']);
    expect(splitPhones(3001234567)).toEqual(['03001234567']);
    expect(splitPhones('3001234567.0')).toEqual(['03001234567']);
    expect(splitPhones('0300-1234567 / 0321-7654321')).toEqual([
      '0300-1234567',
      '0321-7654321',
    ]);
    expect(splitPhones('0300-1234567 0321-7654321')).toEqual([
      '0300-1234567',
      '0321-7654321',
    ]);
    expect(splitPhones("'+92 300 1234567")).toEqual(['+92 300 1234567']);
    expect(splitPhones('')).toEqual([]);
  });

  it('folds phone formats into one comparison key', () => {
    const key = '03001234567';
    expect(phoneKey('0300-1234567')).toBe(key);
    expect(phoneKey('+92 300 1234567')).toBe(key);
    expect(phoneKey('0092-300-1234567')).toBe(key);
    expect(phoneKey('923001234567')).toBe(key);
    expect(phoneKey('3001234567')).toBe(key);
  });

  it('formats CNICs', () => {
    expect(normalizeCnic('4210112345671')).toBe('42101-1234567-1');
    expect(normalizeCnic('42101-1234567-1')).toBe('42101-1234567-1');
    expect(normalizeCnic(4210112345671)).toBe('42101-1234567-1');
    expect(normalizeCnic('')).toBe('');
    expect(normalizeCnic('12345')).toBeNull();
  });

  it('reads gender, blood group and marital status words', () => {
    expect(parseGender('M')).toBe('male');
    expect(parseGender('Female')).toBe('female');
    expect(parseGender('aurat')).toBe('female');
    expect(parseGender('')).toBeUndefined();
    expect(parseGender('x?')).toBeNull();
    expect(parseBloodGroup('A+ve')).toBe('A+');
    expect(parseBloodGroup('b positive')).toBe('B+');
    expect(parseBloodGroup('AB -')).toBe('AB-');
    expect(parseBloodGroup('O Neg')).toBe('O-');
    expect(parseBloodGroup('')).toBeUndefined();
    expect(parseBloodGroup('Z')).toBeNull();
    expect(parseMaritalStatus('Shadi shuda')).toBe('married');
    expect(parseMaritalStatus('unmarried')).toBe('single');
    expect(parseMaritalStatus('??')).toBeNull();
  });

  it('parses dates day-first, with month names, years and Excel serials', () => {
    expect(parseDate('1990-05-07', TODAY)).toBe('1990-05-07');
    expect(parseDate('07/05/1990', TODAY)).toBe('1990-05-07');
    expect(parseDate('7-5-90', TODAY)).toBe('1990-05-07');
    expect(parseDate('05/25/1990', TODAY)).toBe('1990-05-25'); // can only be m/d
    expect(parseDate('7 May 1990', TODAY)).toBe('1990-05-07');
    expect(parseDate('May 7, 1990', TODAY)).toBe('1990-05-07');
    expect(parseDate('12-Jan-05', TODAY)).toBe('2005-01-12');
    expect(parseDate('1990', TODAY)).toBe('1990-01-01');
    expect(parseDate('32874', TODAY)).toBe('1990-01-01');
    expect(parseDate('31/02/1990', TODAY)).toBeNull();
    expect(parseDate('soon', TODAY)).toBeNull();
  });

  it('parses ages in years and months', () => {
    expect(parseAge('35')).toBe(420);
    expect(parseAge('35 years')).toBe(420);
    expect(parseAge('35Y')).toBe(420);
    expect(parseAge('40 saal')).toBe(480);
    expect(parseAge('6 months')).toBe(6);
    expect(parseAge('200')).toBeNull();
    expect(parseAge('old')).toBeNull();
  });
});

describe('patient import — row mapping and validation', () => {
  it('maps a full row into a create payload', () => {
    const { dto, errors } = mapImportRow(
      {
        fullName: '  Ali   Khan ',
        phone: '0300-1234567 / 0321-7654321',
        cnic: '4210112345671',
        gender: 'M',
        dob: '15/01/1985',
        email: 'ALI@Example.com',
        bloodGroup: 'B+ve',
        city: 'Karachi',
        notes: 'Prefers mornings',
        legacyNumber: 'MR-77',
      },
      TODAY,
    );
    expect(errors).toEqual([]);
    expect(dto).toEqual({
      fullName: 'Ali Khan',
      phone: '0300-1234567',
      cnic: '42101-1234567-1',
      gender: 'male',
      dob: '1985-01-15',
      email: 'ali@example.com',
      bloodGroup: 'B+',
      city: 'Karachi',
      internalNotes:
        'Prefers mornings\nOld file no: MR-77\nOther phone: 0321-7654321',
      source: 'other',
      tags: ['imported'],
    });
  });

  it('turns an age into 1 Jan of the birth year and notes it', () => {
    const { dto } = mapImportRow(
      { fullName: 'A', phone: '03001234567', age: '35' },
      TODAY,
    );
    expect(dto.dob).toBe('1991-01-01');
    expect(dto.internalNotes).toBe('Date of birth estimated from age 35');
    // An age typed in the DOB column works too.
    expect(
      mapImportRow(
        { fullName: 'A', phone: '03001234567', dob: '40 yrs' },
        TODAY,
      ).dto.dob,
    ).toBe('1986-01-01');
  });

  it('joins first and last name when there is no full name', () => {
    const { dto } = mapImportRow(
      { firstName: 'Sara', lastName: 'Ahmed', phone: '03001234567' },
      TODAY,
    );
    expect(dto.fullName).toBe('Sara Ahmed');
  });

  it('reports unreadable values', () => {
    const { errors } = mapImportRow(
      {
        fullName: 'A',
        phone: 'call me',
        cnic: '123',
        gender: 'x',
        dob: '31/31/2000',
        bloodGroup: 'Q',
      },
      TODAY,
    );
    expect(errors).toHaveLength(5);
    expect(
      mapImportRow(
        { fullName: 'A', phone: '03001234567', dob: '2030-01-01' },
        TODAY,
      ).errors,
    ).toEqual(['Date of birth cannot be in the future']);
  });

  it('applies the create DTO rules (required name/phone, email, lengths)', async () => {
    const empty = await validateImportRow({}, TODAY);
    expect(empty.errors).toEqual(
      expect.arrayContaining([
        'Full name is required',
        'Phone number is required',
      ]),
    );
    const bad = await validateImportRow(
      {
        fullName: 'x'.repeat(151),
        phone: '03001234567',
        email: 'not-an-email',
      },
      TODAY,
    );
    expect(bad.errors).toEqual(
      expect.arrayContaining([
        'Invalid email address',
        'Full name must be shorter than or equal to 150 characters',
      ]),
    );
    const ok = await validateImportRow(
      { fullName: 'Ali', phone: '03001234567' },
      TODAY,
    );
    expect(ok.errors).toEqual([]);
  });

  it('does not repeat a phone problem it already explained', async () => {
    const r = await validateImportRow(
      { fullName: 'Ali', phone: '0300 1234567 1234567 12' },
      TODAY,
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^Phone number/);
  });
});

describe('patient import — duplicates', () => {
  it('finds duplicates by normalised phone, then CNIC', () => {
    const index = emptyDuplicateIndex();
    addToDuplicateIndex(
      index,
      '+92 300 1234567',
      '42101-1234567-1',
      'P-00001 (Ali)',
    );
    expect(findDuplicate(index, '0300-1234567', undefined)).toEqual({
      by: 'phone',
      label: 'P-00001 (Ali)',
    });
    expect(findDuplicate(index, '03219999999', '4210112345671')).toEqual({
      by: 'cnic',
      label: 'P-00001 (Ali)',
    });
    expect(findDuplicate(index, '03219999999', undefined)).toBeNull();
  });

  it('keeps the first label for a key', () => {
    const index = emptyDuplicateIndex();
    addToDuplicateIndex(index, '03001234567', null, 'row 1');
    addToDuplicateIndex(index, '03001234567', null, 'row 2');
    expect(findDuplicate(index, '03001234567', null)?.label).toBe('row 1');
  });
});
