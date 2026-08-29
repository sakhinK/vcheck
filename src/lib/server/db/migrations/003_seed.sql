-- 003_seed.sql
-- Dev-only sample users (one per role) and a sample student. The SSO mock and
-- dev login use these so the whole workflow can be exercised offline.

INSERT INTO users (email, name, role, is_dev) VALUES
  ('student@kkufa.dev', 'Anna Maria Eriksson', 'international_student', 1),
  ('faculty@kkufa.dev', 'Faculty Officer Demo', 'faculty_officer', 1),
  ('advisor@kkufa.dev', 'Advisor Demo', 'advisor', 1),
  ('iad@kkufa.dev', 'IAD Officer Demo', 'iad_officer', 1),
  ('director@kkufa.dev', 'IAD Director Demo', 'iad_director', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), is_dev = VALUES(is_dev);

INSERT INTO students (student_code, first_name, last_name, country, email, faculty, program, degree_level, status)
VALUES ('KKU-INT-0001', 'Anna', 'Eriksson', 'Sweden', 'student@kkufa.dev', 'Faculty of Engineering', 'B.Eng. Computer Engineering', 'Bachelor', 'active')
ON DUPLICATE KEY UPDATE student_code = VALUES(student_code);
