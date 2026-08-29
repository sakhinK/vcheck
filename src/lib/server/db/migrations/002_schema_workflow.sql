-- 002_schema_workflow.sql
-- Idempotent: safe to re-run. Application workflow, audit trail, name edits.

CREATE TABLE IF NOT EXISTS applications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_no VARCHAR(30) NOT NULL UNIQUE,
  student_id BIGINT UNSIGNED NOT NULL,
  data_version_id BIGINT UNSIGNED NOT NULL,
  status ENUM(
    'pending','faculty_ack','advisor_pending','advisor_ack','faculty_review',
    'iad_pending','iad_ack','iad_dir_pending','processing','completed',
    'rejected','terminated'
  ) NOT NULL DEFAULT 'pending',
  current_round INT NOT NULL DEFAULT 1,
  assigned_advisor_id BIGINT UNSIGNED NULL,
  submitted_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_applications_student (student_id),
  KEY idx_applications_status (status),
  CONSTRAINT fk_applications_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_applications_version FOREIGN KEY (data_version_id) REFERENCES data_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Append-only audit trail: one row per transition, never updated/deleted.
CREATE TABLE IF NOT EXISTS application_audit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  round INT NOT NULL DEFAULT 1,
  from_status VARCHAR(30) NULL,
  to_status VARCHAR(30) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_role VARCHAR(50) NULL,
  comment TEXT NULL,
  visible_to_applicant TINYINT(1) NOT NULL DEFAULT 0,
  acted_on_behalf_of VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_application (application_id),
  CONSTRAINT fk_audit_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Every name change (officer/student) records old/new value, who, role, when
-- and why. This history is visible to BOTH the reviewer and the applicant.
CREATE TABLE IF NOT EXISTS name_edits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  data_version_id BIGINT UNSIGNED NOT NULL,
  old_primary VARCHAR(255) NULL,
  old_secondary VARCHAR(255) NULL,
  new_primary VARCHAR(255) NULL,
  new_secondary VARCHAR(255) NULL,
  edited_by BIGINT UNSIGNED NULL,
  role VARCHAR(50) NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_nameedits_version FOREIGN KEY (data_version_id) REFERENCES data_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Signed memo (faculty_review -> iad_pending) and signed letter
-- (processing -> completed) are application-scoped uploads.
CREATE TABLE IF NOT EXISTS application_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  doc_type ENUM('signed_memo','signed_letter') NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  uploaded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_appdocs_application (application_id, doc_type),
  CONSTRAINT fk_appdocs_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_user (user_id, read_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
