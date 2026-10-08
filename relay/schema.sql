-- Один запрос — одна строка. Значений здесь нет: только шифр и хеши токенов.
CREATE TABLE IF NOT EXISTS requests (
  id          TEXT PRIMARY KEY,
  meta        TEXT NOT NULL,     -- описание запроса, зашифрованное секретом ссылки
  submit_hash TEXT NOT NULL,     -- хеш токена ответа
  owner_hash  TEXT NOT NULL,     -- хеш токена автора
  answer      TEXT,              -- зашифрованный ответ, один
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  answered_at INTEGER
);
CREATE INDEX IF NOT EXISTS requests_expires ON requests (expires_at);
