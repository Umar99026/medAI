-- Demo users for production (password: password123)
-- bcrypt hash: $2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-gp-1', 'gp@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Sarah Chen', 'GP', NULL, 0, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-cardio-1', 'cardio@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. James Okonkwo (Live)', 'SPECIALIST', 'Cardiology', 0, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-derm-1', 'derm@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Priya Sharma (Live)', 'SPECIALIST', 'Dermatology', 0, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-cardio', 'dummy.cardio@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. James Okonkwo', 'SPECIALIST', 'Cardiology', 1, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-derm', 'dummy.derm@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Priya Sharma', 'SPECIALIST', 'Dermatology', 1, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-ortho', 'dummy.ortho@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Michael Torres', 'SPECIALIST', 'Orthopaedics', 1, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-psych', 'dummy.psych@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Emily Walsh', 'SPECIALIST', 'Psychiatry', 1, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-gastro', 'dummy.gastro@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Anna Kowalski', 'SPECIALIST', 'Gastroenterology', 1, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-resp', 'dummy.resp@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Robert Singh', 'SPECIALIST', 'Respiratory Medicine', 1, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-neuro', 'dummy.neuro@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Lisa Nguyen', 'SPECIALIST', 'Neurology', 1, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-endo', 'dummy.endo@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. David Park', 'SPECIALIST', 'Endocrinology', 1, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-rheum', 'dummy.rheum@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Sophie Martin', 'SPECIALIST', 'Rheumatology', 1, datetime('now'));

INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "name", "role", "specialty", "isDummy", "createdAt")
VALUES ('seed-dummy-urology', 'dummy.urology@medai.local', '$2b$10$vrT6vFR60oR4Vy2htG21zeBSJpaHgLrgwOzPdjo7For1/.TCoYYgO', 'Dr. Ahmed Hassan', 'SPECIALIST', 'Urology', 1, datetime('now'));
