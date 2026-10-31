-- Creates a dedicated database user for the website, so the app never connects as ADMIN.
-- Run as ADMIN in Oracle Cloud > Autonomous Database > Database Actions > SQL.
-- Replace the password with a long random one and keep it for ORACLE_PASSWORD.

CREATE USER nsbe_app IDENTIFIED BY "Replace-With-A-Long-Random-Password-1";
GRANT CREATE SESSION, CREATE TABLE TO nsbe_app;
ALTER USER nsbe_app QUOTA 200M ON DATA;

-- Then create the tables inside that user's schema (still signed in as ADMIN):
--   ALTER SESSION SET CURRENT_SCHEMA = nsbe_app;
--   ...and run everything in schema.sql
