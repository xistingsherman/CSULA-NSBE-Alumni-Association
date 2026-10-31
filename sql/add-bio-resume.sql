-- Only needed if you created the tables BEFORE bios and resumes were added.
-- (A fresh setup gets these columns from schema.sql.)
-- If signed in as ADMIN, first run: ALTER SESSION SET CURRENT_SCHEMA = nsbe_app;

ALTER TABLE members ADD (
  bio                VARCHAR2(1500 CHAR),
  resume_object      VARCHAR2(300),
  resume_name        VARCHAR2(200),
  resume_uploaded_at TIMESTAMP,
  share_resume       NUMBER(1) DEFAULT 1 NOT NULL
);
