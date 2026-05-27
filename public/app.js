const API = '/api';

const state = {
  todayDate: toISODate(new Date()),
  selectedDate: toISODate(new Date()),
  currentMonth: toISODate(new Date()).slice(0, 7),
  selectedWeekStart: getWeekStart(toISODate(new Date())),
  activeView: 'overview',
  dashboard: null,
  day: null,
  stats: null,
  health: null,
};

const charts = {
  monthDonut: null,
  tasksBar: null,
  mindsetLine: null,
  habitBar: null,
  weekBar: null,
};

let activeModalCallback = null;
let lockinInitialSeconds = 25 * 60;
let lockinRemainingSeconds = lockinInitialSeconds;
let lockinInterval = null;
let lockinRunning = false;

const elements = {
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  mobileTodayBtn: document.getElementById('mobileTodayBtn'),
  mobileTemporalBadge: document.getElementById('mobileTemporalBadge'),

  navItems: Array.from(document.querySelectorAll('.nav-item')),
  bottomNavItems: Array.from(document.querySelectorAll('.bottom-nav-item')),
  views: {
    overview: document.getElementById('view-overview'),
    tracker: document.getElementById('view-tracker'),
    journal: document.getElementById('view-journal'),
    backup: document.getElementById('view-backup'),
  },

  mainTitle: document.getElementById('mainTitle'),
  todayLabel: document.getElementById('todayLabel'),
  selectedLabel: document.getElementById('selectedLabel'),
  dateModeBadge: document.getElementById('dateModeBadge'),
  trackerTodayLabel: document.getElementById('trackerTodayLabel'),
  trackerSelectedLabel: document.getElementById('trackerSelectedLabel'),
  trackerDateModeBadge: document.getElementById('trackerDateModeBadge'),

  goTodayBtn: document.getElementById('goTodayBtn'),
  openTrackerBtn: document.getElementById('openTrackerBtn'),
  overviewOpenTrackerBtn: document.getElementById('overviewOpenTrackerBtn'),
  quickAddTaskBtn: document.getElementById('quickAddTaskBtn'),

  overviewTitle: document.getElementById('overviewTitle'),
  overviewProgressChip: document.getElementById('overviewProgressChip'),
  overviewHabitStat: document.getElementById('overviewHabitStat'),
  overviewTaskStat: document.getElementById('overviewTaskStat'),
  overviewTotalStat: document.getElementById('overviewTotalStat'),
  overviewProgressFill: document.getElementById('overviewProgressFill'),
  overviewTaskList: document.getElementById('overviewTaskList'),
  overviewAddTaskBtn: document.getElementById('overviewAddTaskBtn'),
  overviewMindsetMini: document.getElementById('overviewMindsetMini'),
  overviewNotePreview: document.getElementById('overviewNotePreview'),
  overviewEditCheckinBtn: document.getElementById('overviewEditCheckinBtn'),
  overviewCopyMarkdownBtn: document.getElementById('overviewCopyMarkdownBtn'),
  overviewDownloadMarkdownBtn: document.getElementById(
    'overviewDownloadMarkdownBtn'
  ),

  monthTitle: document.getElementById('monthTitle'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  monthTodayBtn: document.getElementById('monthTodayBtn'),
  monthPicker: document.getElementById('monthPicker'),
  addHabitBtn: document.getElementById('addHabitBtn'),
  addHabitFromDateBtn: document.getElementById('addHabitFromDateBtn'),
  habitMatrix: document.getElementById('habitMatrix'),
  habitProgressList: document.getElementById('habitProgressList'),

  weekTitle: document.getElementById('weekTitle'),
  prevWeekBtn: document.getElementById('prevWeekBtn'),
  nextWeekBtn: document.getElementById('nextWeekBtn'),
  weekDayTabs: document.getElementById('weekDayTabs'),
  weekCards: document.getElementById('weekCards'),

  trackerCheckinTitle: document.getElementById('trackerCheckinTitle'),
  trackerMindsetGrid: document.getElementById('trackerMindsetGrid'),
  trackerNotes: document.getElementById('trackerNotes'),
  trackerSaveMindsetBtn: document.getElementById('trackerSaveMindsetBtn'),
  trackerCopyMarkdownBtn: document.getElementById('trackerCopyMarkdownBtn'),
  trackerDownloadMarkdownBtn: document.getElementById(
    'trackerDownloadMarkdownBtn'
  ),

  journalMonthFilter: document.getElementById('journalMonthFilter'),
  journalSearch: document.getElementById('journalSearch'),
  journalList: document.getElementById('journalList'),
  journalDetail: document.getElementById('journalDetail'),

  backupBtn: document.getElementById('backupBtn'),
  sidebarBackupBtn: document.getElementById('sidebarBackupBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  authState: document.getElementById('authState'),
  restoreDbBtn: document.getElementById('restoreDbBtn'),
  restoreDbInput: document.getElementById('restoreDbInput'),
  healthBox: document.getElementById('healthBox'),

  lockinTime: document.getElementById('lockinTime'),
  lockinStartBtn: document.getElementById('lockinStartBtn'),
  lockinPauseBtn: document.getElementById('lockinPauseBtn'),
  lockinResetBtn: document.getElementById('lockinResetBtn'),
  lockinPresetButtons: Array.from(document.querySelectorAll('.lockin-preset')),
  lockinCustomWrap: document.getElementById('lockinCustomWrap'),
  lockinCustomInput: document.getElementById('lockinCustomInput'),

  monthDonutChart: document.getElementById('monthDonutChart'),
  tasksBarChart: document.getElementById('tasksBarChart'),
  mindsetLineChart: document.getElementById('mindsetLineChart'),
  habitBarChart: document.getElementById('habitBarChart'),
  weekBarChart: document.getElementById('weekBarChart'),

  modalOverlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  modalBody: document.getElementById('modalBody'),
  modalCancelBtn: document.getElementById('modalCancelBtn'),
  modalConfirmBtn: document.getElementById('modalConfirmBtn'),

  toast: document.getElementById('toast'),
};

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Erro HTTP ${response.status}`);
  }

  return payload;
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(dateISO) {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateISO, amount) {
  const date = parseISODate(dateISO);
  date.setDate(date.getDate() + amount);
  return toISODate(date);
}

function getWeekdayIndex(dateISO) {
  const day = parseISODate(dateISO).getDay();
  return day === 0 ? 6 : day - 1;
}

function getWeekStart(dateISO) {
  return addDays(dateISO, -getWeekdayIndex(dateISO));
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatShortDate(dateISO) {
  const [year, month, day] = dateISO.split('-');
  return `${day}/${month}/${year}`;
}

function formatDayMonth(dateISO) {
  const [, month, day] = dateISO.split('-');
  return `${day}/${month}`;
}

function formatLongDate(dateISO) {
  const label = parseISODate(dateISO).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthLabel(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 1);
  const label = date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getDateMode() {
  if (state.selectedDate === state.todayDate) return 'today';
  if (state.selectedDate < state.todayDate) return 'past';
  return 'future';
}

function getDateModeLabel() {
  const mode = getDateMode();
  if (mode === 'today') return 'Editando hoje';
  if (mode === 'past') return 'Editando dia passado';
  return 'Planejando dia futuro';
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');

  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2100);
}

function debounce(fn, wait) {
  let timeout = null;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => fn(...args), wait);
  };
}

function setView(view) {
  state.activeView = view;

  Object.entries(elements.views).forEach(([name, element]) => {
    element.classList.toggle('active-view', name === view);
  });

  elements.navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  elements.bottomNavItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  document.body.classList.remove('sidebar-open');

  if (view === 'journal') loadJournal();
  if (view === 'backup') loadHealth();
  if (view === 'tracker') {
    renderTracker();
  }
}

function updateTemporalHeader() {
  const mode = getDateMode();
  const label = getDateModeLabel();

  elements.todayLabel.textContent = formatShortDate(state.todayDate);
  elements.selectedLabel.textContent = formatShortDate(state.selectedDate);
  elements.dateModeBadge.textContent = label;
  elements.dateModeBadge.dataset.mode = mode;
  elements.trackerTodayLabel.textContent = formatShortDate(state.todayDate);
  elements.trackerSelectedLabel.textContent = formatShortDate(
    state.selectedDate
  );
  elements.trackerDateModeBadge.textContent = label;
  elements.trackerDateModeBadge.dataset.mode = mode;
  elements.mobileTemporalBadge.textContent = `${formatDayMonth(state.selectedDate)} · ${label}`;
}

async function selectDate(dateISO, options = {}) {
  state.selectedDate = dateISO;
  state.currentMonth = dateISO.slice(0, 7);
  state.selectedWeekStart = getWeekStart(dateISO);

  updateTemporalHeader();

  const dashboardIsCurrentMonth =
    state.dashboard && state.dashboard.month === state.currentMonth;

  if (!options.skipMonth && !dashboardIsCurrentMonth) {
    await loadDashboard();
  }

  await loadDay(state.selectedDate);

  /*
    Correção visual:
    trocar o dia selecionado precisa atualizar os contornos .is-selected
    imediatamente, sem depender de marcar/desmarcar uma checkbox.
  */
  if (state.dashboard && state.dashboard.month === state.currentMonth) {
    renderTracker();
  }

  if (state.activeView === 'journal') {
    await loadJournal();
  }
}

async function refreshAll() {
  await loadDashboard();
  await loadDay(state.selectedDate);

  if (state.activeView === 'journal') {
    await loadJournal();
  }

  updateTemporalHeader();
}

async function loadDashboard() {
  elements.monthPicker.value = state.currentMonth;
  elements.journalMonthFilter.value = state.currentMonth;

  const dashboard = await api(`/dashboard?month=${state.currentMonth}`);
  const stats = await api(`/stats?month=${state.currentMonth}`);

  state.dashboard = dashboard;
  state.stats = stats;

  renderTracker();
  renderHabitProgressList();
  renderCharts();
}

async function loadDay(dateISO = state.selectedDate) {
  const day = await api(`/day/${dateISO}`);
  state.day = day;

  renderOverview();
  renderTrackerCheckin();
  renderWeek();
}

function renderOverview() {
  if (!state.day) return;

  elements.overviewTitle.textContent = `Resumo — ${formatLongDate(state.selectedDate)}`;
  elements.overviewProgressChip.textContent = `${state.day.progress.totalPercent}%`;
  elements.overviewHabitStat.textContent = `${state.day.progress.habitsDone}/${state.day.progress.habitsTotal}`;
  elements.overviewTaskStat.textContent = `${state.day.progress.tasksDone}/${state.day.progress.tasksTotal}`;
  elements.overviewTotalStat.textContent = `${state.day.progress.totalPercent}%`;
  elements.overviewProgressFill.style.width = `${state.day.progress.totalPercent}%`;
  elements.overviewProgressFill.classList.toggle(
    'complete',
    state.day.progress.totalPercent === 100
  );

  renderTaskList(elements.overviewTaskList, state.day.tasks.slice(0, 5), {
    empty: 'Nenhuma tarefa neste dia.',
    compact: true,
  });

  const mindset = state.day.mindset;
  elements.overviewMindsetMini.innerHTML = `
    <span>Energy <strong>${mindset.energia}/5</strong></span>
    <span>Focus <strong>${mindset.foco}/5</strong></span>
    <span>Motivation <strong>${mindset.motivacao}/5</strong></span>
    <span>Mood <strong>${mindset.humor}/5</strong></span>
  `;

  elements.overviewNotePreview.textContent = mindset.notas
    ? mindset.notas.slice(0, 260)
    : 'Sem nota registrada para este dia.';
}

function renderTracker() {
  if (!state.dashboard) return;

  elements.monthTitle.textContent = monthLabel(state.currentMonth);
  renderHabitMatrix();
  renderHabitProgressList();
  renderWeek();
  renderTrackerCheckin();
}

function renderHabitMatrix() {
  if (!state.dashboard) return;

  const weeks = state.dashboard.weeks;
  const habits = state.dashboard.habits;
  const logMap = state.dashboard.logMap || {};

  /*
    Importante:
    O Habit Matrix agora usa UMA ÚNICA grade CSS.
    Header de semanas, header de dias e checkboxes compartilham
    as mesmas colunas: coluna de hábito + repeat(totalDays, coluna do dia).
    Isso elimina o desalinhamento causado por wrappers de semana com padding/gap próprios.
  */
  const days = weeks.flatMap((week) => week.days).filter(Boolean);
  const totalDays = days.length;

  const weekSpans = weeks
    .map((week) => {
      const weekDays = week.days.filter(Boolean);
      if (!weekDays.length) return '';

      const firstIndex = days.findIndex((day) => day.date === weekDays[0].date);
      const startCol = firstIndex + 2;

      return `
        <div
          class="qpmatrix-week week-accent-${week.index % 5}"
          style="grid-column: ${startCol} / span ${weekDays.length}; grid-row: 1;"
        >
          ${week.label}
        </div>
      `;
    })
    .join('');

  const dayHeaders = days
    .map((day, index) => {
      const isToday = day.date === state.todayDate;
      const isSelected = day.date === state.selectedDate;
      const isFuture = day.date > state.todayDate;
      const weekday = parseISODate(day.date)
        .toLocaleDateString('pt-BR', { weekday: 'short' })
        .replace('.', '');

      return `
        <button
          class="qpmatrix-day matrix-day-header ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${isFuture ? 'is-future' : ''}"
          type="button"
          data-select-date="${day.date}"
          style="grid-column: ${index + 2}; grid-row: 2;"
          title="Selecionar ${formatShortDate(day.date)}"
          aria-label="Selecionar ${formatShortDate(day.date)}"
        >
          <span class="day-week">${escapeHTML(weekday)}</span>
          <span class="day-num">${day.day}</span>
          ${isToday ? '<strong>HOJE</strong>' : ''}
          ${isSelected ? '<em>SEL.</em>' : ''}
        </button>
      `;
    })
    .join('');

  const rows = habits
    .map((habit, habitIndex) => {
      const row = habitIndex + 3;

      const habitInfo = `
        <div class="qpmatrix-habit habit-info" style="grid-column: 1; grid-row: ${row};">
          <strong>${escapeHTML(habit.titulo)}</strong>
          <small>${escapeHTML(habit.subtitulo || '')}</small>
          <div class="habit-row-actions">
            <button class="row-link edit-habit-inline" type="button" data-habit-id="${habit.id}">Editar</button>
            <button class="row-link danger delete-habit-inline" type="button" data-habit-id="${habit.id}">Excluir</button>
          </div>
        </div>
      `;

      const cells = days
        .map((day, dayIndex) => {
          const isToday = day.date === state.todayDate;
          const isSelected = day.date === state.selectedDate;
          const isFuture = day.date > state.todayDate;
          const beforeStart = habit.data_inicio && day.date < habit.data_inicio;
          const afterEnd = habit.data_fim && day.date > habit.data_fim;
          const disabled = beforeStart || afterEnd || !habit.ativo;
          const done = logMap[`${habit.id}:${day.date}`] === true;
          const tooltip = `${habit.titulo} — ${formatShortDate(day.date)} — ${done ? 'concluído' : 'não concluído'}`;

          return `
            <button
              class="qpmatrix-check habit-check-cell ${done ? 'done is-done' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${isFuture ? 'is-future' : ''} ${disabled ? 'disabled' : ''}"
              type="button"
              data-habit-id="${habit.id}"
              data-date="${day.date}"
              style="grid-column: ${dayIndex + 2}; grid-row: ${row};"
              title="${escapeHTML(tooltip)}"
              aria-label="${escapeHTML(tooltip)}"
              ${disabled ? 'disabled' : ''}
            >
              <span class="habit-checkbox"></span>
            </button>
          `;
        })
        .join('');

      return `${habitInfo}${cells}`;
    })
    .join('');

  elements.habitMatrix.innerHTML = `
    <div class="qpmatrix" style="--days-in-month: ${totalDays};">
      <div class="qpmatrix-corner" style="grid-column: 1; grid-row: 1 / span 2;">Hábitos</div>
      ${weekSpans}
      ${dayHeaders}
      ${rows || '<div class="empty-state qpmatrix-empty" style="grid-column: 1 / -1; grid-row: 3;">Nenhum hábito ativo. Use + Hábito para criar.</div>'}
    </div>
  `;
}
function renderHabitProgressList() {
  if (!state.dashboard) return;

  const stats = state.dashboard.stats.habitStats || [];

  elements.habitProgressList.innerHTML = stats.length
    ? stats
        .sort((a, b) => b.percent - a.percent)
        .map((item) => {
          const tone =
            item.percent >= 70 ? 'good' : item.percent >= 35 ? 'mid' : 'bad';

          return `
            <div class="habit-progress-item">
              <div>
                <strong>${escapeHTML(item.titulo)}</strong>
                <span>${item.doneDays}/${item.possibleDays} dias</span>
              </div>
              <div class="habit-progress-bar">
                <i class="${tone}" style="width:${item.percent}%"></i>
              </div>
              <b>${item.percent}%</b>
            </div>
          `;
        })
        .join('')
    : '<div class="empty-state">Sem dados de hábitos neste mês.</div>';
}

function renderWeek() {
  if (!state.dashboard) return;

  const start = state.selectedWeekStart;
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  elements.weekTitle.textContent = `${formatShortDate(days[0])} → ${formatShortDate(days[6])}`;

  elements.weekDayTabs.innerHTML = days
    .map(
      (date) => `
      <button
        class="week-tab ${date === state.selectedDate ? 'active' : ''} ${date === state.todayDate ? 'today' : ''}"
        type="button"
        data-date="${date}"
      >
        <span>${parseISODate(date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
        <strong>${formatDayMonth(date)}</strong>
      </button>
    `
    )
    .join('');

  elements.weekCards.innerHTML = days
    .map((date) => {
      const tasks = state.dashboard.tasksByDate?.[date] || [];
      const daySummary = state.dashboard.days?.[date] || { taskPercent: 0 };
      const dateLabel = parseISODate(date).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      });

      return `
        <article class="week-card ${date === state.selectedDate ? 'selected' : ''} ${date === state.todayDate ? 'today' : ''}" data-date="${date}">
          <div class="week-card-head">
            <button class="week-card-date" type="button" data-date="${date}">
              <span>${escapeHTML(dateLabel)}</span>
              <strong>${daySummary.taskPercent || 0}% tarefas</strong>
            </button>
            <button class="mini-action add-task-for-date" type="button" data-date="${date}">+</button>
          </div>

          <div class="ring" style="--p:${daySummary.taskPercent || 0}">
            <span>${daySummary.taskPercent || 0}%</span>
          </div>

          <ul class="task-list compact">
            ${
              tasks.length
                ? tasks
                    .map(
                      (task) => `
                      <li class="task-mini ${task.status === 'CONCLUIDO' ? 'done' : ''}">
                        <button class="task-toggle mini" type="button" data-task-id="${task.id}">${task.status === 'CONCLUIDO' ? '✓' : ''}</button>
                        <span>${escapeHTML(task.titulo)}</span>
                        <button class="edit-task-btn mini" type="button" data-task-id="${task.id}">✎</button>
                        <button class="delete-task-btn mini" type="button" data-task-id="${task.id}">×</button>
                      </li>
                    `
                    )
                    .join('')
                : '<li class="empty-state small">Sem tarefas.</li>'
            }
          </ul>
        </article>
      `;
    })
    .join('');
}

function renderTrackerCheckin() {
  if (!state.day) return;

  elements.trackerCheckinTitle.textContent = `Check-in — ${formatLongDate(state.selectedDate)}`;
  renderMindsetEditor(elements.trackerMindsetGrid, state.day.mindset);
  elements.trackerNotes.value = state.day.mindset.notas || '';
}

function renderTaskList(container, tasks, options = {}) {
  if (!tasks.length) {
    container.innerHTML = `<li class="empty-state">${options.empty || 'Nenhuma tarefa.'}</li>`;
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
      <li class="task-item ${task.status === 'CONCLUIDO' ? 'done' : ''}" data-task-id="${task.id}">
        <button class="touch-check task-toggle ${task.status === 'CONCLUIDO' ? 'done' : ''}" type="button" data-task-id="${task.id}">
          ${task.status === 'CONCLUIDO' ? '✓' : ''}
        </button>
        <div class="item-main">
          <div class="item-title">${escapeHTML(task.titulo)}</div>
          <div class="item-subtitle">${escapeHTML(task.descricao || '')}</div>
          <div class="task-meta">
            <span>${escapeHTML(task.prioridade)}</span>
            <span>${formatShortDate(task.data_ref)}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="edit-task-btn" type="button" data-task-id="${task.id}">✎</button>
          <button class="delete-task-btn" type="button" data-task-id="${task.id}">×</button>
        </div>
      </li>
    `
    )
    .join('');
}

function renderMindsetEditor(container, mindset) {
  const configs = [
    ['energia', 'Energy', '⚡'],
    ['foco', 'Focus', '◎'],
    ['motivacao', 'Motivation', '◆'],
    ['humor', 'Mood', '☾'],
  ];

  container.innerHTML = configs
    .map(([key, label, icon]) => {
      const value = Number(mindset[key] || 2);

      return `
        <article class="mind-card" data-stat="${key}">
          <div class="mind-label">${label} <span>${icon}</span></div>
          <div class="mind-value">${value}</div>
          <div class="mind-buttons">
            ${[1, 2, 3, 4, 5]
              .map(
                (number) => `
                <button
                  class="mind-btn ${number === value ? 'active' : ''}"
                  type="button"
                  data-stat="${key}"
                  data-value="${number}"
                >
                  ${number}
                </button>
              `
              )
              .join('')}
          </div>
        </article>
      `;
    })
    .join('');
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    charts[key] = null;
  }
}

function renderCharts() {
  if (!state.stats || typeof Chart === 'undefined') return;

  renderMonthDonut();
  renderTasksBar();
  renderMindsetLine();
  renderHabitBar();
  renderWeekBar();
}

function baseChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 450, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: '#A2A7B4',
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          font: { family: 'Inter', size: 10, weight: '800' },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10,10,10,0.96)',
        titleColor: '#F5F7FA',
        bodyColor: '#A2A7B4',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        ticks: { color: '#777B86' },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        ticks: { color: '#777B86' },
        grid: { display: false },
        border: { display: false },
        beginAtZero: true,
      },
    },
    ...extra,
  };
}

