# Развёртывание бэкенда на своём сервере

Пошагово и без предположений о том, что у вас уже настроено.
Всё, где нужен ваш ввод, помечено ▢.

## 0. Что нужно до начала

▢ Сервер: 2 vCPU / 4 ГБ / 40 ГБ SSD — оценка, для игры этого достаточно
  с большим запасом. Ubuntu 24.04 подойдёт без настройки.
▢ Домен и доступ к его DNS (для сертификата нужен открытый 80-й порт).
▢ Почтовый ящик с возможностью SMTP: без него перенесённые пользователи
  не смогут войти.
▢ Проверить, что приложение сейчас открывается по HTTPS и что вы знаете,
  где оно лежит на GitHub Pages.

## 1. Сервер: базовые правила

```bash
# пользователь, от которого работает приложение, без shell
sudo adduser --system --group --no-create-home comeonplay

# только эти порты наружу
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# автоматические обновления безопасности
sudo apt update && sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

SSH — только по ключу, пароль отключить в `/etc/ssh/sshd_config`:
`PasswordAuthentication no`, затем `sudo systemctl restart ssh`.

## 2. Код

```bash
sudo mkdir -p /srv/come-on-play
sudo git clone <адрес репозитория> /srv/come-on-play
cd /srv/come-on-play && sudo git checkout backend
sudo mkdir -p /srv/come-on-play/data /srv/come-on-play/server/data
sudo chown -R comeonplay:comeonplay /srv/come-on-play/data /srv/come-on-play/server/data
```

Node 22 или новее: `node -v` должен показать `v22.5+` (нужен встроенный `node:sqlite`).
Если в дистрибутиве Node старее — ставится через `nodesource` или `nvm` для системного пользователя.

## 3. Конфигурация

```bash
sudo cp server/deploy/come-on-play.env.example /etc/come-on-play.env
sudo nano /etc/come-on-play.env     # PUBLIC_URL, ADMIN_EMAILS, SMTP
sudo chmod 600 /etc/come-on-play.env
```

▢ `PUBLIC_URL` — адрес, по которому откроется приложение.
▢ `SMTP_*` — данные почтового сервера. Проверьте отправку до переключения.

## 4. Обратный прокси (Caddy)

Caddy сам получает и обновляет HTTPS-сертификаты.

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
example.ru {
    encode gzip zstd
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo systemctl restart caddy
```

Приложение и API живут на одном домене — поэтому клиенту не нужен CORS,
а cookie сессии работают без `SameSite=None`.

## 5. Служба

```bash
sudo cp server/deploy/come-on-play.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now come-on-play
curl -s http://127.0.0.1:8080/api/health
# {"ok":true,"users":0,...}
```

Проверка снаружи: `curl -s https://example.ru/api/health`.

## 6. Бэкапы

Два независимых уровня — не один:

1. **Снапшот сервера у провайдера** — раз в сутки, хранение хотя бы 7 дней.
   Настраивается в панели провайдера, не здесь.
2. **Своя копия базы** — раз в сутки в 03:30, файл уезжает вне сервера.

`/usr/local/bin/come-on-play-backup.sh`:

```bash
#!/bin/sh
set -eu
DEST=/var/backups/come-on-play
mkdir -p "$DEST"
STAMP=$(date +%Y-%m-%d)
DB=/srv/come-on-play/data/come-on-play.db
# sqlite3 умеет снимать копию живой базы без остановки сервиса
sqlite3 "$DB" ".backup '$DEST/cop-$STAMP.db'"
gzip -f "$DEST/cop-$STAMP.db"
find "$DEST" -name 'cop-*.db.gz' -mtime +30 -delete
# ▢ перенос копии на другой хост: rsync/scp на вторую машину или в своё хранилище
```

Если `sqlite3` не установлен — `sudo apt install -y sqlite3`.

Cron:

```
30 3 * * * root /usr/local/bin/come-on-play-backup.sh >> /var/log/come-on-play-backup.log 2>&1
```

**Проверка бэкапа — часть бэкапа.** Раз в месяц:
```bash
gunzip -c /var/backups/come-on-play/cop-<дата>.db.gz > /tmp/check.db
sqlite3 /tmp/check.db "select count(*) from users;"
```
Не выполнили проверку — бэкапа нет.

## 7. Мониторинг, без которого не узнать об отказе

```bash
sudo crontab -e
*/5 * * * * curl -fsS https://example.ru/api/health >/dev/null || echo "backend down" | mail -s "come-on-play" ваш@адрес
```

▢ Заменить `mail` на тот канал, который вы реально читаете
(почта, Telegram-бот). Проверить, что сообщение доходит, — иначе проверки нет.

## 8. Перенос данных

Сначала — копия из Firebase (консоль → Firestore → экспорт). Это страховка,
не зависящая ни от одного сервиса.

```bash
cd /srv/come-on-play/server
sudo -u comeonplay node src/migrate.js --dry-run     # отчёт
sudo -u comeonplay node src/migrate.js               # запись
sudo -u comeonplay node src/verify.js                # сверка
```

Ожидаемый результат сверки: `Расхождений нет.` Если что-то разошлось —
повторить перенос, но не «на живой базе»: сначала разобраться, какие записи
и почему не совпали.

Затем: `backend-config.js` → `mode: 'dual'`, неделя наблюдения, сверка
`/api/admin/stats/general` с Firebase. Потом `mode: 'server'`.

## 9. Порог: когда зову человека

- **Решаю сам:** перезапуск службы, чтение лога, повторный перенос.
- **Стоп и разбор:** сверка дала расхождения дважды подряд.
- **Откат:** после `mode: 'server'` появились ошибки в админке —
  вернуть `mode: 'firebase'` до выяснения, данные в Firebase не тронуты.

## 10. Логи

```bash
sudo journalctl -u come-on-play -n 200 --no-pager
sudo journalctl -u caddy -n 100 --no-pager
```

Ошибки API пишутся с `[api]` и содержат метод и путь — по ним видно,
что именно ломалось в момент ошибки.
