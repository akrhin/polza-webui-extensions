# Polza WebUI Extensions — Виджет баланса Polza.ai

[**English**](README.en.md) · **Русский**

Плавающий виджет для [Hermes WebUI](https://github.com/nesquena/hermes-webui), показывающий баланс счёта Polza.ai. Нажмите на баланс — увидите дневные расходы с разбивкой по моделям и токенам.

## Возможности

| | |
|---|---|
| 💰 | Текущий баланс — автообновление (настраивается, по умолчанию 60 с) |
| 📊 | Клик → ежедневная статистика: расход, количест��о генераций, токены (вход/выход) |
| 🏆 | Топ-5 моделей по стоимости за сегодня |
| 🔄 | Пагинированная история — суммируются все генерации за день |
| 🔑 | Смена API-ключа через правый клик / долгое нажатие на балансе |
| 🌗 | Автоопределение тёмной / светлой темы WebUI |

## Структура репозитория

```
├── README.md            ← этот файл (русский)
├── README.en.md         ← английская версия
├── extensions/
│   └── polza-balance/
│       ├── manifest.json      ← манифест расширения WebUI
│       ├── polza-balance.js   ← виджет: логика, вёрстка, тема (один файл)
│       └── polza-balance.css  ← стили
```

Один JS-файл — без внешнего CSS, npm или сборки. Стили встроены в JS, чтобы не делать лишний HTTP-запрос.

## Установка

### Через галерею (рекомендуется)

Откройте **Settings → Extensions** в Hermes WebUI, найдите **Polza.ai Balance**, нажмите **Install**. Обновите страницу (Ctrl+Shift+R).

### Вручную

Добавьте в `.env` WebUI:

```bash
HERMES_WEBUI_CSP_CONNECT_EXTRA=https://polza.ai
HERMES_WEBUI_EXTENSION_SCRIPT_URLS=/extensions/polza-balance/polza-balance.js
HERMES_WEBUI_EXTENSION_STYLESHEET_URLS=/extensions/polza-balance/polza-balance.css
```

Скопируйте папку `extensions/polza-balance/` в директорию расширений вашего WebUI:

```bash
cp -r extensions/polza-balance/ ~/.hermes/webui/extensions/polza-balance/
```

Перезапустите WebUI и ��делайте жёсткую перезагрузку браузера (Ctrl+Shift+R).

## Использование

| Действие | Результат |
|----------|-----------|
| **Клик** по балансу | Открыть/закрыть попап с расходами |
| **Правый клик / долгое нажатие** | Сменить API-ключ и интервал обновления |
| **🔑 Polza** (при первом запуске) | Ввести API-ключ |

API-ключ хранится в `localStorage` браузера — сохраняется между сессиями.

### Пример попапа

```
Today — 63.75 ₽
383 gen · 8.2K in / 4.3K out
────────────────────────────
DeepSeek V4 Flash   63.75 ₽
                    8.2K/4.3K
```

## Архитектура

```
Browser                    Hermes WebUI /extensions/     Polza.ai API
  │                              │                         │
  │  загрузка страницы с         │                         │
  │  <script src="/extensions/   │                         │
  │  polza-balance.js">          │                         │
  │ ────────────────────────────→│                         │
  │ ← JS-файл + cookie ─────────│                         │
  │                              │                         │
  │  fetch('https://polza.ai/    │                         │
  │  api/v1/balance')            │                         │
  │ ──────────────────────────────────────────────────────→│
  │ ← JSON ───────────────────────────────────────────────│
  │                              │                         │
  │  отрисовка плавающего       │                         │
  │  виджета                    │                         │
```

JS-расширения общаются напрямую с Polza.ai API — WebUI только отдаёт файл и добавляет исключение в CSP.

**CSP:** `HERMES_WEBUI_CSP_CONNECT_EXTRA=https://polza.ai` разрешает браузеру делать `fetch()` к Polza API. Без него браузер заблокирует запрос.

## Добавление в галерею WebUI

В Hermes WebUI есть галерея расширений: **Settings → Extensions**. Реестр читается с `https://hermes-webui.github.io/hermes-webui-extensions/registry.json`, публикуется из [`github.com/hermes-webui/hermes-webui-extensions`](https://github.com/hermes-webui/hermes-webui-extensions).

Чтобы добавить расширение:

1. **Форкните** `hermes-webui/hermes-webui-extensions`
2. **Создайте директорию** расширения:

```
extensions/polza-balance/
├── manifest.json          ← метаданные расширения (скрипты, ст��ли, права)
├── polza-balance.js       ← код виджета
├── polza-balance.css      ← стили
├── preview.png            ← скриншот 800×600
└── README.md              ← документация
```

3. **Обновите `extensions.toml`** (или конфиг реестра) для регистрации расширения
4. **Откройте PR** — GitHub Action сгенерирует `registry.json` и опубликует его автоматически после слияния

`manifest.json` для этого расширения:

```json
{
  "id": "polza-balance",
  "name": "Polza.ai Balance",
  "version": "1.0.0",
  "author": "akrhin",
  "description": "Floating widget showing Polza.ai account balance and daily spending breakdown by model with input/output token counts.",
  "scripts": ["polza-balance.js"],
  "stylesheets": ["polza-balance.css"],
  "csp_connect_extra": "https://polza.ai"
}
```

Поле `csp_connect_extra` указывает галерее, что для установки расширения нужно добавить `https://polza.ai` в `HERMES_WEBUI_CSP_CONNECT_EXTRA` — WebUI запросит подтверждение у пользователя.

## Адаптация под другого провайдера

Это расширение — **готовый шаблон** для любого провайдера с REST API для проверки баланса.

### Что изменить

1. Форкните репозиторий или скопируйте `polza-balance.js`
2. Замените URL API и названия полей ответа
3. Поменяйте `HERMES_WEBUI_CSP_CONNECT_EXTRA` на домен вашего провайдера
4. Разверните и перезапустите

### Переменные шаблона

| Переменная | Где в `polza-balance.js` | Что менять |
|------------|--------------------------|------------|
| `BALANCE_URL` | строка ~11 | Эндпоинт баланса провайдера |
| `HISTORY_URL` | строка ~12 | Эндпоинт истории провайдера |
| Поле ответа | `fetchBalance()` | `d.amount` → поле баланса у вашего провайдера |
| Поле стоимости | `fetchTodayCost()` | `item.cost` → поле стоимости у вашего провайдера |
| Поля токенов | `fetchTodayCost()` | `item.usage.prompt_tokens` → поля токенов у вашего провайдера |
| CSP origin | `.env` | `https://polza.ai` → домен API вашего провайдера |

### Структуры ответов популярных провайдеров

<details>
<summary>DeepSeek</summary>

```javascript
// GET https://api.deepseek.com/user/balance
// { "balance": "9.28", "is_available": true }
balance = parseFloat(d.balance);

// CSP: https://api.deepseek.com
```

</details>

<details>
<summary>OpenAI</summary>

```javascript
// GET https://api.openai.com/v1/dashboard/billing/credit_grants
// { "total_remaining": 12.58, ... }
balance = d.total_remaining;

// CSP: https://api.openai.com
```

</details>

<details>
<summary>Anthropic</summary>

```javascript
// GET https://api.anthropic.com/v1/organizations/{org_id}/billing
// { "credits_remaining": 25.00 }
balance = d.credits_remaining;

// CSP: https://api.anthropic.com
```

</details>

### Чеклист

- [ ] URL баланса обновлён
- [ ] URL истории обновлён (или удалён, если недоступен)
- [ ] Названи�� полей ответа обновлены
- [ ] CSP origin добавлен в `.env`
- [ ] ID расширения изменён (чтобы избежать конфликтов)
- [ ] WebUI перезапущен, браузер жёстко перезагружен

## Часто задаваемые вопросы

**В:** Почему `localStorage` для API-ключа?
**О:** Ключ никогда не покидает браузер. Никакого хранения на сервере, никаких cookie, которые утекают в WebUI. Просто и достаточно безопасно для self-hosted.

**В:** Почему в попапе 0 генераций?
**О:** API-ключ в браузере не совпадает с тем, который используется для генерации. Нажмите правой кнопкой на баланс и введите правильный ключ.

**В:** Как изменить интервал обновления?
**О:** Правый клик по балансу → второй запрос спрашивает секунды (по умолчанию 60, максимум 3600).

**В:** Как удалить расширение?
**О:** Удалите через галерею (Settings → Extensions) или удалите файлы из `HERMES_WEBUI_EXTENSION_DIR` и уберите CSP-переменную из `.env`. Перезапустите WebUI.

---

## License

MIT. Репозиторий: [github.com/akrhin/polza-webui-extensions](https://github.com/akrhin/polza-webui-extensions)