function renderMonthDonut() {
  destroyChart('monthDonut');

  const done = state.stats.monthSummary.monthDone || 0;
  const total = state.stats.monthSummary.monthItems || 0;
  const pending = Math.max(total - done, 0);

  charts.monthDonut = new Chart(elements.monthDonutChart.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Concluído', 'Pendente'],
      datasets: [
        {
          data: [done, pending],
          backgroundColor: ['#DEFF9A', 'rgba(255,255,255,0.06)'],
          borderWidth: 0,
        },
      ],
    },
    options: baseChartOptions({ cutout: '70%', scales: undefined }),
  });
}

function renderTasksBar() {
  destroyChart('tasksBar');

  const series = state.stats.tasksDoneSeries || [];

  charts.tasksBar = new Chart(elements.tasksBarChart.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((item) => item.date.slice(-2)),
      datasets: [
        {
          label: 'Tarefas concluídas',
          data: series.map((item) => item.total),
          backgroundColor: '#11CAA0',
          borderRadius: 999,
        },
      ],
    },
    options: baseChartOptions({
      plugins: { ...baseChartOptions().plugins, legend: { display: false } },
    }),
  });
}

function renderMindsetLine() {
  destroyChart('mindsetLine');

  const series = state.stats.mindsetSeries || [];

  charts.mindsetLine = new Chart(elements.mindsetLineChart.getContext('2d'), {
    type: 'line',
    data: {
      labels: series.map((item) => item.date.slice(-2)),
      datasets: [
        {
          label: 'Energy',
          data: series.map((item) => item.energia),
          borderColor: '#DEFF9A',
          backgroundColor: 'rgba(222,255,154,0.08)',
          tension: 0.4,
        },
        {
          label: 'Focus',
          data: series.map((item) => item.foco),
          borderColor: '#11CAA0',
          backgroundColor: 'rgba(17,202,160,0.08)',
          tension: 0.4,
        },
        {
          label: 'Motivation',
          data: series.map((item) => item.motivacao),
          borderColor: '#BC84EE',
          backgroundColor: 'rgba(188,132,238,0.08)',
          tension: 0.4,
        },
        {
          label: 'Mood',
          data: series.map((item) => item.humor),
          borderColor: '#FFD166',
          backgroundColor: 'rgba(255,209,102,0.08)',
          tension: 0.4,
        },
      ],
    },
    options: baseChartOptions({
      scales: {
        y: {
          min: 0,
          max: 5,
          ticks: { color: '#777B86', stepSize: 1 },
          grid: { display: false },
          border: { display: false },
        },
        x: {
          ticks: { color: '#777B86' },
          grid: { display: false },
          border: { display: false },
        },
      },
    }),
  });
}

