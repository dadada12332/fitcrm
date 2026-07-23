# FitCRM Bridge — быстрый старт

## Windows

1. Установите Node.js 20 LTS.
2. В FitCRM откройте «Интеграции», выберите производителя, создайте Bridge-ключ и скачайте
   персональный `config.json`.
3. Положите `config.json` рядом с этой инструкцией.
4. Откройте PowerShell от имени администратора.
5. Выполните:

```powershell
.\deploy\install-windows.ps1 -ConfigPath .\config.json
```

Установщик безопасно запросит логин и пароль, если в конфигурации оставлены placeholders,
зарегистрирует автозапуск и закроет конфигурационный файл правами NTFS.

## Linux

```bash
cp ./deploy/bridge.env.example ./bridge.env
# заполните bridge.env
node --env-file=./bridge.env ./bin/fitcrm-bridge.mjs doctor ./config.json
sudo ./deploy/install-linux.sh ./config.json ./bridge.env
```

Установщик сохранит `bridge.env` с владельцем `root:fitcrm-bridge` и правами `0640`.

## Проверка

Откройте `http://127.0.0.1:8787/health`. Затем выполните чек-лист
`docs/commissioning.md`.
