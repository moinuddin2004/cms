import { readFileSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { PatientAccount } from '../../patient-auth/entities/patient-account.entity';
import { PatientAccountIdentity } from '../../patient-auth/entities/patient-account-identity.entity';
import { PatientLoginCode } from '../../patient-auth/entities/patient-login-code.entity';
import { PatientSession } from '../../patient-auth/entities/patient-session.entity';
import { PatientClaimToken } from '../../patient-links/entities/patient-claim-token.entity';
import { PatientAccessLog } from './patient-access-log.entity';
import { PatientAccountConsent } from './patient-account-consent.entity';
import { PatientProfile } from './patient-profile.entity';
import { PatientRecordLink } from './patient-record-link.entity';

/**
 * M2-01: the nine patient-identity entities must match the SQL contract
 * (database/changes/2026-11-12_patient_identity.sql and schema/02_tables.sql):
 * table name, every column, index and CHECK name.
 */
const ENTITIES: Array<[string, new () => object]> = [
  ['patient_accounts', PatientAccount],
  ['patient_account_identities', PatientAccountIdentity],
  ['patient_sessions', PatientSession],
  ['patient_login_codes', PatientLoginCode],
  ['patient_profiles', PatientProfile],
  ['patient_record_links', PatientRecordLink],
  ['patient_claim_tokens', PatientClaimToken],
  ['patient_account_consents', PatientAccountConsent],
  ['patient_access_log', PatientAccessLog],
];

const DB = join(__dirname, '..', '..', '..', 'database');
const CHANGE_SQL = readFileSync(
  join(DB, 'changes', '2026-11-12_patient_identity.sql'),
  'utf8',
);
const SCHEMA_SQL = readFileSync(join(DB, 'schema', '02_tables.sql'), 'utf8');

/** Column names declared in the CREATE TABLE block of `table`. */
function sqlColumns(sql: string, table: string): string[] {
  const m = new RegExp(
    `CREATE TABLE (?:IF NOT EXISTS )?${table} \\(\\r?\\n([\\s\\S]*?)\\r?\\n\\);`,
  ).exec(sql);
  if (!m) throw new Error(`no CREATE TABLE for ${table}`);
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('--') && !l.startsWith('CONSTRAINT'))
    .map((l) => l.split(/\s+/)[0]);
}

function sqlNames(sql: string, table: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of sql.matchAll(re)) {
    if (m[2] === table) out.push(m[1]);
  }
  return out;
}

describe('M2-01 patient identity entities vs SQL', () => {
  const storage = getMetadataArgsStorage();

  it.each(ENTITIES)('%s: table name', (table, cls) => {
    const t = storage.tables.find((x) => x.target === cls);
    expect(t?.name).toBe(table);
  });

  it.each(ENTITIES)('%s: every SQL column has a @Column', (table, cls) => {
    const entityCols = storage.columns
      .filter((c) => c.target === cls)
      .map((c) => c.options.name ?? c.propertyName);
    for (const sql of [CHANGE_SQL, SCHEMA_SQL]) {
      const cols = sqlColumns(sql, table);
      expect(cols.length).toBeGreaterThan(0);
      expect(entityCols.slice().sort()).toEqual(cols.slice().sort());
    }
  });

  it.each(ENTITIES)('%s: index names match the SQL', (table, cls) => {
    const entityIdx = storage.indices
      .filter((i) => i.target === cls)
      .map((i) => i.name)
      .sort();
    const re = /CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?(\w+) ON (\w+)/g;
    for (const sql of [CHANGE_SQL, SCHEMA_SQL]) {
      expect(sqlNames(sql, table, re).sort()).toEqual(entityIdx);
    }
  });

  it.each(ENTITIES)('%s: CHECK names match the SQL', (table, cls) => {
    const entityChecks = storage.checks
      .filter((c) => c.target === cls)
      .map((c) => c.name)
      .sort();
    for (const sql of [CHANGE_SQL, SCHEMA_SQL]) {
      const block = new RegExp(
        `CREATE TABLE (?:IF NOT EXISTS )?${table} \\(([\\s\\S]*?)\\r?\\n\\);`,
      ).exec(sql)![1];
      const sqlChecks = [...block.matchAll(/CONSTRAINT (chk_\w+) CHECK/g)]
        .map((m) => m[1])
        .sort();
      expect(sqlChecks).toEqual(entityChecks);
    }
  });

  it.each([
    'uq_patient_accounts_email',
    'uq_patient_profiles_self',
    'uq_patient_record_links_active_patient',
    'uq_patient_sessions_refresh_token_hash',
    'uq_patient_claim_tokens_token_hash',
    'uq_patient_account_identities_provider_subject',
  ])('declares unique index %s', (name) => {
    const idx = storage.indices.find((i) => i.name === name);
    expect(idx).toBeDefined();
    // uq_patient_accounts_email is an expression index (lower(email)),
    // declared in SQL only — the entity carries the name, not the columns.
    if (name !== 'uq_patient_accounts_email') expect(idx?.unique).toBe(true);
  });

  it('partial unique indexes carry their WHERE clause', () => {
    const where = (n: string) =>
      storage.indices.find((i) => i.name === n)?.where;
    expect(where('uq_patient_profiles_self')).toContain(`'self'`);
    expect(where('uq_patient_record_links_active_patient')).toContain(
      `'active'`,
    );
  });

  it('access log has no foreign keys and the legacy patients.user_id is untouched', () => {
    expect(
      storage.relations.filter((r) => r.target === PatientAccessLog),
    ).toHaveLength(0);
    const patientsBlock = /CREATE TABLE patients \(([\s\S]*?)\r?\n\);/.exec(
      SCHEMA_SQL,
    )![1];
    expect(patientsBlock).toContain('user_id');
    expect(CHANGE_SQL).not.toMatch(/ALTER TABLE patients/i);
  });
});