function renderHabitBar() {
  destroyChart('habitBar');

  const series = state.stats.habitStats || [];

  charts.habitBar = new Chart(elements.habitBarChart.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((item) => item.titulo),
      datasets: [
        {
          label: '%',
          data: series.map((item) => item.percent),
          backgroundColor: '#BC84EE',
          borderRadius: 999,
        },
      ],
    },
    options: baseChartOptions({
      indexAxis: 'y',
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { color: '#777B86', callback: (v) => `${v}%` },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          ticks: { color: '#A2A7B4' },
          grid: { display: false },
          border: { display: false },
        },
      },
    }),
  });
}

function renderWeekBar() {
  destroyChart('weekBar');

  const series = state.stats.weekStats || [];

  charts.weekBar = new Chart(elements.weekBarChart.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((item) => item.label),
      datasets: [
        {
          label: 'Progresso semanal',
          data: series.map((item) => item.percent),
          backgroundColor: '#DEFF9A',
          borderRadius: 999,
        },
      ],
    },
    options: baseChartOptions({
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#777B86', callback: (v) => `${v}%` },
          grid: { display: false },
          border: { display: false },
        },
        x: {
          ticks: { color: '#777B86' },
          grid: { display: false },
          border: { display: false },
        },
      },
    }),
  });
}

