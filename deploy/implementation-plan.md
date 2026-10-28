# Deployment and operator handover

Scope: root Docker Compose, environment setup, Nginx/Caddy, launch and backup scripts, operator documentation. Application implementation belongs to the other workstreams.

1. Confirm backend environment names and seed semantics; keep React /admin separate from /api/admin/.
2. Add PostgreSQL persistent storage and health checks, migration-before-start backend, static frontend and same-origin API proxy.
3. Add optional HTTPS overlay requiring an actual domain and explicit production settings.
4. Add secret generation and native Windows launch scripts using real executables, plus dump/restore scripts that do not corrupt binary output through PowerShell redirection.
5. Document operation in Russian and validate PowerShell syntax and Compose structure. Record unavailable Docker runtime checks as pending.
