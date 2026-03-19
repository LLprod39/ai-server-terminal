# Linux UI Workspace Plan

## Progress

Last updated: 2026-03-19

### Sprint 1 Status

- [x] Added `UI` button near `Files` and `AI` on terminal page.
- [x] Added new frontend shell component: `LinuxUiPanel`.
- [x] Switched `UI` mode from narrow side panel to a desktop-style full workspace canvas.
- [x] Added desktop-shell metaphors:
  - desktop launcher icons
  - workspace windows
  - bottom taskbar
  - terminal/AI bridge actions
- [x] Upgraded the shell to a real window manager feel:
  - drag windows by title bar
  - keep window z-order and focus state
  - minimize/restore windows from the taskbar
  - desktop / icon / taskbar / window right-click context menus
  - rearrange and close-all actions from the desktop menu
- [x] Polished desktop-shell ergonomics:
  - added maximize/restore and corner-resize for workspace windows
  - simplified header actions down to `Exit Workspace`
  - replaced tall translucent app tiles with a denser launcher rail
  - reduced transparency on launcher, taskbar, and window chrome for better readability
- [x] Embedded the real SFTP file manager as a primary workspace window so folder/file operations already work inside the GUI shell.
- [x] Added backend Linux UI service module: `servers/linux_ui.py`.
- [x] Added backend endpoints:
  - `GET /servers/api/<server_id>/ui/capabilities/`
  - `GET /servers/api/<server_id>/ui/overview/`
- [x] Added backend endpoints for Services:
  - `GET /servers/api/<server_id>/ui/services/`
  - `GET /servers/api/<server_id>/ui/services/logs/`
  - `POST /servers/api/<server_id>/ui/services/action/`
- [x] Added frontend API bindings and demo fallbacks for capabilities/overview.
- [x] Added frontend API bindings and demo fallbacks for Services.
- [x] Wired terminal side panel mode `"ui"` with open/close logic and SSH-only visibility.
- [x] Implemented initial Linux Workspace overview screen:
  - host summary
  - capabilities badges
  - workspace app launcher cards
- [x] Implemented real `Services` workspace window:
  - searchable service list
  - active/failed/inactive counters
  - selected service details
  - `start` / `stop` / `restart` / `reload` actions with confirm dialog
  - recent `journalctl` / `systemctl status` output
- [x] Implemented text file read/write inside `Files`:
  - backend `read` / `write` endpoints for UTF-8 text files over SFTP
  - inline text editor inside the `Files` window
  - open / reload / save / close actions
  - unsaved-change guard before destructive navigation
- [x] Implemented real `Processes` workspace window:
  - top CPU and top memory process lists
  - process search/filter
  - `terminate` / `kill_force` actions with confirm dialog
  - live process metadata from SSH-backed API
- [x] Implemented real `Logs` workspace window:
  - system journal and file-log presets
  - service-specific journal view
  - configurable line count and refresh
  - SSH-backed log source availability detection
- [x] Implemented real `Network` workspace window:
  - interfaces with addresses, flags, MTU, and link metadata
  - route table view
  - listening socket view from `ss`/fallback parsing
  - SSH-backed network summary and capability-aware fallbacks
- [x] Implemented real `Disk` workspace window:
  - filesystem / mount usage view
  - common-root large directory scan
  - large log file surfacing
  - old `/tmp` cleanup candidates
  - SSH-backed disk pressure summary
- [x] Implemented real `Packages` workspace window:
  - package-manager detection for `apt` / `dnf` / `yum`
  - common installed package version list
  - update preview slice
  - read-only package visibility without shell commands
- [x] Implemented real `Docker` workspace window:
  - container list with state and runtime metadata
  - recent container logs
  - typed `start` / `stop` / `restart` actions with confirm dialog
  - SSH-backed Docker health and summary detection

### Notes For Next Iteration

- `Linux Workspace` is now a desktop shell, not just a panel.
- The shell now behaves more like a real GUI: draggable windows, taskbar restore/minimize flow, and context menus across the workspace.
- The shell now behaves more like a normal desktop: windows can be resized/maximized, the launcher is denser and easier to scan, and the chrome is more opaque so controls stay readable.
- `Files` now includes an inline text editor, so config read/edit/save already works inside the workspace.
- `Overview` is already a real window with live host data.
- `Services` is now a real systemd control window with safe actions and live service output.
- `Processes` and `Logs` are now live and complete the core incident-debugging workflow with `Overview`, `Files`, and `Services`.
- `Disk` is now live, so the workspace can surface capacity pressure and cleanup hints without shell commands.
- `Network` is now live as well, so the desktop covers interfaces, routes, and listening ports without shell commands.
- `Packages` is now live as a read-only inspector for installed versions and update previews.
- `Docker` is now live with container state, logs, and typed restart/start/stop actions.
- Core MVP is effectively closed: a user can inspect the host, browse/edit files, restart services, inspect processes, and read logs without relying on the shell.
- Most core workspace modules are now live. Next work should focus on AI integration, additional guided actions, and a dedicated full-page workspace route if the terminal page starts feeling cramped.