function openModal({
  title,
  message,
  body = '',
  confirmText = 'Confirmar',
  confirmClass = 'danger',
  onConfirm,
}) {
  activeModalCallback = onConfirm || null;
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modalBody.innerHTML = body;
  elements.modalConfirmBtn.textContent = confirmText;
  elements.modalConfirmBtn.classList.toggle(
    'danger',
    confirmClass === 'danger'
  );
  elements.modalConfirmBtn.classList.toggle(
    'confirm',
    confirmClass === 'confirm'
  );
  elements.modalOverlay.removeAttribute('hidden');
}

function closeModal() {
  elements.modalOverlay.setAttribute('hidden', '');
  elements.modalBody.innerHTML = '';
  activeModalCallback = null;
}

function formValue(name) {
  const input = elements.modalBody.querySelector(`[name="${name}"]`);
  if (!input) return '';
  if (input.type === 'checkbox') return input.checked;
  return input.value;
}

function openHabitModal(habit = null, defaults = {}) {
  const isEdit = Boolean(habit);
  const dataInicio = isEdit
    ? habit.data_inicio || ''
    : defaults.data_inicio || '';
  const dataFim = isEdit ? habit.data_fim || '' : '';

  openModal({
    title: isEdit ? 'Editar hábito' : 'Criar hábito',
    message: isEdit
      ? 'Atualize o hábito sem perder histórico.'
      : 'Crie um hábito para o Habit Matrix.',
    confirmText: isEdit ? 'Salvar' : 'Criar',
    confirmClass: 'confirm',
    body: `
      <div class="modal-form">
        <label>Nome<input name="titulo" type="text" value="${escapeHTML(habit?.titulo || '')}" placeholder="Ex: Projeto pessoal" /></label>
        <label>Descrição<input name="subtitulo" type="text" value="${escapeHTML(habit?.subtitulo || '')}" placeholder="Descrição curta" /></label>
        <label>Cor<input name="cor" type="color" value="${escapeHTML(habit?.cor || '#11caa0')}" /></label>
        <label>Data início<input name="data_inicio" type="date" value="${escapeHTML(dataInicio)}" /></label>
        <label>Data fim<input name="data_fim" type="date" value="${escapeHTML(dataFim)}" /></label>
        <label class="check-row"><input name="ativo" type="checkbox" ${habit?.ativo === false ? '' : 'checked'} /> Ativo</label>
      </div>
    `,
    onConfirm: async () => {
      const payload = {
        titulo: formValue('titulo'),
        subtitulo: formValue('subtitulo'),
        cor: formValue('cor'),
        data_inicio: formValue('data_inicio') || null,
        data_fim: formValue('data_fim') || null,
        ativo: formValue('ativo'),
      };

      if (!payload.titulo.trim()) {
        showToast('Nome obrigatório.');
        return false;
      }

      if (isEdit) {
        await api(`/habits/${habit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast('Hábito atualizado.');
      } else {
        await api('/habits', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Hábito criado.');
      }

      await refreshAll();
      return true;
    },
  });
}

function openTaskModal(task = null, defaults = {}) {
  const isEdit = Boolean(task);

  openModal({
    title: isEdit ? 'Editar tarefa' : 'Criar tarefa',
    message: isEdit
      ? 'Atualize a tarefa pontual sem perder histórico.'
      : 'A tarefa será vinculada ao dia escolhido.',
    confirmText: isEdit ? 'Salvar' : 'Criar',
    confirmClass: 'confirm',
    body: `
      <div class="modal-form">
        <label>Título<input name="titulo" type="text" value="${escapeHTML(task?.titulo || '')}" placeholder="Nome da tarefa" /></label>
        <label>Descrição<textarea name="descricao" placeholder="Detalhes opcionais">${escapeHTML(task?.descricao || '')}</textarea></label>
        <label>Prioridade
          <select name="prioridade">
            ${['ALTA', 'MÉDIA', 'BAIXA'].map((priority) => `<option value="${priority}" ${priority === (task?.prioridade || 'MÉDIA') ? 'selected' : ''}>${priority}</option>`).join('')}
          </select>
        </label>
        <label>Data<input name="data_ref" type="date" value="${escapeHTML(task?.data_ref || defaults.data_ref || state.selectedDate)}" /></label>
      </div>
    `,
    onConfirm: async () => {
      const payload = {
        titulo: formValue('titulo'),
        descricao: formValue('descricao'),
        prioridade: formValue('prioridade'),
        data_ref: formValue('data_ref') || state.selectedDate,
      };

      if (!payload.titulo.trim()) {
        showToast('Título obrigatório.');
        return false;
      }

      if (isEdit) {
        await api(`/tasks/${task.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast('Tarefa atualizada.');
      } else {
        await api('/tasks', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Tarefa criada.');
      }

      state.selectedDate = payload.data_ref;
      state.currentMonth = payload.data_ref.slice(0, 7);
      state.selectedWeekStart = getWeekStart(payload.data_ref);
      await refreshAll();
      return true;
    },
  });
}

function getTaskById(id) {
  const fromDay = state.day?.tasks?.find(
    (task) => Number(task.id) === Number(id)
  );
  if (fromDay) return fromDay;

  const tasksByDate = state.dashboard?.tasksByDate || {};
  for (const tasks of Object.values(tasksByDate)) {
    const found = tasks.find((task) => Number(task.id) === Number(id));
    if (found) return found;
  }

  return null;
}

function getHabitById(id) {
  return (
    state.dashboard?.habits?.find((habit) => Number(habit.id) === Number(id)) ||
    null
  );
}

async function toggleHabit(habitId, date, nextValue = null) {
  const current = state.dashboard?.logMap?.[`${habitId}:${date}`] === true;
  const concluido = nextValue === null ? !current : Boolean(nextValue);

  await api(`/habits/${habitId}/log`, {
    method: 'PUT',
    body: JSON.stringify({ data_ref: date, concluido }),
  });

  showToast(concluido ? 'Hábito marcado.' : 'Hábito desmarcado.');
  await refreshAll();
}

async function toggleTask(taskId) {
  const task = getTaskById(taskId);
  if (!task) return;

  const nextStatus = task.status === 'CONCLUIDO' ? 'PENDENTE' : 'CONCLUIDO';

  await api(`/tasks/${taskId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: nextStatus }),
  });

  showToast(
    nextStatus === 'CONCLUIDO' ? 'Tarefa concluída.' : 'Tarefa reaberta.'
  );
  await refreshAll();
}

function deleteTask(taskId) {
  openModal({
    title: 'Excluir tarefa',
    message:
      'Tem certeza que deseja excluir esta tarefa? Ela será ocultada, preservando o histórico interno.',
    confirmText: 'Excluir',
    confirmClass: 'danger',
    onConfirm: async () => {
      await api(`/tasks/${taskId}`, { method: 'DELETE' });
      showToast('Tarefa excluída.');
      await refreshAll();
      return true;
    },
  });
}

function deleteHabit(habitId) {
  openModal({
    title: 'Excluir hábito',
    message:
      'Tem certeza que deseja excluir este hábito? Ele será desativado e os logs antigos serão preservados.',
    confirmText: 'Excluir',
    confirmClass: 'danger',
    onConfirm: async () => {
      await api(`/habits/${habitId}`, { method: 'DELETE' });
      showToast('Hábito desativado.');
      await refreshAll();
      return true;
    },
  });
}

async function saveMindsetFromTracker() {
  const current = state.day?.mindset || {};
  const payload = {
    energia: Number(current.energia || 2),
    foco: Number(current.foco || 2),
    motivacao: Number(current.motivacao || 2),
    humor: Number(current.humor || 2),
    notas: elements.trackerNotes.value,
  };

  await api(`/mindset/${state.selectedDate}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  showToast('Check-in salvo.');
  await refreshAll();
}

async function setMindsetValue(stat, value) {
  const current = state.day?.mindset || {};
  const payload = {
    energia: Number(current.energia || 2),
    foco: Number(current.foco || 2),
    motivacao: Number(current.motivacao || 2),
    humor: Number(current.humor || 2),
    notas: elements.trackerNotes?.value ?? current.notas ?? '',
    [stat]: Number(value),
  };

  await api(`/mindset/${state.selectedDate}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  await refreshAll();
}

async function loadJournal() {
  const month = elements.journalMonthFilter.value || state.currentMonth;
  const q = encodeURIComponent(elements.journalSearch.value || '');
  const payload = await api(`/checkins?month=${month}&q=${q}`);

  elements.journalList.innerHTML = payload.items.length
    ? payload.items.map(renderJournalCard).join('')
    : '<div class="empty-state">Nenhum check-in neste mês.</div>';
}

function renderJournalCard(item) {
  const text = item.notas ? item.notas.slice(0, 220) : 'Sem nota.';

  return `
    <article class="history-card" data-date="${item.data_ref}">
      <div class="history-card-top">
        <strong>${formatShortDate(item.data_ref)}</strong>
        <div class="journal-actions">
          <button class="row-link open-journal" data-date="${item.data_ref}" type="button">Abrir / Editar</button>
          <button class="row-link copy-md" data-date="${item.data_ref}" type="button">Copiar MD</button>
          <button class="row-link download-md" data-date="${item.data_ref}" type="button">Baixar .md</button>
        </div>
      </div>
      <div class="history-metrics">
        <span>E ${item.energia}/5</span>
        <span>F ${item.foco}/5</span>
        <span>M ${item.motivacao}/5</span>
        <span>H ${item.humor}/5</span>
      </div>
      <p>${escapeHTML(text)}</p>
    </article>
  `;
}

async function openJournalDetail(date) {
  await selectDate(date, { skipMonth: false });

  const day = state.day;

  elements.journalDetail.innerHTML = `
    <div class="detail-card">
      <div class="panel-header compact-header">
        <div>
          <div class="panel-kicker">${formatShortDate(date)}</div>
          <h2 class="panel-title">Check-in completo</h2>
        </div>
        <div class="journal-actions">
          <button class="mini-action copy-md" data-date="${date}" type="button">Copiar MD</button>
          <button class="mini-action download-md" data-date="${date}" type="button">Baixar .md</button>
          <button class="mini-action" data-view="tracker" type="button">Editar no Tracker</button>
        </div>
      </div>

      <div class="history-metrics large">
        <span>Energy ${day.mindset.energia}/5</span>
        <span>Focus ${day.mindset.foco}/5</span>
        <span>Motivation ${day.mindset.motivacao}/5</span>
        <span>Mood ${day.mindset.humor}/5</span>
      </div>

      <p class="note-full">${escapeHTML(day.mindset.notas || 'Sem nota.')}</p>
    </div>
  `;
}

async function getMarkdown(date = state.selectedDate) {
  const payload = await api(`/day/${date}/export-md`);
  return payload.markdown;
}

async function exportMarkdown(mode, date = state.selectedDate) {
  const markdown = await getMarkdown(date);

  if (mode === 'copy') {
    await navigator.clipboard.writeText(markdown);
    showToast('Markdown copiado.');
    return;
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${date}-QuietProgress.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast('Markdown baixado.');
}

async function loadAuthInfo() {
  if (!elements.authState) return;

  try {
    const payload = await api('/auth/me');
    elements.authState.textContent = payload.authenticated
      ? 'Autenticado'
      : 'Sessão inválida';
  } catch (error) {
    elements.authState.textContent = 'Sessão expirada';
  }
}

async function logout() {
  try {
    await api('/logout', { method: 'POST' });
  } catch (error) {
    // Mesmo se a sessão já tiver expirado, volta para o login.
  } finally {
    window.location.href = '/login';
  }
}

function downloadBackup() {
  window.open('/api/backup', '_blank');
}

function restoreDatabase(file) {
  if (!file) return;

  openModal({
    title: 'Restaurar banco',
    message:
      'Isso vai substituir o banco atual. Faça backup antes de continuar.',
    confirmText: 'Restaurar',
    confirmClass: 'danger',
    onConfirm: async () => {
      const formData = new FormData();
      formData.append('database', file);

      const response = await fetch('/api/sistema/restore', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao restaurar banco.');
      }

      showToast('Banco restaurado. Recarregando...');
      window.setTimeout(() => window.location.reload(), 900);
      return true;
    },
  });
}

async function loadHealth() {
  const payload = await api('/health');
  state.health = payload;

  elements.healthBox.innerHTML = `
    <strong>Status:</strong> ${payload.status}<br>
    <strong>Uptime:</strong> ${payload.uptime}s<br>
    <strong>Node:</strong> ${payload.node}<br>
    <strong>Platform:</strong> ${payload.platform} ${payload.arch}<br>
    <strong>DB:</strong> ${payload.databasePath}<br>
    <strong>DB existe:</strong> ${payload.databaseExists ? 'sim' : 'não'}<br>
    <strong>Memória heap:</strong> ${Math.round(payload.memory.heapUsed / 1024 / 1024)} MB
  `;
}

function setLockinDuration(minutes) {
  const safe = Math.min(Math.max(Number(minutes) || 25, 1), 180);
  lockinInitialSeconds = safe * 60;

  if (!lockinRunning) {
    lockinRemainingSeconds = lockinInitialSeconds;
    renderLockinTimer();
  }
}

function renderLockinTimer() {
  const minutes = Math.floor(lockinRemainingSeconds / 60);
  const seconds = lockinRemainingSeconds % 60;
  elements.lockinTime.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startLockinTimer() {
  if (lockinRunning) return;

  lockinRunning = true;
  document.body.classList.add('focus-mode');

  lockinInterval = window.setInterval(() => {
    lockinRemainingSeconds -= 1;

    if (lockinRemainingSeconds <= 0) {
      pauseLockinTimer();
      lockinRemainingSeconds = 0;
      showToast('Lock In concluído.');
    }

    renderLockinTimer();
  }, 1000);
}

function pauseLockinTimer() {
  lockinRunning = false;
  document.body.classList.remove('focus-mode');
  window.clearInterval(lockinInterval);
  lockinInterval = null;
}

function resetLockinTimer() {
  pauseLockinTimer();
  lockinRemainingSeconds = lockinInitialSeconds;
  renderLockinTimer();
}

function shiftMonth(delta) {
  const [year, month] = state.currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  state.currentMonth = toISODate(date).slice(0, 7);
  loadDashboard();
}

function shiftWeek(delta) {
  state.selectedWeekStart = addDays(state.selectedWeekStart, delta * 7);
  selectDate(state.selectedWeekStart);
}

function attachEvents() {
  elements.navItems.forEach((item) =>
    item.addEventListener('click', () => setView(item.dataset.view))
  );
  elements.bottomNavItems.forEach((item) =>
    item.addEventListener('click', () => setView(item.dataset.view))
  );

  elements.mobileMenuBtn.addEventListener('click', () =>
    document.body.classList.add('sidebar-open')
  );
  elements.sidebarOverlay.addEventListener('click', () =>
    document.body.classList.remove('sidebar-open')
  );

  elements.mobileTodayBtn.addEventListener('click', () =>
    selectDate(state.todayDate)
  );
  elements.goTodayBtn.addEventListener('click', () =>
    selectDate(state.todayDate)
  );

  elements.openTrackerBtn.addEventListener('click', () => setView('tracker'));
  elements.overviewOpenTrackerBtn.addEventListener('click', () =>
    setView('tracker')
  );
  elements.quickAddTaskBtn.addEventListener('click', () =>
    openTaskModal(null, { data_ref: state.selectedDate })
  );
  elements.overviewAddTaskBtn.addEventListener('click', () =>
    openTaskModal(null, { data_ref: state.selectedDate })
  );
  elements.overviewEditCheckinBtn.addEventListener('click', () =>
    setView('tracker')
  );
  elements.overviewCopyMarkdownBtn.addEventListener('click', () =>
    exportMarkdown('copy', state.selectedDate)
  );
  elements.overviewDownloadMarkdownBtn.addEventListener('click', () =>
    exportMarkdown('download', state.selectedDate)
  );

  elements.monthPicker.addEventListener('change', () => {
    state.currentMonth = elements.monthPicker.value || state.currentMonth;
    loadDashboard();
  });

  elements.prevMonthBtn.addEventListener('click', () => shiftMonth(-1));
  elements.nextMonthBtn.addEventListener('click', () => shiftMonth(1));
  elements.monthTodayBtn.addEventListener('click', () =>
    selectDate(state.todayDate)
  );
  elements.addHabitBtn.addEventListener('click', () => openHabitModal());
  elements.addHabitFromDateBtn.addEventListener('click', () =>
    openHabitModal(null, { data_inicio: state.selectedDate })
  );

  elements.habitMatrix.addEventListener('click', async (event) => {
    const dayHeader = event.target.closest('[data-select-date]');
    if (dayHeader) {
      await selectDate(dayHeader.dataset.selectDate, { skipMonth: true });
      return;
    }

    const habitCell = event.target.closest('.habit-check-cell[data-habit-id]');
    if (habitCell && !habitCell.disabled) {
      await toggleHabit(
        Number(habitCell.dataset.habitId),
        habitCell.dataset.date
      );
      return;
    }

    const editHabitBtn = event.target.closest('.edit-habit-inline');
    if (editHabitBtn) {
      openHabitModal(getHabitById(editHabitBtn.dataset.habitId));
      return;
    }

    const deleteHabitBtn = event.target.closest('.delete-habit-inline');
    if (deleteHabitBtn) {
      deleteHabit(deleteHabitBtn.dataset.habitId);
    }
  });

  document.addEventListener('click', async (event) => {
    const taskToggle = event.target.closest('.task-toggle');
    if (taskToggle) {
      await toggleTask(taskToggle.dataset.taskId);
      return;
    }

    const editTaskBtn = event.target.closest('.edit-task-btn');
    if (editTaskBtn) {
      openTaskModal(getTaskById(editTaskBtn.dataset.taskId));
      return;
    }

    const deleteTaskBtn = event.target.closest('.delete-task-btn');
    if (deleteTaskBtn) {
      deleteTask(deleteTaskBtn.dataset.taskId);
      return;
    }

    const addTaskForDate = event.target.closest('.add-task-for-date');
    if (addTaskForDate) {
      openTaskModal(null, { data_ref: addTaskForDate.dataset.date });
      return;
    }

    const weekTab = event.target.closest('.week-tab');
    if (weekTab) {
      await selectDate(weekTab.dataset.date);
      return;
    }

    const weekCardDate = event.target.closest('.week-card-date');
    if (weekCardDate) {
      await selectDate(weekCardDate.dataset.date);
      return;
    }

    const openJournal = event.target.closest('.open-journal');
    if (openJournal) {
      await openJournalDetail(openJournal.dataset.date);
      return;
    }

    const copyMd = event.target.closest('.copy-md');
    if (copyMd) {
      await exportMarkdown('copy', copyMd.dataset.date);
      return;
    }

    const downloadMd = event.target.closest('.download-md');
    if (downloadMd) {
      await exportMarkdown('download', downloadMd.dataset.date);
      return;
    }

    const routeBtn = event.target.closest('[data-view]');
    if (routeBtn && routeBtn.classList.contains('mini-action')) {
      setView(routeBtn.dataset.view);
    }
  });

  elements.prevWeekBtn.addEventListener('click', () => shiftWeek(-1));
  elements.nextWeekBtn.addEventListener('click', () => shiftWeek(1));

  elements.trackerSaveMindsetBtn.addEventListener(
    'click',
    saveMindsetFromTracker
  );
  elements.trackerCopyMarkdownBtn.addEventListener('click', () =>
    exportMarkdown('copy', state.selectedDate)
  );
  elements.trackerDownloadMarkdownBtn.addEventListener('click', () =>
    exportMarkdown('download', state.selectedDate)
  );
  elements.trackerMindsetGrid.addEventListener('click', async (event) => {
    const button = event.target.closest('.mind-btn');
    if (!button) return;
    await setMindsetValue(button.dataset.stat, button.dataset.value);
  });

  elements.journalMonthFilter.addEventListener('change', loadJournal);
  elements.journalSearch.addEventListener('input', debounce(loadJournal, 250));

  elements.backupBtn.addEventListener('click', downloadBackup);
  elements.sidebarBackupBtn.addEventListener('click', downloadBackup);
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', logout);
  }
  elements.restoreDbBtn.addEventListener('click', () =>
    elements.restoreDbInput.click()
  );
  elements.restoreDbInput.addEventListener('change', () =>
    restoreDatabase(elements.restoreDbInput.files?.[0])
  );

  elements.modalCancelBtn.addEventListener('click', closeModal);
  elements.modalOverlay.addEventListener('click', (event) => {
    if (event.target === elements.modalOverlay) closeModal();
  });
  elements.modalConfirmBtn.addEventListener('click', async () => {
    if (!activeModalCallback) {
      closeModal();
      return;
    }

    try {
      const shouldClose = await activeModalCallback();
      if (shouldClose !== false) closeModal();
    } catch (error) {
      showToast(error.message);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.modalOverlay.hasAttribute('hidden'))
      closeModal();
  });

  elements.lockinPresetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (lockinRunning) {
        showToast('Pause antes de mudar o tempo.');
        return;
      }

      elements.lockinPresetButtons.forEach((preset) =>
        preset.classList.remove('active')
      );
      button.classList.add('active');

      const isCustom = button.dataset.custom === 'true';
      elements.lockinCustomWrap.toggleAttribute('hidden', !isCustom);

      if (isCustom) {
        setLockinDuration(elements.lockinCustomInput.value);
        elements.lockinCustomInput.focus();
      } else {
        setLockinDuration(button.dataset.minutes);
      }
    });
  });

  elements.lockinCustomInput.addEventListener('input', () => {
    if (!lockinRunning) setLockinDuration(elements.lockinCustomInput.value);
  });

  elements.lockinStartBtn.addEventListener('click', startLockinTimer);
  elements.lockinPauseBtn.addEventListener('click', pauseLockinTimer);
  elements.lockinResetBtn.addEventListener('click', resetLockinTimer);
}

async function init() {
  updateTemporalHeader();
  attachEvents();
  renderLockinTimer();

  elements.monthPicker.value = state.currentMonth;
  elements.journalMonthFilter.value = state.currentMonth;

  try {
    await loadDashboard();
    await loadDay(state.selectedDate);
    await loadHealth();
    await loadAuthInfo();
  } catch (error) {
    showToast(error.message);
  }
}

/* ============================================================
   AUTH / LOGOUT / BFCache PROTECTION
   Quiet Progress
   ============================================================ */

async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json().catch(() => null);

    return Boolean(payload && payload.authenticated === true);
  } catch {
    return false;
  }
}

async function logout() {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    console.warn('[AUTH] Falha ao chamar logout:', error);
  } finally {
    /*
      replace() evita deixar a página protegida como entrada normal
      no histórico do navegador.
    */
    window.location.replace('/login');
  }
}

function bindLogoutButtons() {
  const possibleLogoutButtons = [
    document.getElementById('logoutBtn'),
    document.getElementById('sidebarLogoutBtn'),
    document.querySelector('[data-action="logout"]'),
    document.querySelector('[data-auth-action="logout"]'),
  ].filter(Boolean);

  possibleLogoutButtons.forEach((button) => {
    if (button.dataset.logoutBound === 'true') return;

    button.dataset.logoutBound = 'true';

    button.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  });
}

/*
  Proteção contra back-forward cache:
  Alguns navegadores, principalmente mobile, restauram a tela antiga ao apertar
  "voltar", mesmo depois do logout. Quando a página volta do bfcache, conferimos
  se a sessão ainda existe. Se não existir, manda para /login.
*/
window.addEventListener('pageshow', async () => {
  const authenticated = await checkAuthStatus();

  if (!authenticated) {
    window.location.replace('/login');
  }
});

/*
  Proteção extra:
  Quando a aba volta a ficar visível, confere sessão.
  Isso ajuda em mobile, onde o navegador pode congelar/restaurar páginas.
*/
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;

  const authenticated = await checkAuthStatus();

  if (!authenticated) {
    window.location.replace('/login');
  }
});

/*
  Inicialização segura.
  Se teu app já tem DOMContentLoaded, isso não quebra.
*/
document.addEventListener('DOMContentLoaded', () => {
  bindLogoutButtons();
});

document.addEventListener('DOMContentLoaded', init);
