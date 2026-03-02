# Security

## Secret audit (for public sharing)

- **Git history:** Audited. `.env` appeared in past commits only with Auth0 domain and client ID (public). No API secrets (e.g. OpenAI key, Auth0 client secret) were found in repository history.
- **Local files:** Never commit `.env`, `.env.local`, or files under `.cursor/`. They are listed in `.gitignore`.
- **If a secret was ever exposed:** Rotate it immediately (OpenAI: https://platform.openai.com/api-keys; Auth0: dashboard). Do not push new commits that contain the old key.

## Reporting issues

If you find a security issue, please report it responsibly (e.g. private message or email) rather than posting publicly.
