# docker-compose
Format: YAML
Top-level: object
Size: 2
Nested depth: 4

## Schema

- services: object (1 keys)
- volumes: object (1 keys)

## Preview

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: personal_os
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-personal_os}
      POSTGRES_DB: personal_os
    ports:
      - "127.0.0.1:54329:5432"
    volumes:
      - personal_os_postgres:/var/lib/postgresql/data

volumes:
  personal_os_postgres:

```