## 1. Цель

Сделать в терминале новую кнопку `UI` рядом с `Files` и `AI`, которая открывает не просто ещё одну панель, а полноценный web-based интерфейс для управления Linux-сервером "как Windows-машиной", но:

- без установки GUI-окружения на сервере;
- без GNOME/XFCE/KDE/VNC/RDP на сервере;
- без обязательного агентского демона на сервере;
- с работой через существующие SSH/SFTP механизмы проекта.

Идея: не стримить реальный удалённый desktop, а построить свой "Linux Workspace" в вебе поверх SSH/SFTP и безопасных серверных API.

## 2. Что именно мы строим

### Концепция

Пользователь нажимает `UI` и попадает в режим `Linux Workspace`.

Внешне это ощущается как рабочее пространство:

- боковое меню или desktop launcher;
- окна или вкладки приложений;
- действия через кнопки, таблицы, формы, переключатели;
- терминал остаётся как fallback, а не как основной способ работы.

### Важный принцип

Это не "настоящий Linux desktop в браузере".

Это продуктовый web-UI, который:

- отображает состояние Linux;
- запускает действия по SSH;
- читает файлы через SFTP;
- показывает логи, сервисы, процессы, сеть, диски, Docker и т.д.;
- даёт Windows-подобный UX поверх Linux-сервера.

## 3. Почему не стоит делать реальный GUI Linux

Реальный desktop Linux в браузере потребует хотя бы одного из вариантов:

- X11/Wayland + desktop session;
- VNC/noVNC;
- xrdp;
- xpra;
- webtop-контейнер;
- отдельный агент или графический сервис.

Это противоречит базовому требованию:

- без GUI на сервере;
- без установки окружения;
- только через SSH.

Поэтому базовый путь проекта:

`SSH/SFTP + web applications + action APIs + safe commands`

Если потом понадобится, можно сделать отдельный optional режим `Real Desktop`, но это уже другая фича и другой класс инфраструктуры.

## 4. Ценность для пользователя

Пользователь должен уметь выполнять типовые Linux-задачи без ручного ввода команд:

- смотреть и редактировать файлы;
- управлять сервисами;
- смотреть процессы;
- просматривать логи;
- видеть загрузку CPU/RAM/Disk;
- выполнять распространённые операции кнопками;
- получать AI-подсказки по проблемам;
- использовать терминал только когда GUI-сценария не хватает.

## 5. Что уже есть в проекте

У нас уже есть хороший фундамент:

- Терминальная страница и кнопки `Files` / `AI`:
  - `ai-server-terminal-main/src/pages/TerminalPage.tsx`
- Интерактивный SSH terminal по WebSocket:
  - `ai-server-terminal-main/src/components/terminal/XTerminal.tsx`
  - `servers/consumers.py`
- Готовый SFTP side panel:
  - `ai-server-terminal-main/src/components/terminal/SftpPanel.tsx`
  - `servers/sftp.py`
  - `servers/views.py`
  - `servers/urls.py`
- Выполнение отдельных SSH-команд:
  - `servers/views.py`
  - `app/tools/ssh_tools.py`
- Safety checks для опасных команд:
  - `app/tools/safety.py`
- Monitoring и health checks:
  - `servers/monitor.py`
  - `servers/views.py`
- Наборы полезных диагностических команд и service-oriented сценариев:
  - `servers/agents.py`

Вывод: мы не стартуем с нуля. Мы расширяем уже существующий terminal stack до `Linux Workspace`.

## 6. Целевой UX

### Entry point

В терминале рядом с `Files` и `AI` появляется кнопка:

- `UI`

При нажатии открывается один из двух вариантов:

1. Fullscreen workspace поверх terminal page.
2. Отдельный route, например `/servers/:id/workspace`.

Рекомендуемый вариант для MVP:

- начать с side panel / wide panel внутри terminal page;
- после MVP перейти к отдельному full-page workspace, если станет тесно.

### Внутри Linux Workspace

Интерфейс строится как набор приложений/модулей:

1. `Overview`
2. `Files`
3. `Services`
4. `Processes`
5. `Logs`
6. `Disk`
7. `Network`
8. `Docker`
9. `Packages`
10. `Terminal`
11. `AI`

### Поведение

- UI адаптируется под capabilities сервера.
- Если нет `systemctl`, скрываем или деградируем `Services`.
- Если нет Docker, скрываем `Docker`.
- Если нет `journalctl`, даём file-based logs.
- Терминал остаётся доступным всегда.

## 7. Product scope по модулям

### 7.1 Overview

Показывает:

- hostname;
- IP / host;
- Linux distribution;
- kernel;
- uptime;
- load average;
- CPU estimate / CPU load;
- RAM usage;
- disk usage;
- process count;
- last health check;
- доступные возможности сервера.

### 7.2 Files

На базе существующего SFTP:

- file tree / list;
- upload / download;
- rename / delete;
- create folder;
- preview text files;
- edit text files;
- save back to server;
- basic permissions display;
- быстрый переход в часто используемые директории.

### 7.3 Services

Если сервер поддерживает `systemctl`:

- список running / failed / inactive services;
- поиск;
- просмотр статуса;
- restart / start / stop / reload;
- enable / disable;
- quick log view для выбранного сервиса.

Fallback без `systemctl`:

- read-only notice;
- возможно поддержка `service`/`rc-service` позже.

### 7.4 Processes

- top CPU;
- top RAM;
- поиск по имени/PID;
- user, pid, cpu, mem, command;
- kill / kill -9 с подтверждением;
- базовый live refresh.

### 7.5 Logs

- `journalctl` viewer;
- tail выбранного файла;
- быстрые пресеты:
  - syslog;
  - messages;
  - auth.log;
  - nginx access/error;
  - apache logs;
  - app logs;
- фильтрация;
- auto-refresh/live tail.

### 7.6 Disk

- usage по mount points;
- largest directories;
- large logs;
- old temp files;
- cleanup candidates;
- потом: guided cleanup actions.

### 7.7 Network

- IP addresses;
- interfaces;
- open/listening ports;
- active connections summary;
- routes;
- DNS info, если доступно.

### 7.8 Docker

Если Docker установлен:

- container list;
- status;
- restart / stop / start;
- logs;
- basic stats;
- docker disk usage.

### 7.9 Packages

Позже:

- apt/dnf/yum detect;
- installed package lookup;
- package version info;
- update availability;
- guided package actions.

### 7.10 Terminal

- существующий terminal как fallback;
- deep troubleshooting;
- advanced/manual ops.

### 7.11 AI

Контекстный AI:

- "объясни что не так";
- "почему сервис упал";
- "предложи исправление";
- "составь план";
- "покажи безопасную команду".

## 8. Архитектурный принцип

Новый `UI` режим не должен работать через парсинг текущего PTY-потока терминала.

Правильная схема:

- terminal shell живёт отдельно;
- Linux UI ходит в отдельные backend endpoints;
- backend сам выполняет конкретные SSH/SFTP операции;
- frontend получает нормализованный JSON.

Это нужно для:

- предсказуемости;
- меньшей хрупкости;
- независимости от текущего `cwd`;
- меньшей зависимости от состояния shell-сессии;
- лучшей безопасности;
- нормального тестирования.

## 9. Предлагаемая backend архитектура

### 9.1 Новый модуль

Добавить новый backend слой:

- `servers/linux_ui.py`

Ответственность:

- определение capabilities;
- вызов allowlisted Linux-команд;
- нормализация результатов;
- деградация для разных дистрибутивов.

Опционально потом:

- `servers/linux_ui_views.py`

### 9.2 Endpoints

Предлагаемый набор:

- `GET /servers/api/<server_id>/ui/capabilities/`
- `GET /servers/api/<server_id>/ui/overview/`
- `GET /servers/api/<server_id>/ui/services/`
- `POST /servers/api/<server_id>/ui/services/action/`
- `GET /servers/api/<server_id>/ui/processes/`
- `POST /servers/api/<server_id>/ui/processes/action/`
- `GET /servers/api/<server_id>/ui/logs/`
- `POST /servers/api/<server_id>/ui/logs/read/`
- `GET /servers/api/<server_id>/ui/disk/`
- `GET /servers/api/<server_id>/ui/network/`
- `GET /servers/api/<server_id>/ui/docker/`
- `POST /servers/api/<server_id>/ui/docker/action/`
- `GET /servers/api/<server_id>/ui/file/read/`
- `POST /servers/api/<server_id>/ui/file/write/`

