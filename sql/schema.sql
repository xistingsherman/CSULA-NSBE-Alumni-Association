-- Cal State LA NSBE Alumni Association: MySQL / MariaDB schema
-- Import once in cPanel > phpMyAdmin: pick your database on the left, then Import this file
-- (or paste it into the SQL tab). Times are stored in UTC.

CREATE TABLE IF NOT EXISTS members (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email               VARCHAR(254) NOT NULL,
  password_hash       VARCHAR(200) NULL,
  member_status       ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  member_role         ENUM('member', 'admin') NOT NULL DEFAULT 'member',
  first_name          VARCHAR(60)  NOT NULL,
  last_name           VARCHAR(60)  NOT NULL,
  grad_year           SMALLINT UNSIGNED NULL,
  major               VARCHAR(80)  NOT NULL DEFAULT '',
  job_title           VARCHAR(100) NOT NULL DEFAULT '',
  company             VARCHAR(100) NOT NULL DEFAULT '',
  industry            VARCHAR(60)  NOT NULL DEFAULT '',
  city                VARCHAR(80)  NOT NULL DEFAULT '',
  open_to             VARCHAR(200) NOT NULL DEFAULT '',   -- comma-separated: Mentoring,Referrals,Coffee chats
  linkedin_url        VARCHAR(200) NOT NULL DEFAULT '',
  bio                 VARCHAR(1500) NOT NULL DEFAULT '',
  resume_object       VARCHAR(300) NULL,                  -- file path inside the GCP bucket
  resume_name         VARCHAR(200) NULL,                  -- original file name, shown to the member
  resume_uploaded_at  DATETIME(3)  NULL,
  share_resume        TINYINT(1)   NOT NULL DEFAULT 1,    -- 1 = other members can download their resume
  share_email         TINYINT(1)   NOT NULL DEFAULT 0,    -- 1 = other members can see their email
  listed              TINYINT(1)   NOT NULL DEFAULT 1,    -- 1 = appears in the directory
  is_temp             TINYINT(1)   NOT NULL DEFAULT 0,    -- 1 = temporary admin from TEMP_ADMIN_* settings
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY members_email_uq (email),
  KEY members_status_ix (member_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  CHAR(64)     NOT NULL,   -- SHA-256 of the cookie token; the token itself is never stored
  member_id   INT UNSIGNED NOT NULL,
  expires_at  DATETIME(3)  NOT NULL,
  PRIMARY KEY (token_hash),
  KEY sessions_member_ix (member_id),
  CONSTRAINT sessions_member_fk FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS join_requests (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name  VARCHAR(60)  NOT NULL,
  last_name   VARCHAR(60)  NOT NULL,
  email       VARCHAR(254) NOT NULL,
  grad_year   SMALLINT UNSIGNED NULL,
  major       VARCHAR(80)  NOT NULL DEFAULT '',
  interest    VARCHAR(80)  NOT NULL DEFAULT '',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
