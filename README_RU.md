# Polza WebUI Extensions

[![Русская версия](docs/assets/ru-flag.svg)](README_RU.md)

> Расширения для [Hermes WebUI](https://github.com/nesquena/hermes-webui) —
> виджет баланса Polza.ai, статистика использования и другое.

---

## Расширения

| Расширение | Описание | Статус |
|-----------|----------|--------|
| **polza-balance** | Виджет баланса Polza.ai | ✅ Готово |
| *(в планах)* | | 🚧 |

### polza-balance

Показывает текущий баланс Polza.ai прямо в боковой панели Hermes WebUI.

**Возможности:**
- Отображение баланса в реальном времени (RUB)
- Управление API-ключом (хранится локально в браузере)
- Ссылка на страницу пополнения в один клик
- Автообновление при загрузке страницы
- Безопасность: ключ не покидает ваш браузер

**Установка:**

1. Скопируйте `extensions/polza-balance/` в директорию расширений WebUI:

```bash
# Вариант А — симлинк (рекомендуется, автообновление при git pull)
mkdir -p ~/.hermes/webui/extensions
ln -sf "$(pwd)/extensions/polza-balance" ~/.hermes/webui/extensions/polza-balance

# Вариант Б — копирование
cp -r extensions/polza-balance ~/.hermes/webui/extensions/
```

2. Настройте переменные окружения для WebUI (если используете кастомную директорию):

```bash
# Добавьте в .env WebUI:
export HERMES_WEBUI_EXTENSION_DIR="$HOME/.hermes/webui/extensions"
export HERMES_WEBUI_EXTENSION_MANIFEST="$HOME/.hermes/webui/extensions/manifest.json"
```

3. Перезапустите WebUI:

```bash
cd ~/git/hermes-webui && ./ctl.sh restart
```

4. Перейдите в **Настройки → Расширения** в WebUI, найдите **polza-balance** и включите.

5. Введите ваш Polza.ai API-ключ в виджете. Ключ хранится в localStorage браузера и никуда не отправляется, кроме прямого запроса к `polza.ai/api/v1/balance`.

---

## Разработка

### Структура

```
extensions/polza-balance/
├── manifest.json        # Манифест расширения
├── polza-balance.js     # Основной JavaScript
└── polza-balance.css    # Стили

docs/
├── DEVELOPMENT.md       # План и гайд по разработке
├── assets/
│   ├── en-flag.svg
│   └── ru-flag.svg
```

См. [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) для плана разработки.