Для MVP можно начать с:

- `capabilities`
- `overview`
- `services`
- `processes`
- `logs`
- `file/read`
- `file/write`

### 9.3 Execution model

Каждый endpoint:

1. проверяет доступ пользователя к серверу;
2. получает SSH secret существующим способом;
3. выполняет одну или несколько заранее определённых команд;
4. парсит результат;
5. возвращает нормализованный JSON;
6. логирует действие в audit/activity.

### 9.4 Safety model

В `UI` режиме нельзя давать frontend отправлять сырой произвольный shell для action-кнопок.

Нужно использовать:

- allowlist actions;
- подтверждение для risk actions;
- reuse `app/tools/safety.py`;
- audit trail для каждого действия.

Примеры action IDs:

- `service.restart`
- `service.start`
- `service.stop`
- `process.kill`
- `process.kill_force`
- `docker.container.restart`
- `file.save_text`

## 10. Предлагаемая frontend архитектура

### 10.1 Новый компонент

Добавить:

- `ai-server-terminal-main/src/components/terminal/LinuxUiPanel.tsx`

Позже разнести на:

- `LinuxWorkspace.tsx`
- `workspace/OverviewApp.tsx`
- `workspace/ServicesApp.tsx`
- `workspace/ProcessesApp.tsx`
- `workspace/LogsApp.tsx`
- `workspace/FilesApp.tsx`

### 10.2 Изменения в TerminalPage

В `TerminalPage.tsx`:

- добавить кнопку `UI`;
- расширить `sidePanelMode` до `"ui"`;
- подключить `LinuxUiPanel`;
- показывать `UI` только для SSH серверов;
- для RDP можно скрыть или позже открыть другой режим.

### 10.3 Workspace layout

Рекомендуемый layout:

- top bar с server name, host, status, refresh;
- left nav с приложениями;
- main content area;
- optional right context panel;
- action bar;
- toast / confirmations.

### 10.4 State strategy

Использовать существующий frontend stack:

- React;
- TanStack Query;
- existing UI primitives.

Хранить:

- active app;
- capabilities;
- refresh intervals;
- selected service/process/file/log source;
- optimistic action states.

## 11. MVP

### MVP goal

Дать пользователю чувство "я уже могу работать с Linux без команд" на типовых задачах.

### MVP scope

1. Кнопка `UI` в terminal page.
2. Workspace shell.
3. `Overview`.
4. `Files` с read/write текстовых файлов.
5. `Services`.
6. `Processes`.
7. `Logs`.
8. Базовая safety + confirm dialogs.
9. Activity/audit logging.

### Что не входит в MVP

- реальный graphical desktop;
- drag-and-drop windows manager;
- package management UI;
- deep Docker UI;
- multi-server workspace;
- sudo password orchestration;
- advanced ACL/permissions editor;
- clipboard sync remote desktop.

## 12. Этапы реализации

### Этап 1. UX skeleton

- добавить кнопку `UI`;
- добавить режим панели `"ui"`;
- пустой `LinuxUiPanel`;
- server capability gate только для SSH.

Результат:

- можно открыть новый режим без backend логики.

### Этап 2. Capabilities + Overview

- определить наличие:
  - `systemctl`
  - `journalctl`
  - `docker`
  - `ss`
  - `ip`
  - `apt`
  - `dnf`
  - `yum`
- вывести summary сервера.

Результат:

- workspace понимает, что умеет сервер.

### Этап 3. Files++

- reuse текущий SFTP;
- добавить read/write text file API;
- preview/edit/save текстовых конфигов;
- open in terminal action.

Результат:

- базовая админка файлов без shell.

### Этап 4. Services

- list services;
- failed services;
- service details;
- restart/start/stop/reload;
- view service logs.

Результат:

- типовой ops workflow по сервисам работает без команд.

### Этап 5. Processes

- top CPU / MEM;
- filter;
- process details;
- safe kill actions.

Результат:

- диагностика и быстрые действия по процессам.

### Этап 6. Logs

- journal viewer;
- file tail viewer;
- refresh/live tail;
- filters.

Результат:

- пользователь может расследовать инциденты без shell.

### Этап 7. Disk / Network / Docker

- disk usage;
- network info;
- docker status.

Результат:

- workspace становится реально полезным ежедневным инструментом.

### Этап 8. AI integration

- action-aware AI;
- explain current issue;
- propose safe fix;
- generate command with approval.

Результат:

- AI становится частью GUI, а не отдельной панелью.

## 13. Технические решения, которые нужно принять заранее

