import createDebug from 'debug';
import prisma, { disconnectPrisma } from '../src/prisma';

const log = createDebug('fallhelp:verify-db');

type TableRow = { readonly table_name: string };
type ForeignKeyRow = {
  readonly table_name: string;
  readonly column_name: string;
  readonly foreign_table_name: string;
  readonly foreign_column_name: string;
  readonly constraint_name: string;
  readonly update_rule: string;
  readonly delete_rule: string;
};
type ForeignKeySummaryRow = {
  readonly relation: string;
  readonly on_update: string;
  readonly on_delete: string;
};

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function main(): Promise<void> {
  log('Starting PostgreSQL schema verification');

  try {
    console.log('\n--- 1. Listing all tables in public schema ---');
    const allTables = await prisma.$queryRaw<TableRow[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    console.table(allTables);

    console.log('\n--- 2. Listing all table relations (foreign keys) ---');
    const foreignKeys = await prisma.$queryRaw<ForeignKeyRow[]>`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
       AND rc.constraint_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, kcu.column_name;
    `;
    const relationSummary: ForeignKeySummaryRow[] = foreignKeys.map((fk) => ({
      relation: `${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`,
      on_update: fk.update_rule,
      on_delete: fk.delete_rule,
    }));

    console.table(relationSummary);

    const missingChecks: string[] = [];
    const tableNames = new Set(allTables.map((row) => row.table_name));
    if (!tableNames.has('events') || !tableNames.has('notifications')) {
      missingChecks.push('required tables: events, notifications');
    }

    const hasNotificationEventFk = foreignKeys.some(
      (fk) =>
        fk.table_name === 'notifications' &&
        fk.column_name === 'eventId' &&
        fk.foreign_table_name === 'events' &&
        fk.foreign_column_name === 'id',
    );
    if (!hasNotificationEventFk) {
      missingChecks.push('notifications.eventId -> events.id foreign key');
    }

    if (missingChecks.length > 0) {
      console.error('\n❌ Verification failed. Missing/invalid schema objects:');
      for (const item of missingChecks) {
        console.error(`- ${item}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log(
      '\n✅ Verification complete. PostgreSQL schema is aligned with runtime requirements.',
    );
  } catch (error: unknown) {
    console.error(`\n❌ Verification failed: ${describeUnknownError(error)}`);
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
  }
}

void main();
