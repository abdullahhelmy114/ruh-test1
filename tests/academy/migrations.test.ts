/**
 * Static guarantees for academy migrations and academy module boundaries.
 *
 * Migrations are reviewed, unexecuted SQL. These tests keep them strictly
 * additive: they may only create and drop their own academy_* objects, never
 * alter, update, delete or truncate a pre-existing table, and every forward
 * migration ships with a rollback.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const MIGRATIONS = join(ROOT, "db", "migrations");
const ACADEMY_SRC = join(ROOT, "src", "lib", "academy");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** Removes dollar-quoted bodies, line comments and block comments. */
function stripSql(text: string): string {
  return text
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "$$body$$")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

function statements(text: string): string[] {
  return stripSql(text)
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const upFiles = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".up.sql")).sort();
const downFiles = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".down.sql")).sort();

describe("academy migrations", () => {
  test("migrations exist, are numbered and come in up/down pairs", () => {
    assert.ok(upFiles.length >= 1);
    assert.deepEqual(
      upFiles.map((name) => name.replace(/\.up\.sql$/, "")),
      downFiles.map((name) => name.replace(/\.down\.sql$/, "")),
    );
    upFiles.forEach((name, index) => {
      assert.match(name, /^\d{4}_[a-z0-9_]+\.up\.sql$/);
      assert.equal(Number(name.slice(0, 4)), index + 1, "numbering has no gaps");
    });
    assert.ok(existsSync(join(MIGRATIONS, "README.md")));
  });

  for (const name of [...upFiles, ...downFiles]) {
    test(`${name}: documented header and single transaction`, () => {
      const text = read(join(MIGRATIONS, name));
      assert.ok(/Execution status/i.test(text) && /NOT EXECUTED/.test(text), "execution status must be stated");
      if (name.endsWith(".up.sql")) {
        for (const heading of ["Purpose", "Impact", "Rollback strategy"]) {
          assert.ok(text.includes(heading), `missing header section ${heading}`);
        }
        assert.match(text, /Strictly additive/i);
      }
      const parts = statements(text);
      assert.equal(parts[0], "BEGIN");
      assert.equal(parts[parts.length - 1], "COMMIT");
      assert.equal(parts.filter((part) => part === "BEGIN" || part === "COMMIT").length, 2);
      assert.equal(/\bV8[89]\b/i.test(text), false, "migrations never target historical source database versions");
    });
  }

  /** Only foreign keys between academy tables may be added to an existing academy table. */
  const ADD_FOREIGN_KEY =
    /^ALTER TABLE (academy_[a-z0-9_]+) ADD CONSTRAINT (academy_[a-z0-9_]+) FOREIGN KEY \([a-z0-9_, ]+\) REFERENCES (academy_[a-z0-9_]+) \([a-z0-9_, ]+\)$/;
  const DROP_FOREIGN_KEY = /^ALTER TABLE (academy_[a-z0-9_]+) DROP CONSTRAINT IF EXISTS (academy_[a-z0-9_]+)$/;

  const tablesCreatedUpTo = (index: number): Set<string> =>
    new Set(
      upFiles
        .slice(0, index + 1)
        .flatMap((file) => statements(read(join(MIGRATIONS, file))))
        .flatMap((s) => [...s.matchAll(/^CREATE TABLE (academy_[a-z0-9_]+)/g)].map((m) => m[1])),
    );

  upFiles.forEach((name, index) => {
    test(`${name}: strictly additive, academy_* objects only`, () => {
      const known = tablesCreatedUpTo(index);
      for (const statement of statements(read(join(MIGRATIONS, name)))) {
        if (statement === "BEGIN" || statement === "COMMIT") continue;
        const alter = ADD_FOREIGN_KEY.exec(statement);
        if (alter) {
          assert.ok(known.has(alter[1]), `${alter[1]} was not created by an academy migration`);
          assert.ok(known.has(alter[3]), `${alter[3]} was not created by an academy migration`);
          continue;
        }
        assert.match(
          statement,
          /^CREATE (TABLE|UNIQUE INDEX|INDEX|FUNCTION|TRIGGER) academy_[a-z0-9_]+/,
          `unexpected statement: ${statement.slice(0, 80)}`,
        );
        for (const match of statement.matchAll(/\b(?:ON|REFERENCES) ([a-z_][a-z0-9_]*)/gi)) {
          assert.ok(match[1].startsWith("academy_"), `${statement.slice(0, 60)} targets ${match[1]}`);
        }
        assert.equal(/\b(ALTER|DROP|TRUNCATE TABLE|DELETE FROM|UPDATE [a-z_]+ SET|INSERT INTO|ON DELETE|ON UPDATE)\b/i.test(statement), false, statement.slice(0, 80));
      }
    });
  });

  for (const name of downFiles) {
    test(`${name}: drops exactly what its forward migration created`, () => {
      const down = statements(read(join(MIGRATIONS, name))).filter((s) => s !== "BEGIN" && s !== "COMMIT");
      const up = statements(read(join(MIGRATIONS, name.replace(".down.sql", ".up.sql"))));

      const createdTables = new Set(up.flatMap((s) => [...s.matchAll(/^CREATE TABLE (academy_[a-z0-9_]+)/g)].map((m) => m[1])));
      const createdFunctions = new Set(up.flatMap((s) => [...s.matchAll(/^CREATE FUNCTION (academy_[a-z0-9_]+)/g)].map((m) => m[1])));
      const addedConstraints = new Set(up.map((s) => ADD_FOREIGN_KEY.exec(s)).filter(Boolean).map((m) => `${m?.[1]}.${m?.[2]}`));

      const droppedTables = new Set<string>();
      const droppedFunctions = new Set<string>();
      const droppedConstraints = new Set<string>();
      let sawTableDrop = false;
      for (const statement of down) {
        const table = /^DROP TABLE IF EXISTS (academy_[a-z0-9_]+)$/.exec(statement);
        const fn = /^DROP FUNCTION IF EXISTS (academy_[a-z0-9_]+)\([a-z, ]*\)$/.exec(statement);
        const constraint = DROP_FOREIGN_KEY.exec(statement);
        assert.ok(table || fn || constraint, `unexpected rollback statement: ${statement}`);
        if (table) {
          droppedTables.add(table[1]);
          sawTableDrop = true;
        }
        if (fn) droppedFunctions.add(fn[1]);
        if (constraint) {
          assert.equal(sawTableDrop, false, "added foreign keys are removed before any table is dropped");
          droppedConstraints.add(`${constraint[1]}.${constraint[2]}`);
        }
      }
      assert.deepEqual([...droppedTables].sort(), [...createdTables].sort());
      assert.deepEqual([...droppedFunctions].sort(), [...createdFunctions].sort());
      assert.deepEqual([...droppedConstraints].sort(), [...addedConstraints].sort());
    });
  }

  test("the audit trail and approval decisions are append-only at the database level", () => {
    const text = read(join(MIGRATIONS, "0001_academy_governance_foundation.up.sql"));
    for (const table of ["academy_audit_events", "academy_approval_decisions"]) {
      assert.match(text, new RegExp(`BEFORE UPDATE OR DELETE ON ${table}\\s+FOR EACH ROW EXECUTE FUNCTION academy_reject_mutation`));
      assert.match(text, new RegExp(`BEFORE TRUNCATE ON ${table}\\s+FOR EACH STATEMENT EXECUTE FUNCTION academy_reject_mutation`));
    }
  });

  test("the chain is coherent: foreign keys and trigger functions refer only to objects created earlier", () => {
    const tables = new Set<string>();
    const functions = new Set<string>();
    let references = 0;
    let triggers = 0;
    for (const file of upFiles) {
      for (const statement of statements(read(join(MIGRATIONS, file)))) {
        const created = /^CREATE TABLE (academy_[a-z0-9_]+)/.exec(statement)?.[1];
        for (const match of statement.matchAll(/\bREFERENCES (academy_[a-z0-9_]+)/g)) {
          references++;
          assert.ok(tables.has(match[1]) || match[1] === created, `${file}: ${match[1]} is referenced before a migration creates it`);
        }
        for (const match of statement.matchAll(/EXECUTE FUNCTION (academy_[a-z0-9_]+)/g)) {
          triggers++;
          assert.ok(functions.has(match[1]), `${file}: ${match[1]} is used before a migration creates it`);
        }
        if (created) tables.add(created);
        const fn = /^CREATE FUNCTION (academy_[a-z0-9_]+)/.exec(statement)?.[1];
        if (fn) functions.add(fn);
      }
    }
    assert.ok(references >= 60, `only ${references} references checked; the check would be vacuous`);
    assert.ok(triggers >= 5, `only ${triggers} trigger functions checked`);
  });

  for (const name of downFiles) {
    test(`${name}: warns about data loss and drops referencing tables before the tables they reference`, () => {
      const text = read(join(MIGRATIONS, name));
      assert.match(text, /Data loss warning/, "a rollback destroys data and must say so");
      const up = statements(read(join(MIGRATIONS, name.replace(".down.sql", ".up.sql"))));
      const dropOrder = statements(text)
        .map((s) => /^DROP TABLE IF EXISTS (academy_[a-z0-9_]+)$/.exec(s)?.[1])
        .filter((table): table is string => Boolean(table));
      for (const statement of up) {
        const table = /^CREATE TABLE (academy_[a-z0-9_]+)/.exec(statement)?.[1];
        if (!table) continue;
        for (const match of statement.matchAll(/\bREFERENCES (academy_[a-z0-9_]+)/g)) {
          if (match[1] === table || !dropOrder.includes(match[1])) continue;
          assert.ok(dropOrder.indexOf(table) < dropOrder.indexOf(match[1]), `${table} must be dropped before ${match[1]}`);
        }
      }
    });
  }

  test("the uniqueness the services rely on for concurrency is declared in the schema", () => {
    const schema = stripSql(upFiles.map((file) => read(join(MIGRATIONS, file))).join("\n")).replace(/\s+/g, " ");
    const expected: Record<string, RegExp> = {
      // one open enrollment per learner per class group (enroll / capacity)
      academy_enrollments_open_uq: /ON academy_enrollments \(class_group_id, learner_uid\) WHERE state IN \('pending', 'active', 'suspended'\)/,
      academy_class_group_teachers_active_uq: /ON academy_class_group_teachers \(class_group_id, teacher_uid\) WHERE unassigned_at IS NULL/,
      // attempts: one in progress, and attempt numbers never repeat (attempt limits under concurrency)
      academy_assessment_attempts_one_open_uq: /ON academy_assessment_attempts \(assignment_id, learner_uid\) WHERE state = 'in_progress'/,
      academy_assessment_attempts_number_uq: /UNIQUE \(assignment_id, learner_uid, attempt_number\)/,
      academy_completions_enrollment_uq: /ON academy_completions \(enrollment_id\)/,
      academy_certificates_one_issued_uq: /ON academy_certificates \(enrollment_id\) WHERE state = 'issued'/,
      academy_certificates_code_uq: /ON academy_certificates \(code\)/,
      academy_approval_gates_one_open_uq: /ON academy_approval_gates \( gate_type, subject_kind, subject_id, COALESCE\(subject_version_id,[^)]*\)\) WHERE state = 'open'/,
      academy_approval_decisions_one_per_person: /UNIQUE \(gate_id, decided_by\)/,
      academy_attendance_records_one_per_learner: /UNIQUE \(session_id, learner_uid\)/,
      academy_notifications_source_uq: /ON academy_notifications \(recipient_uid, kind, source_id\)/,
      academy_message_threads_pair_uq: /ON academy_message_threads \( participant_low_uid, participant_high_uid,/,
      academy_content_links_active_uq: /ON academy_content_links \(item_id, target_kind, target_id, purpose\) WHERE removed_at IS NULL/,
      academy_remediation_assignments_open_uq: /ON academy_remediation_assignments \(class_group_id, learner_uid, item_id\) WHERE state = 'assigned'/,
      academy_course_resources_active_uq: /ON academy_course_resources \( course_id, library_book_id,[^;]*WHERE removed_at IS NULL/,
      // one open or approved teacher application per account (duplicate applications)
      academy_teacher_applications_live_uq: /ON academy_teacher_applications \(applicant_uid\) WHERE state NOT IN \('rejected', 'withdrawn'\)/,
      // one history event per application revision (two decisions on the same revision)
      academy_teacher_application_events_revision_uq: /ON academy_teacher_application_events \(application_id, application_revision\)/,
    };
    for (const kind of ["curriculum_versions", "lesson_script_versions", "assessment_versions", "content_item_versions"]) {
      expected[`academy_${kind}_one_working_uq`] = new RegExp(`ON academy_${kind} \\(\\w+\\) WHERE state IN \\('draft', 'in_review', 'changes_requested', 'approved'\\)`);
      expected[`academy_${kind}_one_published_uq`] = new RegExp(`ON academy_${kind} \\(\\w+\\) WHERE state = 'published'`);
    }
    for (const [name, definition] of Object.entries(expected)) {
      const declared = new RegExp(`(?:CREATE UNIQUE INDEX ${name} |CONSTRAINT ${name} )`).exec(schema);
      assert.ok(declared, `${name} is not declared`);
      const rest = schema.slice(declared.index, declared.index + 400);
      assert.match(rest, definition, `${name} does not guard what the services rely on`);
    }
  });

  test("policy values have no class-group scope", () => {
    const text = read(join(MIGRATIONS, "0001_academy_governance_foundation.up.sql"));
    assert.match(text, /scope IN \('academy', 'program', 'course'\)/);
    assert.equal(/class_group/i.test(text), false);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("academy module boundaries", () => {
  const files = walk(ACADEMY_SRC).filter((path) => path.endsWith(".ts"));

  test("pure academy modules are framework-free and runnable by node --test", () => {
    for (const path of files) {
      const rel = relative(ROOT, path).replace(/\\/g, "/");
      if (rel === "src/lib/academy/server.ts") continue;
      const text = read(path);
      for (const match of text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"/gm)) {
        const specifier = match[1];
        assert.ok(specifier.startsWith("."), `${rel} imports ${specifier}`);
        assert.ok(specifier.endsWith(".ts"), `${rel} imports ${specifier} without a .ts extension`);
      }
      assert.equal(/^\s*import\s+"/m.test(text), false, `${rel} has a side-effect import`);
      assert.equal(/process\.env/.test(text), false, `${rel} reads the environment directly`);
      assert.equal(/^\s*(export\s+)?(declare\s+)?(const\s+)?enum\s/m.test(text), false, `${rel} uses an enum`);
      assert.equal(/^\s*(export\s+)?namespace\s/m.test(text), false, `${rel} uses a namespace`);
    }
  });

  test("only the server wiring touches the database client, and it is server-only", () => {
    const server = read(join(ACADEMY_SRC, "server.ts"));
    assert.match(server, /^import "server-only";$/m);
    for (const path of files) {
      const rel = relative(ROOT, path).replace(/\\/g, "/");
      if (rel === "src/lib/academy/server.ts") continue;
      assert.equal(/db\/client|@neondatabase/.test(read(path)), false, `${rel} touches the database client`);
    }
  });

  test("academy tests never import the server wiring", () => {
    for (const path of walk(join(ROOT, "tests", "academy"))) {
      const text = read(path);
      const specifiers = [...text.matchAll(/(?:from\s+|import\s*\(\s*)"([^"]+)"/g)].map((match) => match[1]);
      for (const specifier of specifiers) {
        assert.equal(/academy\/server(\.ts)?$/.test(specifier), false, `${path} imports ${specifier}`);
      }
    }
  });
});