### Решение A. Side panel vs full page

Рекомендация:

- начать с panel mode для быстрой интеграции;
- после стабилизации вынести в full-page workspace route.

### Решение B. Polling vs WebSocket

Рекомендация:

- MVP делать на polling;
- live logs и live process updates позже перевести на WebSocket.

### Решение C. Single command vs multi-command batching

Рекомендация:

- overview и diagnostics можно батчить;
- actions делать строго одиночными и typed.

### Решение D. Read-only first vs full actions

Рекомендация:

- сначала read-heavy UI;
- потом write/actions с confirm flow.

## 14. Риски

### 14.1 Разные Linux environments

Реальные серверы бывают:

- systemd-based;
- container/minimal images;
- Alpine/BusyBox;
- Ubuntu/Debian/CentOS/RHEL;
- с урезанными командами.

Нужна деградация по capabilities.

### 14.2 sudo / privilege escalation

Некоторые действия потребуют root.

Пока в MVP:

- показываем ошибки как есть;
- не автоматизируем sudo credential flow;
- при необходимости later вводим explicit privileged action mode.

### 14.3 Performance

Если каждый запрос открывает новый SSH connection:

- может быть заметная задержка.

На MVP это допустимо.
Позже можно добавить pooling/session reuse.

### 14.4 Parsing fragility

CLI output у Linux-команд не всегда стабилен.

Поэтому:

- выбирать максимально предсказуемые команды;
- использовать machine-readable flags там, где возможно;
- нормализовать parser-слой в одном месте.

### 14.5 Dangerous actions

GUI-кнопки могут создавать ложное ощущение безопасности.

Поэтому обязательны:

- confirm dialogs;
- audit trail;
- danger zones;
- role-based restrictions;
- safety filters.

## 15. Security requirements

- Все действия только для доступных пользователю серверов.
- Все action endpoints логируются.
- destructive actions требуют confirm step.
- allowlist вместо raw shell из frontend.
- reuse текущих safety checks.
- file editing ограничивать размером.
- log/file reads ограничивать объёмом ответа.

## 16. Acceptance criteria для MVP

MVP считается готовым, если:

1. На SSH terminal page есть кнопка `UI`.
2. При нажатии открывается Linux Workspace.
3. Workspace показывает overview сервера.
4. Пользователь может просматривать файлы и редактировать текстовый конфиг.
5. Пользователь может увидеть failed/running services.
6. Пользователь может перезапустить сервис из UI.
7. Пользователь может увидеть top processes.
8. Пользователь может завершить процесс с подтверждением.
9. Пользователь может читать system/file logs.
10. Все действия проходят через backend API и логируются.
11. Терминал остаётся рабочим как fallback.

## 17. Рекомендуемый порядок работы в коде

### Backend first

1. `capabilities`
2. `overview`
3. `file read/write`
4. `services`
5. `processes`
6. `logs`

### Frontend after each backend slice

После каждого backend блока сразу собирать UI:

- не ждать завершения всей серверной части;
- двигаться вертикальными slices.

## 18. Первый рабочий спринт

### Sprint 1

Сделать:

- кнопку `UI` в терминале;
- `LinuxUiPanel` каркас;
- `capabilities` endpoint;
- `overview` endpoint;
- frontend overview app;
- базовые loading/error states.

Definition of done:

- пользователь может открыть `UI` и увидеть рабочий overview по реальному SSH серверу.

## 19. Sprint 2

Сделать:

- text file read/write;
- `Files` integration;
- `Services` list;
- service actions;
- confirm modal.

Definition of done:

- можно открыть конфиг, поправить текст, сохранить и перезапустить сервис.

## 20. Sprint 3

Сделать:

- processes;
- logs;
- disk;
- better refresh and empty states.

Definition of done:

- можно расследовать проблему и исправить типовой инцидент, почти не используя shell.

## 21. Что будем делать прямо дальше

Рабочий порядок по этому плану:

1. Реализуем `Sprint 1`.
2. Потом закрываем `Sprint 2`.
3. Потом `Sprint 3`.
4. После этого решаем, нужен ли отдельный full-page workspace route.

## 22. Текущая рекомендация

Не пытаться строить "настоящий Linux desktop".

Строить `Linux Workspace` как:

- продуктовый web-слой;
- поверх SSH/SFTP;
- с capability detection;
- с безопасными actions;
- с fallback в terminal.

Это даст лучший UX, меньше инфраструктурных проблем и полностью соответствует исходной идее: управлять Linux как Windows-машиной, но без GUI-окружения на сервере.
