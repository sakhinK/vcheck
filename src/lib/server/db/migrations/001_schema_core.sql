-- 001_schema_core.sql
-- Idempotent: safe to re-run. Core identity tables.

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role ENUM('international_student','faculty_officer','advisor','iad_officer','iad_director') NOT NULL,
  is_dev TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Registry of international students. `user_id` is linked when the person
-- first logs in with a matching email (one-time link).
CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  student_code VARCHAR(50) NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NULL,
  email VARCHAR(255) NOT NULL,
  faculty VARCHAR(255) NULL,
  program VARCHAR(255) NULL,
  degree_level VARCHAR(50) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  registered_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_students_email (email),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Passport/visa/insurance data is stored as *versions*, never overwritten.
-- Identity fields that come from the MRZ are written only by the server scan
-- path; the application layer never accepts them from a form.
CREATE TABLE IF NOT EXISTS data_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  version_no INT NOT NULL,
  status ENUM('draft','locked') NOT NULL DEFAULT 'draft',
  -- MRZ-protected identity (server scan only)
  passport_number VARCHAR(20) NULL,
  date_of_birth DATE NULL,
  passport_expiry_date DATE NULL,
  passport_issue_date DATE NULL,
  nationality VARCHAR(3) NULL,
  sex CHAR(1) NULL,
  -- Name: two identifiers kept separate and in MRZ order.
  name_primary VARCHAR(255) NULL,
  name_secondary VARCHAR(255) NULL,
  name_source ENUM('mrz','applicant_edited','officer_edited') NULL,
  name_certified TINYINT(1) NOT NULL DEFAULT 0,
  name_certified_at DATETIME NULL,
  mrz_raw_name_primary VARCHAR(255) NULL,
  mrz_raw_name_secondary VARCHAR(255) NULL,
  dates_incomplete TINYINT(1) NOT NULL DEFAULT 0,
  -- Visa
  visa_start_date DATE NULL,
  visa_entry_date DATE NULL,
  visa_last_allowed_date DATE NULL,
  phone VARCHAR(50) NULL,
  -- Insurance
  insurance_company VARCHAR(255) NULL,
  insurance_start_date DATE NULL,
  insurance_end_date DATE NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_versions_student_no (student_id, version_no),
  CONSTRAINT fk_versions_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Uploaded attachments (checklist: passport_photo, visa_stamp, entry_stamp,
-- student_evidence, insurance) plus the signed memo/letter are handled by
-- application_documents because they belong to an application, not a person.
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  data_version_id BIGINT UNSIGNED NULL,
  doc_key ENUM('passport_photo','visa_stamp','entry_stamp','student_evidence','insurance') NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  uploaded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_documents_version (data_version_id),
  KEY idx_documents_key (student_id, doc_key),
  CONSTRAINT fk_documents_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_version FOREIGN KEY (data_version_id) REFERENCES data_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
