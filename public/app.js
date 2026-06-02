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
  shouldAutoScrollHabitMatrix: true,
  habitReorder: {
    draggedId: null,
    overId: null,
    previousIds: [],
    saving: false,
  },
  reviewExport: {
    type: 'day',
    selectedDate: toISODate(new Date()),
    selectedMonth: toISODate(new Date()).slice(0, 7),
    payload: null,
  },
  currentReview: null,
};

const charts = {
  monthDonut: null,
  tasksBar: null,
  mindsetLine: null,
  habitBar: null,
  reductionOccurrencesBar: null,
  weekBar: null,
};

let activeModalCallback = null;
let lockinInitialSeconds = 25 * 60;
let lockinRemainingSeconds = lockinInitialSeconds;
let lockinInterval = null;
let lockinRunning = false;
let lockinExpectedEndTime = null;
let lockinStartedAt = null;
let lockinAudioContext = null;
let lockinSoundEnabled =
  localStorage.getItem('quietProgress.lockin.sound') !== 'false';

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
  overviewBuildScore: document.getElementById('overviewBuildScore'),
  overviewReductionScore: document.getElementById('overviewReductionScore'),
  overviewOverallScore: document.getElementById('overviewOverallScore'),
  overviewActiveStreaks: document.getElementById('overviewActiveStreaks'),
  overviewBestStreaks: document.getElementById('overviewBestStreaks'),
  overviewReductionSummary: document.getElementById('overviewReductionSummary'),
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
  reviewTypeButtons: Array.from(document.querySelectorAll('.review-type-btn')),
  reviewDateWrap: document.getElementById('reviewDateWrap'),
  reviewMonthWrap: document.getElementById('reviewMonthWrap'),
  reviewDateInput: document.getElementById('reviewDateInput'),
  reviewMonthInput: document.getElementById('reviewMonthInput'),
  reviewPeriodHelp: document.getElementById('reviewPeriodHelp'),
  reviewPrevPeriodBtn: document.getElementById('reviewPrevPeriodBtn'),
  reviewCurrentPeriodBtn: document.getElementById('reviewCurrentPeriodBtn'),
  reviewNextPeriodBtn: document.getElementById('reviewNextPeriodBtn'),
  reviewQuickButtons: Array.from(document.querySelectorAll('[data-review-quick]')),
  reviewPreviewMeta: document.getElementById('reviewPreviewMeta'),
  reviewMarkdownPreview: document.getElementById('reviewMarkdownPreview'),
  reviewCopyMarkdownBtn: document.getElementById('reviewCopyMarkdownBtn'),
  reviewDownloadMarkdownBtn: document.getElementById('reviewDownloadMarkdownBtn'),

  backupBtn: document.getElementById('backupBtn'),
  sidebarBackupBtn: document.getElementById('sidebarBackupBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  authState: document.getElementById('authState'),
  restoreDbBtn: document.getElementById('restoreDbBtn'),
  restoreDbInput: document.getElementById('restoreDbInput'),
  healthBox: document.getElementById('healthBox'),
  weeklyReviewRange: document.getElementById('weeklyReviewRange'),
  copyWeeklyReviewBtn: document.getElementById('copyWeeklyReviewBtn'),
  downloadWeeklyReviewBtn: document.getElementById('downloadWeeklyReviewBtn'),
  runAutoBackupBtn: document.getElementById('runAutoBackupBtn'),
  refreshDataDoctorBtn: document.getElementById('refreshDataDoctorBtn'),
  backupStatusBox: document.getElementById('backupStatusBox'),
  dataDoctorBox: document.getElementById('dataDoctorBox'),
  archivedHabitsBox: document.getElementById('archivedHabitsBox'),

  lockinTime: document.getElementById('lockinTime'),
  lockinStartBtn: document.getElementById('lockinStartBtn'),
  lockinPauseBtn: document.getElementById('lockinPauseBtn'),
  lockinResetBtn: document.getElementById('lockinResetBtn'),
  lockinSoundBtn: document.getElementById('lockinSoundBtn'),
  lockinPresetButtons: Array.from(document.querySelectorAll('.lockin-preset')),
  lockinCustomWrap: document.getElementById('lockinCustomWrap'),
  lockinCustomInput: document.getElementById('lockinCustomInput'),
  endDayStatusChip: document.getElementById('endDayStatusChip'),
  downloadEndDayBtn: document.getElementById('downloadEndDayBtn'),
  copyEndDayBtn: document.getElementById('copyEndDayBtn'),
  closeDayBtn: document.getElementById('closeDayBtn'),
  overviewFocusSummary: document.getElementById('overviewFocusSummary'),

  monthDonutChart: document.getElementById('monthDonutChart'),
  tasksBarChart: document.getElementById('tasksBarChart'),
  mindsetLineChart: document.getElementById('mindsetLineChart'),
  habitBarChart: document.getElementById('habitBarChart'),
  reductionOccurrencesChart: document.getElementById('reductionOccurrencesChart'),
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


function downloadTextFile(filename, content, mime = 'text/plain') {
  const safeContent = String(content ?? '');
  const blob = new Blob([safeContent], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 250);
}

async function copyTextRobust(text) {
  const value = String(text ?? '');

  if (!value.trim()) {
    throw new Error('Nada para copiar.');
  }

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    const ok = document.execCommand('copy');
    if (!ok) {
      throw new Error('execCommand copy retornou false.');
    }
    return true;
  } finally {
    textarea.remove();
  }
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
    state.shouldAutoScrollHabitMatrix = true;
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
  state.reviewExport.selectedDate = state.selectedDate;
  state.reviewExport.selectedMonth = state.currentMonth;
  updateReviewInputs();

  const dashboard = await api(`/dashboard?month=${state.currentMonth}&date=${state.selectedDate}`);
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

  const progress = state.day.progress || {};
  const stats = state.dashboard?.stats || {};

  elements.overviewTitle.textContent = `Resumo — ${formatLongDate(state.selectedDate)}`;
  elements.overviewProgressChip.textContent = `${progress.overallScore ?? progress.totalPercent ?? 0}%`;
  elements.overviewHabitStat.textContent = `${progress.habitsDone}/${progress.habitsTotal}`;
  elements.overviewTaskStat.textContent = `${progress.tasksDone}/${progress.tasksTotal}`;
  elements.overviewTotalStat.textContent = `${progress.totalPercent}%`;
  elements.overviewProgressFill.style.width = `${progress.overallScore ?? progress.totalPercent ?? 0}%`;
  elements.overviewProgressFill.classList.toggle(
    'complete',
    (progress.overallScore ?? progress.totalPercent ?? 0) === 100
  );

  if (elements.overviewBuildScore) {
    elements.overviewBuildScore.textContent = `${stats.buildScore ?? progress.buildScore ?? 0}%`;
  }

  if (elements.overviewReductionScore) {
    elements.overviewReductionScore.textContent = `${stats.reductionScore ?? progress.reductionScore ?? 0}%`;
  }

  if (elements.overviewOverallScore) {
    elements.overviewOverallScore.textContent = `${stats.overallScore ?? progress.overallScore ?? 0}%`;
  }

  renderOverviewStreaks();
  renderOverviewFocusSummary();

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

function renderStreakItem(item, mode) {
  const isReduction = item.habit_type === 'reduction';
  const icon = isReduction ? '🛡️' : '🔥';
  const current = Number(item.currentStreak || 0);
  const best = Number(item.bestStreak || 0);

  if (isReduction) {
    return `
      <div class="streak-item reduction">
        <span>${icon}</span>
        <strong>${escapeHTML(item.titulo)}</strong>
        <em>Clean streak: ${current} ${current === 1 ? 'day' : 'days'}</em>
        <small>Best clean streak: ${best} ${best === 1 ? 'day' : 'days'} · Occurrences this month: ${Number(item.occurrences || 0)}</small>
      </div>
    `;
  }

  return `
    <div class="streak-item build">
      <span>${icon}</span>
      <strong>${escapeHTML(item.titulo)}</strong>
      <em>Current streak: ${current} ${current === 1 ? 'day' : 'days'}</em>
      <small>Best streak: ${best} ${best === 1 ? 'day' : 'days'} · Month completed: ${Number(item.completedDays || 0)}/${Number(item.possibleDays || 0)}</small>
    </div>
  `;
}

function renderStreakGroup(title, items, mode, emptyText) {
  return `
    <div class="streak-group">
      <h4>${escapeHTML(title)}</h4>
      ${
        items.length
          ? items.map((item) => renderStreakItem(item, mode)).join('')
          : `<div class="empty-state small">${escapeHTML(emptyText)}</div>`
      }
    </div>
  `;
}

function renderOverviewStreaks() {
  if (!elements.overviewActiveStreaks || !elements.overviewBestStreaks) return;

  const stats = state.dashboard?.stats || {};
  const active = stats.activeStreaks || { build: [], reduction: [] };
  const best = stats.bestStreaks || { build: [], reduction: [] };

  elements.overviewActiveStreaks.innerHTML = [
    renderStreakGroup(
      'Active Build Streaks',
      active.build || [],
      'active',
      'No active build streaks yet.'
    ),
    renderStreakGroup(
      'Active Clean Streaks',
      active.reduction || [],
      'active',
      'No active clean streaks yet.'
    ),
  ].join('');

  elements.overviewBestStreaks.innerHTML = [
    renderStreakGroup(
      'Best Build Streaks',
      best.build || [],
      'best',
      'No best build streak yet.'
    ),
    renderStreakGroup(
      'Best Clean Streaks',
      best.reduction || [],
      'best',
      'No best clean streak yet.'
    ),
  ].join('');

  renderReductionSummary();
}

function renderReductionSummary() {
  if (!elements.overviewReductionSummary) return;

  const reductionStats = (state.dashboard?.stats?.habitStats || []).filter(
    (item) => item.habit_type === 'reduction'
  );

  if (!reductionStats.length) {
    elements.overviewReductionSummary.innerHTML = `
      <span>🛡️ No reduction habits yet</span>
    `;
    return;
  }

  const cleanDays = reductionStats.reduce(
    (sum, item) => sum + Number(item.cleanDays || 0),
    0
  );
  const occurrences = reductionStats.reduce(
    (sum, item) => sum + Number(item.occurrences || 0),
    0
  );
  const bestClean = reductionStats.reduce(
    (max, item) => Math.max(max, Number(item.bestStreak || 0)),
    0
  );

  elements.overviewReductionSummary.innerHTML = `
    <span>🛡️ Clean days this month: ${cleanDays}</span>
    <span>⚠️ Occurrences this month: ${occurrences}</span>
    <span>🏆 Best clean streak: ${bestClean} ${bestClean === 1 ? 'day' : 'days'}</span>
  `;
}


function renderOverviewFocusSummary() {
  if (!elements.overviewFocusSummary) return;

  const focus = state.day?.focus || { completed: 0, minutes: 0 };

  elements.overviewFocusSummary.textContent = `Focus blocks today: ${focus.completed} · Focus minutes: ${focus.minutes}`;
}

async function fetchEndDayMarkdown(close = false) {
  const date = state.selectedDate;

  if (close) {
    const payload = await api(`/day/${date}/end-day`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (elements.endDayStatusChip) {
      elements.endDayStatusChip.textContent = 'CLOSED';
    }

    return payload.markdown;
  }

  const payload = await api(`/day/${date}/end-day`);
  if (elements.endDayStatusChip) {
    elements.endDayStatusChip.textContent = payload.closed ? 'CLOSED' : 'OPEN';
  }
  return payload.markdown;
}

async function closeDay() {
  const markdown = await fetchEndDayMarkdown(true);
  showToast('Dia fechado.');
  return markdown;
}

async function copyEndDayMarkdown() {
  const markdown = await fetchEndDayMarkdown(false);
  try {
    await copyTextRobust(markdown);
    showToast('Markdown do fechamento copiado.');
  } catch (error) {
    console.warn('[Markdown] Falha ao copiar fechamento:', error);
    showToast('Não foi possível copiar. Use baixar .md.');
  }
}

async function downloadEndDayMarkdown() {
  const markdown = await fetchEndDayMarkdown(false);
  downloadTextFile(
    `${state.selectedDate}-QuietProgress-EndDay.md`,
    markdown,
    'text/markdown'
  );
}

function shiftMonthValue(monthValue, delta) {
  const [year, month] = monthValue.split('-').map(Number);
  return toISODate(new Date(year, month - 1 + delta, 1)).slice(0, 7);
}

function getReviewSelectedDate() {
  return state.reviewExport.selectedDate || state.selectedDate;
}

function getReviewSelectedMonth() {
  return state.reviewExport.selectedMonth || state.currentMonth;
}

function setReviewType(type) {
  state.reviewExport.type = ['day', 'week', 'month'].includes(type) ? type : 'day';
  state.reviewExport.payload = null;
  state.currentReview = null;

  elements.reviewTypeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.reviewType === state.reviewExport.type);
  });

  const isMonth = state.reviewExport.type === 'month';

  if (elements.reviewDateWrap) {
    elements.reviewDateWrap.hidden = isMonth;
    elements.reviewDateWrap.childNodes[0].nodeValue =
      state.reviewExport.type === 'week' ? 'Semana\n                  ' : 'Data\n                  ';
  }

  if (elements.reviewMonthWrap) {
    elements.reviewMonthWrap.hidden = !isMonth;
  }

  updateReviewInputs();
  updateReviewPeriodHelp();
  loadReviewPreview().catch((error) => {
    console.error(error);
    showToast('Erro ao gerar preview.');
  });
}

function updateReviewInputs() {
  if (elements.reviewDateInput) {
    elements.reviewDateInput.value = getReviewSelectedDate();
  }

  if (elements.reviewMonthInput) {
    elements.reviewMonthInput.value = getReviewSelectedMonth();
  }
}

function getReviewDisplayMeta(payload) {
  if (!payload) return '';

  if (payload.type === 'week') {
    return `Weekly Review · ${payload.start} → ${payload.end}`;
  }

  if (payload.type === 'month') {
    return `Monthly Review · ${payload.start.slice(0, 7)}`;
  }

  return `Daily Review · ${payload.start}`;
}

function updateReviewPeriodHelp(payload = null) {
  if (!elements.reviewPeriodHelp) return;

  if (payload?.title) {
    elements.reviewPeriodHelp.textContent = getReviewDisplayMeta(payload);
    return;
  }

  if (state.reviewExport.type === 'week') {
    const start = getWeekStart(getReviewSelectedDate());
    const end = addDays(start, 6);
    elements.reviewPeriodHelp.textContent = `Semana de ${start} até ${end}`;
    return;
  }

  if (state.reviewExport.type === 'month') {
    elements.reviewPeriodHelp.textContent = `Monthly Review — ${getReviewSelectedMonth()}`;
    return;
  }

  elements.reviewPeriodHelp.textContent = `Daily Review — ${getReviewSelectedDate()}`;
}

function getReviewEndpoint() {
  const type = state.reviewExport.type;

  if (type === 'month') {
    return `/reviews/month/${getReviewSelectedMonth()}`;
  }

  const date = getReviewSelectedDate();

  if (type === 'week') {
    return `/reviews/week/${date}`;
  }

  return `/reviews/day/${date}`;
}

async function loadReviewPreview() {
  if (!elements.reviewMarkdownPreview || !elements.reviewPreviewMeta) return;

  const endpoint = getReviewEndpoint();
  updateReviewPeriodHelp();
  elements.reviewPreviewMeta.textContent = 'Gerando preview...';
  elements.reviewMarkdownPreview.textContent = 'Carregando...';

  const payload = await api(endpoint);
  state.reviewExport.payload = payload;
  state.currentReview = payload;

  updateReviewPeriodHelp(payload);
  elements.reviewPreviewMeta.textContent = getReviewDisplayMeta(payload);
  elements.reviewMarkdownPreview.textContent = payload.markdown || '_Sem conteúdo._';

  return payload;
}

async function getReviewPayload() {
  if (!state.currentReview?.markdown) {
    return loadReviewPreview();
  }

  return state.currentReview;
}

async function copyReviewMarkdown() {
  const payload = await getReviewPayload();

  try {
    await copyTextRobust(payload.markdown || '');
    showToast('Markdown copiado.');
  } catch (error) {
    console.warn('[Markdown] Falha ao copiar:', error);
    showToast('Não foi possível copiar. Use baixar .md.');
  }
}

async function downloadReviewMarkdown() {
  const payload = await getReviewPayload();

  downloadTextFile(
    payload.filename || `quiet-progress-${payload.type}-${payload.start}.md`,
    payload.markdown || '',
    'text/markdown'
  );

  showToast('Markdown baixado.');
}

function shiftReviewPeriod(delta) {
  const type = state.reviewExport.type;

  if (type === 'month') {
    state.reviewExport.selectedMonth = shiftMonthValue(getReviewSelectedMonth(), delta);
    state.reviewExport.selectedDate = `${state.reviewExport.selectedMonth}-01`;
  } else if (type === 'week') {
    state.reviewExport.selectedDate = addDays(getReviewSelectedDate(), delta * 7);
    state.reviewExport.selectedMonth = state.reviewExport.selectedDate.slice(0, 7);
  } else {
    state.reviewExport.selectedDate = addDays(getReviewSelectedDate(), delta);
    state.reviewExport.selectedMonth = state.reviewExport.selectedDate.slice(0, 7);
  }

  state.reviewExport.payload = null;
  state.currentReview = null;
  updateReviewInputs();
  updateReviewPeriodHelp();
  loadReviewPreview();
}

function setReviewCurrentPeriod() {
  const today = state.todayDate;

  if (state.reviewExport.type === 'month') {
    state.reviewExport.selectedMonth = today.slice(0, 7);
    state.reviewExport.selectedDate = `${state.reviewExport.selectedMonth}-01`;
  } else if (state.reviewExport.type === 'week') {
    state.reviewExport.selectedDate = getWeekStart(today);
    state.reviewExport.selectedMonth = state.reviewExport.selectedDate.slice(0, 7);
  } else {
    state.reviewExport.selectedDate = today;
    state.reviewExport.selectedMonth = today.slice(0, 7);
  }

  state.reviewExport.payload = null;
  state.currentReview = null;
  updateReviewInputs();
  updateReviewPeriodHelp();
  loadReviewPreview();
}

function applyReviewQuickAction(action) {
  const today = state.todayDate;
  const thisWeekStart = getWeekStart(today);

  if (action === 'today') {
    state.reviewExport.type = 'day';
    state.reviewExport.selectedDate = today;
    state.reviewExport.selectedMonth = today.slice(0, 7);
  }

  if (action === 'yesterday') {
    const yesterday = addDays(today, -1);
    state.reviewExport.type = 'day';
    state.reviewExport.selectedDate = yesterday;
    state.reviewExport.selectedMonth = yesterday.slice(0, 7);
  }

  if (action === 'this-week') {
    state.reviewExport.type = 'week';
    state.reviewExport.selectedDate = thisWeekStart;
    state.reviewExport.selectedMonth = thisWeekStart.slice(0, 7);
  }

  if (action === 'last-week') {
    const lastWeekStart = addDays(thisWeekStart, -7);
    state.reviewExport.type = 'week';
    state.reviewExport.selectedDate = lastWeekStart;
    state.reviewExport.selectedMonth = lastWeekStart.slice(0, 7);
  }

  if (action === 'this-month') {
    state.reviewExport.type = 'month';
    state.reviewExport.selectedMonth = today.slice(0, 7);
    state.reviewExport.selectedDate = `${state.reviewExport.selectedMonth}-01`;
  }

  if (action === 'last-month') {
    const lastMonth = shiftMonthValue(today.slice(0, 7), -1);
    state.reviewExport.type = 'month';
    state.reviewExport.selectedMonth = lastMonth;
    state.reviewExport.selectedDate = `${lastMonth}-01`;
  }

  state.reviewExport.payload = null;
  state.currentReview = null;
  setReviewType(state.reviewExport.type);
}

async function fetchWeeklyReviewMarkdown() {
  state.reviewExport.type = 'week';
  state.reviewExport.selectedDate = state.selectedDate;
  updateReviewInputs();
  const payload = await api(`/reviews/week/${state.selectedDate}`);
  state.reviewExport.payload = payload;
  return payload.markdown;
}

async function copyWeeklyReviewMarkdown() {
  const markdown = await fetchWeeklyReviewMarkdown();
  try {
    await copyTextRobust(markdown);
    showToast('Weekly Review copiado.');
  } catch (error) {
    console.warn('[Markdown] Falha ao copiar weekly review:', error);
    showToast('Não foi possível copiar. Use baixar .md.');
  }
}

async function downloadWeeklyReviewMarkdown() {
  const payload = await api(`/reviews/week/${state.selectedDate}`);
  downloadTextFile(
    payload.filename || `quiet-progress-week-${payload.start}_to_${payload.end}.md`,
    payload.markdown,
    'text/markdown'
  );
}



function renderTracker() {
  if (!state.dashboard) return;

  elements.monthTitle.textContent = monthLabel(state.currentMonth);
  renderHabitMatrix();
  renderHabitProgressList();
  renderWeek();
  renderTrackerCheckin();
}

function getCurrentHabitOrderIds() {
  return (state.dashboard?.habits || []).map((habit) => Number(habit.id));
}

function setHabitRowDragState(habitId, className, enabled) {
  if (!elements.habitMatrix) return;

  elements.habitMatrix
    .querySelectorAll(`[data-habit-row="${habitId}"], [data-reorder-habit-id="${habitId}"]`)
    .forEach((node) => node.classList.toggle(className, enabled));
}

function clearHabitReorderVisualState() {
  if (!elements.habitMatrix) return;

  elements.habitMatrix
    .querySelectorAll('.is-dragging-row, .is-drag-over-row')
    .forEach((node) =>
      node.classList.remove('is-dragging-row', 'is-drag-over-row')
    );
}

function reorderHabitArray(fromId, toId) {
  const habits = state.dashboard?.habits || [];
  const fromIndex = habits.findIndex((habit) => Number(habit.id) === Number(fromId));
  const toIndex = habits.findIndex((habit) => Number(habit.id) === Number(toId));

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false;

  const next = habits.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  state.dashboard.habits = next.map((habit, index) => ({
    ...habit,
    ordem: (index + 1) * 10,
  }));

  return true;
}

async function saveHabitOrder(orderedIds, previousIds = null) {
  state.habitReorder.saving = true;

  try {
    await api('/habits/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds }),
    });

    showToast('Ordem dos hábitos salva.');
    await refreshAll();
  } catch (error) {
    if (previousIds?.length && state.dashboard?.habits?.length) {
      const previousIndex = new Map(
        previousIds.map((id, index) => [Number(id), index])
      );

      state.dashboard.habits = state.dashboard.habits
        .slice()
        .sort(
          (a, b) =>
            (previousIndex.get(Number(a.id)) ?? 99999) -
            (previousIndex.get(Number(b.id)) ?? 99999)
        );

      renderTracker();
      renderOverview();
      renderCharts();
    }

    showToast('Não foi possível salvar a nova ordem.');
    console.error('[Habit reorder] Falha:', error);
  } finally {
    state.habitReorder.saving = false;
  }
}

async function moveHabitByStep(id, direction) {
  if (!state.dashboard?.habits?.length || state.habitReorder.saving) return;

  const previousIds = getCurrentHabitOrderIds();
  const habits = state.dashboard.habits.slice();
  const index = habits.findIndex((habit) => Number(habit.id) === Number(id));
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= habits.length) return;

  const [moved] = habits.splice(index, 1);
  habits.splice(nextIndex, 0, moved);

  state.dashboard.habits = habits.map((habit, position) => ({
    ...habit,
    ordem: (position + 1) * 10,
  }));

  state.shouldAutoScrollHabitMatrix = false;
  renderTracker();
  await saveHabitOrder(getCurrentHabitOrderIds(), previousIds);
}

function handleHabitDragStart(event) {
  const handle = event.target.closest('[data-drag-habit-id]');
  if (!handle || !state.dashboard?.habits?.length) return;

  const id = Number(handle.dataset.dragHabitId);
  state.habitReorder.draggedId = id;
  state.habitReorder.overId = null;
  state.habitReorder.previousIds = getCurrentHabitOrderIds();

  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(id));

  window.requestAnimationFrame(() => {
    setHabitRowDragState(id, 'is-dragging-row', true);
  });
}

function handleHabitDragOver(event) {
  const target = event.target.closest('[data-reorder-habit-id]');
  const draggedId = state.habitReorder.draggedId;

  if (!target || !draggedId) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  const targetId = Number(target.dataset.reorderHabitId);

  if (targetId === state.habitReorder.overId) return;

  if (state.habitReorder.overId) {
    setHabitRowDragState(state.habitReorder.overId, 'is-drag-over-row', false);
  }

  state.habitReorder.overId = targetId;

  if (targetId !== draggedId) {
    setHabitRowDragState(targetId, 'is-drag-over-row', true);
  }
}

async function handleHabitDrop(event) {
  const target = event.target.closest('[data-reorder-habit-id]');
  const draggedId = state.habitReorder.draggedId;

  if (!target || !draggedId || state.habitReorder.saving) return;

  event.preventDefault();

  const targetId = Number(target.dataset.reorderHabitId);
  const previousIds = state.habitReorder.previousIds.slice();

  clearHabitReorderVisualState();

  state.habitReorder.draggedId = null;
  state.habitReorder.overId = null;
  state.habitReorder.previousIds = [];

  if (targetId === draggedId) return;

  const changed = reorderHabitArray(draggedId, targetId);
  if (!changed) return;

  state.shouldAutoScrollHabitMatrix = false;
  renderTracker();
  await saveHabitOrder(getCurrentHabitOrderIds(), previousIds);
}

function handleHabitDragEnd() {
  clearHabitReorderVisualState();

  state.habitReorder.draggedId = null;
  state.habitReorder.overId = null;
  state.habitReorder.previousIds = [];
}


function renderHabitMatrix() {
  if (!state.dashboard) return;

  const weeks = state.dashboard.weeks;
  const habits = state.dashboard.habits;
  const logMap = state.dashboard.logMap || {};
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
      const habitType = habit.habit_type === 'reduction' ? 'reduction' : 'build';
      const typeLabel = habitType === 'reduction' ? 'REDUCTION' : 'BUILD';

      const habitInfo = `
        <div
          class="qpmatrix-habit habit-info ${habitType}"
          style="grid-column: 1; grid-row: ${row};"
          data-reorder-habit-id="${habit.id}"
          data-habit-row="${habit.id}"
        >
          <div class="habit-title-row">
            <button
              class="habit-drag-handle"
              type="button"
              draggable="true"
              data-drag-habit-id="${habit.id}"
              title="Arraste pelo ícone para reordenar."
              aria-label="Arraste para reordenar ${escapeHTML(habit.titulo)}"
            ><span aria-hidden="true">⋮⋮</span></button>
            <strong>${escapeHTML(habit.titulo)}</strong>
            <span class="habit-type-badge ${habitType}">${typeLabel}</span>
            <button
              class="habit-mobile-menu-btn"
              type="button"
              data-habit-mobile-menu-id="${habit.id}"
              aria-label="Abrir ações de ${escapeHTML(habit.titulo)}"
              title="Ações"
            >⋯</button>
          </div>
          <small>${escapeHTML(habit.subtitulo || '')}</small>
          <div class="habit-row-actions">
            <button class="row-link move-habit-up" type="button" data-habit-id="${habit.id}" title="Mover para cima" aria-label="Mover ${escapeHTML(habit.titulo)} para cima">↑</button>
            <button class="row-link move-habit-down" type="button" data-habit-id="${habit.id}" title="Mover para baixo" aria-label="Mover ${escapeHTML(habit.titulo)} para baixo">↓</button>
            <button class="row-link edit-habit-inline" type="button" data-habit-id="${habit.id}">Editar</button>
            <button class="row-link archive-habit-inline" type="button" data-habit-id="${habit.id}">Arquivar</button>
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
          const checked = logMap[`${habit.id}:${day.date}`] === true;
          const statusText =
            habitType === 'reduction'
              ? checked
                ? 'occurrence logged'
                : 'clean day'
              : checked
                ? 'done'
                : 'not done';
          const tooltip = `${habit.titulo} — ${formatShortDate(day.date)} — ${statusText}`;

          return `
            <button
              class="qpmatrix-check habit-check-cell ${habitType} ${checked ? 'done is-done' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${isFuture ? 'is-future' : ''} ${disabled ? 'disabled' : ''}"
              type="button"
              data-habit-id="${habit.id}"
              data-habit-row="${habit.id}"
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

  maybeAutoScrollHabitMatrix();
}

function maybeAutoScrollHabitMatrix() {
  if (!state.shouldAutoScrollHabitMatrix) return;

  const wrapper = elements.habitMatrix?.closest('.habit-matrix-wrap');
  if (!wrapper) return;

  const target =
    elements.habitMatrix.querySelector(`[data-select-date="${state.selectedDate}"]`) ||
    elements.habitMatrix.querySelector(`[data-select-date="${state.todayDate}"]`);

  if (!target) return;

  window.requestAnimationFrame(() => {
    const left =
      target.offsetLeft - wrapper.clientWidth / 2 + target.clientWidth / 2;

    wrapper.scrollTo({
      left: Math.max(0, left),
      behavior: 'smooth',
    });

    state.shouldAutoScrollHabitMatrix = false;
  });
}

function renderHabitProgressList() {
  if (!state.dashboard) return;

  const stats = state.dashboard.stats.habitStats || [];
  const byManualOrder = (a, b) =>
    Number(a.ordem || 0) - Number(b.ordem || 0) ||
    Number(a.habit_id || 0) - Number(b.habit_id || 0);

  const buildStats = stats
    .filter((item) => item.habit_type !== 'reduction')
    .sort(byManualOrder);
  const reductionStats = stats
    .filter((item) => item.habit_type === 'reduction')
    .sort(byManualOrder);

  const renderItem = (item) => {
    const isReduction = item.habit_type === 'reduction';
    const tone = item.percent >= 70 ? 'good' : item.percent >= 35 ? 'mid' : 'bad';
    const label = isReduction ? 'clean rate' : 'completion';
    const detail = isReduction
      ? `${Number(item.cleanDays || 0)}/${Number(item.possibleDays || 0)} clean days · ${Number(item.occurrences || 0)} occurrences`
      : `${Number(item.completedDays || 0)}/${Number(item.possibleDays || 0)} completed`;

    return `
      <div class="habit-progress-item ${isReduction ? 'reduction' : 'build'}">
        <div>
          <strong>${escapeHTML(item.titulo)}</strong>
          <span>${escapeHTML(label)}</span>
        </div>
        <small>${escapeHTML(detail)}</small>
        <div class="habit-progress-bar">
          <i class="${tone}" style="width:${item.percent}%"></i>
        </div>
        <b>${item.percent}%</b>
      </div>
    `;
  };

  const renderGroup = (title, items, emptyText) => `
    <section class="habit-progress-group">
      <h3>${escapeHTML(title)}</h3>
      ${
        items.length
          ? items.map(renderItem).join('')
          : `<div class="empty-state small">${escapeHTML(emptyText)}</div>`
      }
    </section>
  `;

  elements.habitProgressList.innerHTML = stats.length
    ? [
        renderGroup('Build completion', buildStats, 'No build habits yet.'),
        renderGroup(
          'Reduction clean rate',
          reductionStats,
          'No reduction habits yet.'
        ),
      ].join('')
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
  renderReductionOccurrencesBar();
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

  const stats = state.stats.monthSummary || {};
  const values = [
    stats.buildScore || 0,
    stats.reductionScore || 0,
    stats.overallScore || stats.monthPercent || 0,
  ];

  charts.monthDonut = new Chart(elements.monthDonutChart.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Build', 'Reduction', 'Overall'],
      datasets: [
        {
          label: 'Score',
          data: values,
          backgroundColor: ['#DEFF9A', '#FFD166', '#11CAA0'],
          borderRadius: 999,
        },
      ],
    },
    options: baseChartOptions({
      plugins: { ...baseChartOptions().plugins, legend: { display: false } },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#777B86', callback: (v) => `${v}%` },
          grid: { display: false },
          border: { display: false },
        },
        x: {
          ticks: { color: '#A2A7B4' },
          grid: { display: false },
          border: { display: false },
        },
      },
    }),
  });
}

function renderTasksBar() {
  destroyChart('tasksBar');

  const series = state.stats.tasksDoneSeries || [];
  const maxValue = Math.max(...series.map((item) => Number(item.total || 0)), 1);

  charts.tasksBar = new Chart(elements.tasksBarChart.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((item) => item.date.slice(-2)),
      datasets: [
        {
          label: 'Tasks done',
          data: series.map((item) => item.total),
          backgroundColor: '#11CAA0',
          borderRadius: 999,
          minBarLength: 4,
        },
      ],
    },
    options: baseChartOptions({
      plugins: { ...baseChartOptions().plugins, legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: maxValue <= 1 ? 2 : maxValue + 1,
          ticks: { color: '#777B86', precision: 0, stepSize: 1 },
          grid: { display: false },
          border: { display: false },
        },
        x: {
          ticks: { color: '#777B86', maxRotation: 0 },
          grid: { display: false },
          border: { display: false },
        },
      },
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

  const rawSeries = state.stats.habitStats || [];
  const byManualOrder = (a, b) =>
    Number(a.ordem || 0) - Number(b.ordem || 0) ||
    Number(a.habit_id || 0) - Number(b.habit_id || 0);

  const buildSeries = rawSeries
    .filter((item) => item.habit_type !== 'reduction')
    .sort(byManualOrder);
  const reductionSeries = rawSeries
    .filter((item) => item.habit_type === 'reduction')
    .sort(byManualOrder);
  const series = [...buildSeries, ...reductionSeries];

  charts.habitBar = new Chart(elements.habitBarChart.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((item) => item.titulo),
      datasets: [
        {
          label: 'Build completion',
          data: series.map((item) =>
            item.habit_type === 'reduction' ? null : item.percent
          ),
          backgroundColor: '#BC84EE',
          borderRadius: 999,
        },
        {
          label: 'Reduction clean rate',
          data: series.map((item) =>
            item.habit_type === 'reduction' ? item.percent : null
          ),
          backgroundColor: '#FFD166',
          borderRadius: 999,
        },
      ],
    },
    options: baseChartOptions({
      indexAxis: 'y',
      plugins: {
        ...baseChartOptions().plugins,
        tooltip: {
          ...baseChartOptions().plugins.tooltip,
          callbacks: {
            label: (context) => {
              const item = series[context.dataIndex];
              if (!item) return `${context.parsed.x}%`;

              if (item.habit_type === 'reduction') {
                return `${item.percent}% clean rate · ${Number(item.occurrences || 0)} occurrences`;
              }

              return `${item.percent}% completion · ${Number(item.completedDays || 0)}/${Number(item.possibleDays || 0)} completed`;
            },
          },
        },
      },
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


function renderReductionOccurrencesBar() {
  destroyChart('reductionOccurrencesBar');

  if (!elements.reductionOccurrencesChart) return;

  const series = state.stats.reductionOccurrencesSeries || [];
  const maxValue = Math.max(...series.map((item) => Number(item.total || 0)), 1);

  charts.reductionOccurrencesBar = new Chart(
    elements.reductionOccurrencesChart.getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: series.map((item) => item.date.slice(-2)),
        datasets: [
          {
            label: 'Occurrences',
            data: series.map((item) => item.total),
            backgroundColor: '#FFD166',
            borderRadius: 999,
            minBarLength: 3,
          },
        ],
      },
      options: baseChartOptions({
        plugins: { ...baseChartOptions().plugins, legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxValue <= 1 ? 2 : maxValue + 1,
            ticks: { color: '#777B86', precision: 0, stepSize: 1 },
            grid: { display: false },
            border: { display: false },
          },
          x: {
            ticks: { color: '#777B86', maxRotation: 0 },
            grid: { display: false },
            border: { display: false },
          },
        },
      }),
    }
  );
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
  elements.modalOverlay.classList.remove('habit-action-sheet-open');
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
  const habitType = habit?.habit_type === 'reduction' ? 'reduction' : 'build';

  openModal({
    title: isEdit ? 'Editar hábito' : 'Criar hábito',
    message: isEdit
      ? 'Atualize o hábito sem perder histórico.'
      : 'Crie um hábito para o Habit Matrix.',
    confirmText: isEdit ? 'Salvar' : 'Criar',
    confirmClass: 'confirm',
    body: `
      <div class="modal-form habit-modal-form">
        <label class="modal-field-full">Nome<input name="titulo" type="text" value="${escapeHTML(habit?.titulo || '')}" placeholder="Ex: Bloco de foco" /></label>
        <label class="modal-field-full">Descrição<input name="subtitulo" type="text" value="${escapeHTML(habit?.subtitulo || '')}" placeholder="Descrição curta" /></label>

        <label>Tipo de hábito
          <select name="habit_type" id="habitTypeSelect">
            <option value="build" ${habitType === 'build' ? 'selected' : ''}>Build</option>
            <option value="reduction" ${habitType === 'reduction' ? 'selected' : ''}>Reduction</option>
          </select>
        </label>

        <label class="color-field">Cor
          <span class="color-input-wrap">
            <input name="cor" type="color" value="${escapeHTML(habit?.cor || '#11caa0')}" />
            <span id="habitColorPreview">${escapeHTML(habit?.cor || '#11caa0')}</span>
          </span>
        </label>

        <div class="habit-type-help modal-field-full" id="habitTypeHelp"></div>

        <label>Data início<input name="data_inicio" type="date" value="${escapeHTML(dataInicio)}" /></label>
        <label>Data fim<input name="data_fim" type="date" value="${escapeHTML(dataFim)}" /></label>
        <label class="check-row modal-field-full"><input name="ativo" type="checkbox" ${habit?.ativo === false ? '' : 'checked'} /> Ativo</label>
      </div>
    `,
    onConfirm: async () => {
      const payload = {
        titulo: formValue('titulo'),
        subtitulo: formValue('subtitulo'),
        habit_type: formValue('habit_type') === 'reduction' ? 'reduction' : 'build',
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

      state.shouldAutoScrollHabitMatrix = false;
      await refreshAll();
      return true;
    },
  });

  const typeSelect = elements.modalBody.querySelector('#habitTypeSelect');
  const help = elements.modalBody.querySelector('#habitTypeHelp');
  const colorInput = elements.modalBody.querySelector('input[name="cor"]');
  const colorPreview = elements.modalBody.querySelector('#habitColorPreview');

  const updateTypeHelp = () => {
    if (!typeSelect || !help) return;

    if (typeSelect.value === 'reduction') {
      help.innerHTML =
        '<strong>Reduction:</strong> Marque apenas quando aconteceu. Dias sem marcação contam como clean days.';
      help.dataset.type = 'reduction';
      return;
    }

    help.innerHTML =
      '<strong>Build:</strong> Marque os dias em que você fez esse hábito.';
    help.dataset.type = 'build';
  };

  const updateColorPreview = () => {
    if (!colorInput || !colorPreview) return;
    colorPreview.textContent = colorInput.value;
    colorPreview.style.setProperty('--preview-color', colorInput.value);
  };

  typeSelect?.addEventListener('change', updateTypeHelp);
  colorInput?.addEventListener('input', updateColorPreview);
  updateTypeHelp();
  updateColorPreview();
}

function openHabitMobileMenu(id) {
  const habit = state.dashboard?.habits?.find((item) => Number(item.id) === Number(id));
  const title = habit ? escapeHTML(habit.titulo) : 'Hábito';

  openModal({
    title: `Ações — ${title}`,
    message: 'Escolha uma ação para este hábito.',
    confirmText: 'Cancelar',
    confirmClass: '',
    body: `
      <div class="habit-mobile-action-sheet">
        <button type="button" data-habit-action="edit" data-habit-id="${id}">Editar</button>
        <button type="button" data-habit-action="archive" data-habit-id="${id}">Arquivar</button>
        <button type="button" data-habit-action="delete" data-habit-id="${id}">Excluir</button>
        <button type="button" data-habit-action="up" data-habit-id="${id}">Mover para cima</button>
        <button type="button" data-habit-action="down" data-habit-id="${id}">Mover para baixo</button>
      </div>
    `,
  });

  elements.modalOverlay.classList.add('habit-action-sheet-open');
}

function archiveHabit(id) {
  openModal({
    title: 'Arquivar hábito',
    message:
      'Arquivar este hábito? Ele deixará de aparecer no tracker, mas o histórico será preservado.',
    confirmText: 'Arquivar',
    confirmClass: 'danger',
    onConfirm: async () => {
      await api(`/habits/${id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true }),
      });
      showToast('Hábito arquivado.');
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

  if (!state.reviewExport.payload) {
    state.reviewExport.selectedDate = state.selectedDate;
    state.reviewExport.selectedMonth = state.currentMonth;
    updateReviewInputs();
    await loadReviewPreview();
  }
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
    try {
      await copyTextRobust(markdown);
      showToast('Markdown copiado.');
    } catch (error) {
      console.warn('[Markdown] Falha ao copiar:', error);
      showToast('Não foi possível copiar. Use baixar .md.');
    }
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

function downloadBackup() {
  window.open('/api/backup', '_blank');
}

function restoreDatabase(file) {
  if (!file) return;

  openModal({
    title: 'Restaurar banco',
    message:
      'Isso vai validar o arquivo, criar backup automático do banco atual e recarregar o SQLite. Use apenas backups confiáveis.',
    confirmText: 'Restaurar',
    confirmClass: 'danger',
    onConfirm: async () => {
      showToast('Restore iniciado. Validando banco...');

      const formData = new FormData();
      formData.append('database', file);

      const response = await fetch('/api/sistema/restore', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.details ||
            payload.error ||
            'Erro ao restaurar banco. O banco anterior foi preservado.'
        );
      }

      showToast(payload.message || 'Restore concluído. Recarregando dados...');

      state.shouldAutoScrollHabitMatrix = true;

      await refreshAll();
      await loadHealth();

      if (payload.legacyHabitTypeMigration) {
        showToast('Backup antigo restaurado. Revise Build/Reduction.');
        showLegacyHabitTypeNotice();
      } else if (payload.requiresRestart) {
        showToast('Restore concluído. Reinicie o servidor para carregar o banco restaurado.');
      } else {
        showToast('Restore concluído e banco recarregado.');
      }

      elements.restoreDbInput.value = '';
      return true;
    },
  });
}



function shouldSuggestReductionHabit(habit) {
  const text = `${habit.titulo || ''} ${habit.subtitulo || ''}`.toLowerCase();
  const terms = [
    'álcool',
    'alcool',
    'lust',
    'pornografia',
    'cigarro',
    'açúcar',
    'acucar',
    'redes sociais',
  ];

  return terms.some((term) => text.includes(term));
}

async function openHabitTypeReviewModal() {
  const payload = await api('/habits');
  const habits = payload.habits || [];

  if (!habits.length) {
    showToast('Nenhum hábito para revisar.');
    return;
  }

  const rows = habits
    .map((habit) => {
      const suggested =
        habit.habit_type === 'reduction' || shouldSuggestReductionHabit(habit)
          ? 'reduction'
          : 'build';

      return `
        <label class="habit-type-review-row">
          <div>
            <strong>${escapeHTML(habit.titulo)}</strong>
            <small>${escapeHTML(habit.subtitulo || '')}</small>
            ${
              suggested !== habit.habit_type
                ? '<em>Sugestão: Reduction</em>'
                : ''
            }
          </div>
          <select name="habit_type_${habit.id}" data-habit-type-id="${habit.id}">
            <option value="build" ${suggested === 'build' ? 'selected' : ''}>Build</option>
            <option value="reduction" ${suggested === 'reduction' ? 'selected' : ''}>Reduction</option>
          </select>
        </label>
      `;
    })
    .join('');

  openModal({
    title: 'Revisar tipos de hábitos',
    message:
      'Classifique hábitos antigos como Build ou Reduction sem perder histórico.',
    confirmText: 'Salvar tipos',
    confirmClass: 'confirm',
    body: `
      <div class="legacy-habit-warning">
        Este backup pode ter vindo de uma versão antiga sem tipo de hábito. Revise quais hábitos são Build ou Reduction.
      </div>
      <div class="habit-type-review-list">
        ${rows}
      </div>
    `,
    onConfirm: async () => {
      const updates = Array.from(
        elements.modalBody.querySelectorAll('[data-habit-type-id]')
      ).map((select) => ({
        id: Number(select.dataset.habitTypeId),
        habit_type: select.value === 'reduction' ? 'reduction' : 'build',
      }));

      await api('/habits/types', {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      });

      showToast('Tipos de hábitos atualizados.');
      state.shouldAutoScrollHabitMatrix = true;
      await refreshAll();
      renderCharts();
      return true;
    },
  });
}

function showLegacyHabitTypeNotice() {
  openModal({
    title: 'Revisar tipos de hábitos',
    message:
      'Este backup veio de uma versão antiga sem tipo de hábito. Revise quais hábitos são Build ou Reduction.',
    confirmText: 'Revisar tipos de hábitos',
    confirmClass: 'confirm',
    body: `
      <div class="legacy-habit-warning">
        Os dados foram carregados e nenhum histórico foi perdido. Como a versão antiga não tinha Build/Reduction, os hábitos entraram como Build por segurança.
      </div>
    `,
    onConfirm: async () => {
      await openHabitTypeReviewModal();
      return false;
    },
  });
}



function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round((value / 1024 / 1024) * 10) / 10} MB`;
}

async function loadBackupStatus() {
  if (!elements.backupStatusBox) return;

  try {
    const payload = await api('/backup/status');
    const backups = payload.backups || {};

    elements.backupStatusBox.innerHTML = `
      <strong>Backup Status</strong><br>
      <span>DB_PATH:</span> ${escapeHTML(payload.dbPath || '')}<br>
      <span>DB size:</span> ${formatBytes(payload.db?.size)}<br>
      <span>Último auto backup:</span> ${escapeHTML(backups.latestAuto?.name || 'nenhum')}<br>
      <span>Auto backups:</span> ${Number(backups.autoCount || 0)}<br>
      <span>Última falha:</span> ${escapeHTML(backups.lastAutoBackupError || 'nenhuma')}
    `;
  } catch (error) {
    elements.backupStatusBox.innerHTML = `<strong>Backup Status</strong><br>Erro: ${escapeHTML(error.message)}`;
  }
}

async function runAutoBackupNow() {
  const payload = await api('/backup/auto/run', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (payload.ok) {
    showToast(payload.skipped ? 'Backup automático já estava em dia.' : 'Backup criado.');
  } else {
    showToast(payload.error || 'Backup automático falhou.');
  }

  await loadBackupStatus();
  await loadDataDoctor();
}

async function loadDataDoctor() {
  if (!elements.dataDoctorBox) return;

  try {
    const payload = await api('/health/data');
    const statusLabel =
      payload.status === 'ok' ? 'OK' : payload.status === 'warning' ? 'WARNING' : 'ERROR';

    const warnings = (payload.warnings || [])
      .map((item) => `<li>${escapeHTML(item)}</li>`)
      .join('');
    const errors = (payload.errors || [])
      .map((item) => `<li>${escapeHTML(item)}</li>`)
      .join('');

    elements.dataDoctorBox.innerHTML = `
      <strong>Data Doctor: ${statusLabel}</strong><br>
      <span>DB_PATH:</span> ${escapeHTML(payload.db?.path || '')}<br>
      <span>DB existe:</span> ${payload.db?.exists ? 'sim' : 'não'}<br>
      <span>Tamanho:</span> ${formatBytes(payload.db?.size)}<br>
      <span>Integrity:</span> ${escapeHTML(payload.integrity || 'unknown')}<br>
      <span>Tabelas:</span> ${(payload.tables || []).length}<br>
      <span>Hábitos:</span> ${payload.counts?.habitos ?? 'n/a'} ·
      <span>Logs:</span> ${payload.counts?.habitos_log ?? 'n/a'} ·
      <span>Tarefas:</span> ${payload.counts?.tarefas ?? 'n/a'} ·
      <span>Check-ins:</span> ${payload.counts?.mindset ?? 'n/a'}<br>
      <span>WAL:</span> ${payload.db?.walExists ? `sim (${formatBytes(payload.db?.walSize)})` : 'não'} ·
      <span>SHM:</span> ${payload.db?.shmExists ? 'sim' : 'não'}
      ${warnings ? `<div class="doctor-warnings"><strong>Avisos</strong><ul>${warnings}</ul></div>` : ''}
      ${errors ? `<div class="doctor-errors"><strong>Erros</strong><ul>${errors}</ul></div>` : ''}
    `;
  } catch (error) {
    elements.dataDoctorBox.innerHTML = `<strong>Data Doctor</strong><br>Erro: ${escapeHTML(error.message)}`;
  }
}

async function loadArchivedHabits() {
  if (!elements.archivedHabitsBox) return;

  try {
    const payload = await api('/habits/archived');
    const habits = payload.habits || [];

    elements.archivedHabitsBox.innerHTML = `
      <strong>Hábitos arquivados</strong>
      ${
        habits.length
          ? habits
              .map(
                (habit) => `
                <div class="archived-habit-row">
                  <span>${escapeHTML(habit.titulo)} · ${escapeHTML(habit.habit_type)}</span>
                  <button class="row-link restore-archived-habit" data-habit-id="${habit.id}" type="button">Restaurar</button>
                </div>
              `
              )
              .join('')
          : '<div class="empty-state small">Nenhum hábito arquivado.</div>'
      }
    `;
  } catch (error) {
    elements.archivedHabitsBox.innerHTML = `<strong>Hábitos arquivados</strong><br>Erro: ${escapeHTML(error.message)}`;
  }
}

async function restoreArchivedHabit(id) {
  await api(`/habits/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ archive: false }),
  });

  showToast('Hábito restaurado.');
  await refreshAll();
  await loadArchivedHabits();
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

  await Promise.allSettled([
    loadBackupStatus(),
    loadDataDoctor(),
    loadArchivedHabits(),
  ]);
}

function persistLockinState() {
  localStorage.setItem(
    'quietProgress.lockin.state',
    JSON.stringify({
      initialSeconds: lockinInitialSeconds,
      remainingSeconds: lockinRemainingSeconds,
      expectedEndTime: lockinExpectedEndTime,
      running: lockinRunning,
      soundEnabled: lockinSoundEnabled,
    })
  );
}

function restoreLockinState() {
  try {
    const saved = JSON.parse(
      localStorage.getItem('quietProgress.lockin.state') || 'null'
    );

    if (!saved) return;

    lockinInitialSeconds = Number(saved.initialSeconds || 25 * 60);
    lockinSoundEnabled = saved.soundEnabled !== false;

    if (saved.running && saved.expectedEndTime) {
      lockinExpectedEndTime = Number(saved.expectedEndTime);
      lockinRunning = true;
      lockinRemainingSeconds = Math.max(
        0,
        Math.ceil((lockinExpectedEndTime - Date.now()) / 1000)
      );

      if (lockinRemainingSeconds > 0) {
        document.body.classList.add('focus-mode');
        startLockinTicker();
      } else {
        finishLockinTimer();
      }
    } else {
      lockinRunning = false;
      lockinExpectedEndTime = null;
      lockinRemainingSeconds = Number(saved.remainingSeconds || lockinInitialSeconds);
    }
  } catch {
    lockinInitialSeconds = 25 * 60;
    lockinRemainingSeconds = lockinInitialSeconds;
  }
}

function setLockinDuration(minutes) {
  const safe = Math.min(Math.max(Number(minutes) || 25, 1), 180);
  lockinInitialSeconds = safe * 60;

  if (!lockinRunning) {
    lockinRemainingSeconds = lockinInitialSeconds;
    lockinExpectedEndTime = null;
    renderLockinTimer();
    persistLockinState();
  }
}

function renderLockinTimer() {
  if (lockinRunning && lockinExpectedEndTime) {
    lockinRemainingSeconds = Math.max(
      0,
      Math.ceil((lockinExpectedEndTime - Date.now()) / 1000)
    );
  }

  const minutes = Math.floor(lockinRemainingSeconds / 60);
  const seconds = lockinRemainingSeconds % 60;
  elements.lockinTime.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (elements.lockinSoundBtn) {
    elements.lockinSoundBtn.textContent = lockinSoundEnabled
      ? 'Sound On'
      : 'Sound Off';
  }
}

function unlockLockinAudio() {
  if (!lockinSoundEnabled || lockinAudioContext) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  lockinAudioContext = new AudioContext();

  if (lockinAudioContext.state === 'suspended') {
    lockinAudioContext.resume().catch(() => {});
  }
}

function playLockinFinishedSound() {
  if (!lockinSoundEnabled) return;

  try {
    unlockLockinAudio();
    if (!lockinAudioContext) return;

    const now = lockinAudioContext.currentTime;
    const motif = [0, 0.18, 0.36];
    const repetitions = 3;
    const repeatGap = 0.85;

    for (let repeat = 0; repeat < repetitions; repeat += 1) {
      const baseOffset = repeat * repeatGap;

      motif.forEach((offset, index) => {
        const oscillator = lockinAudioContext.createOscillator();
        const gain = lockinAudioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = index === 1 ? 740 : 560;

        const startAt = now + baseOffset + offset;
        const endAt = startAt + 0.16;

        gain.gain.setValueAtTime(0.001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, endAt);

        oscillator.connect(gain);
        gain.connect(lockinAudioContext.destination);

        oscillator.start(startAt);
        oscillator.stop(endAt);
      });
    }
  } catch (error) {
    console.warn('[Pomodoro] Som bloqueado:', error);
    showToast('Focus block complete. Audio blocked by browser.');
  }
}


function startLockinTicker() {
  window.clearInterval(lockinInterval);

  lockinInterval = window.setInterval(() => {
    renderLockinTimer();

    if (lockinRemainingSeconds <= 0) {
      finishLockinTimer();
    }
  }, 500);
}

function startLockinTimer() {
  unlockLockinAudio();

  if (lockinRunning) return;

  lockinRunning = true;
  lockinStartedAt = lockinStartedAt || new Date().toISOString();
  lockinExpectedEndTime = Date.now() + lockinRemainingSeconds * 1000;
  document.body.classList.add('focus-mode');

  persistLockinState();
  startLockinTicker();
  renderLockinTimer();
}

function pauseLockinTimer() {
  renderLockinTimer();

  lockinRunning = false;
  lockinExpectedEndTime = null;
  document.body.classList.remove('focus-mode');
  window.clearInterval(lockinInterval);
  lockinInterval = null;
  persistLockinState();
}

function resetLockinTimer() {
  lockinRunning = false;
  lockinExpectedEndTime = null;
  lockinStartedAt = null;
  lockinRemainingSeconds = lockinInitialSeconds;
  document.body.classList.remove('focus-mode');
  window.clearInterval(lockinInterval);
  lockinInterval = null;
  renderLockinTimer();
  persistLockinState();
}

function finishLockinTimer() {
  const startedAt = lockinStartedAt || new Date(Date.now() - lockinInitialSeconds * 1000).toISOString();
  const endedAt = new Date().toISOString();
  const durationMinutes = Math.max(1, Math.round(lockinInitialSeconds / 60));

  lockinRunning = false;
  lockinExpectedEndTime = null;
  lockinStartedAt = null;
  lockinRemainingSeconds = 0;
  document.body.classList.remove('focus-mode');
  window.clearInterval(lockinInterval);
  lockinInterval = null;
  renderLockinTimer();
  persistLockinState();
  playLockinFinishedSound();

  api('/focus-sessions', {
    method: 'POST',
    body: JSON.stringify({
      data_ref: state.selectedDate || new Date().toISOString().slice(0, 10),
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      label: 'Pomodoro',
      mark_focus_habit: false,
    }),
  })
    .then(async () => {
      showToast('Focus block complete. Sessão registrada.');
      await loadDay(state.selectedDate);
    })
    .catch((error) => {
      console.warn('[Pomodoro] Falha ao registrar sessão:', error);
      showToast('Focus block complete. Registro falhou.');
    });
}


function shiftMonth(delta) {
  const [year, month] = state.currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  state.currentMonth = toISODate(date).slice(0, 7);
  state.shouldAutoScrollHabitMatrix = true;
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
    state.shouldAutoScrollHabitMatrix = true;
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

    const habitMobileMenuButton = event.target.closest('.habit-mobile-menu-btn');
    const moveUpButton = event.target.closest('.move-habit-up');
    const moveDownButton = event.target.closest('.move-habit-down');
    const editHabitBtn = event.target.closest('.edit-habit-inline');
    const archiveHabitButton = event.target.closest('.archive-habit-inline');

    if (habitMobileMenuButton) {
      openHabitMobileMenu(Number(habitMobileMenuButton.dataset.habitMobileMenuId));
      return;
    }

    if (moveUpButton) {
      await moveHabitByStep(Number(moveUpButton.dataset.habitId), -1);
      return;
    }

    if (moveDownButton) {
      await moveHabitByStep(Number(moveDownButton.dataset.habitId), 1);
      return;
    }

    if (archiveHabitButton) {
      archiveHabit(Number(archiveHabitButton.dataset.habitId));
      return;
    }

    if (editHabitBtn) {
      openHabitModal(getHabitById(editHabitBtn.dataset.habitId));
      return;
    }

    const deleteHabitBtn = event.target.closest('.delete-habit-inline');
    if (deleteHabitBtn) {
      deleteHabit(deleteHabitBtn.dataset.habitId);
    }
  });

  elements.habitMatrix.addEventListener('dragstart', handleHabitDragStart);
  elements.habitMatrix.addEventListener('dragover', handleHabitDragOver);
  elements.habitMatrix.addEventListener('drop', handleHabitDrop);
  elements.habitMatrix.addEventListener('dragend', handleHabitDragEnd);

  document.addEventListener('click', async (event) => {
    const habitSheetAction = event.target.closest('[data-habit-action]');
    if (habitSheetAction) {
      const habitId = Number(habitSheetAction.dataset.habitId);
      const action = habitSheetAction.dataset.habitAction;

      closeModal();

      if (action === 'edit') {
        openHabitModal(getHabitById(habitId));
        return;
      }

      if (action === 'archive') {
        archiveHabit(habitId);
        return;
      }

      if (action === 'delete') {
        deleteHabit(habitId);
        return;
      }

      if (action === 'up') {
        await moveHabitByStep(habitId, -1);
        return;
      }

      if (action === 'down') {
        await moveHabitByStep(habitId, 1);
        return;
      }
    }

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
  elements.reviewTypeButtons.forEach((button) => {
    button.addEventListener('click', () => setReviewType(button.dataset.reviewType));
  });
  elements.reviewDateInput?.addEventListener('change', () => {
    state.reviewExport.selectedDate = elements.reviewDateInput.value || state.selectedDate;
    state.reviewExport.selectedMonth = state.reviewExport.selectedDate.slice(0, 7);
    state.reviewExport.payload = null;
    state.currentReview = null;
    updateReviewPeriodHelp();
    loadReviewPreview();
  });
  elements.reviewMonthInput?.addEventListener('change', () => {
    state.reviewExport.selectedMonth = elements.reviewMonthInput.value || state.currentMonth;
    state.reviewExport.selectedDate = `${state.reviewExport.selectedMonth}-01`;
    state.reviewExport.payload = null;
    state.currentReview = null;
    updateReviewPeriodHelp();
    loadReviewPreview();
  });
  elements.reviewQuickButtons.forEach((button) => {
    button.addEventListener('click', () => applyReviewQuickAction(button.dataset.reviewQuick));
  });
  elements.reviewPrevPeriodBtn?.addEventListener('click', () => shiftReviewPeriod(-1));
  elements.reviewCurrentPeriodBtn?.addEventListener('click', setReviewCurrentPeriod);
  elements.reviewNextPeriodBtn?.addEventListener('click', () => shiftReviewPeriod(1));
  elements.reviewCopyMarkdownBtn?.addEventListener('click', copyReviewMarkdown);
  elements.reviewDownloadMarkdownBtn?.addEventListener('click', downloadReviewMarkdown);


  elements.backupBtn.addEventListener('click', downloadBackup);
  elements.sidebarBackupBtn.addEventListener('click', downloadBackup);
  elements.restoreDbBtn.addEventListener('click', () =>
    elements.restoreDbInput.click()
  );
  elements.restoreDbInput.addEventListener('change', () =>
    restoreDatabase(elements.restoreDbInput.files?.[0])
  );
  elements.runAutoBackupBtn?.addEventListener('click', runAutoBackupNow);
  elements.refreshDataDoctorBtn?.addEventListener('click', async () => {
    await Promise.allSettled([loadBackupStatus(), loadDataDoctor(), loadArchivedHabits()]);
    showToast('Status atualizado.');
  });
  elements.refreshDataDoctorBtn?.addEventListener('click', () => {
    loadBackupStatus();
    loadDataDoctor();
    loadArchivedHabits();
  });
  elements.copyWeeklyReviewBtn?.addEventListener('click', copyWeeklyReviewMarkdown);
  elements.downloadWeeklyReviewBtn?.addEventListener('click', downloadWeeklyReviewMarkdown);
  elements.closeDayBtn?.addEventListener('click', closeDay);
  elements.copyEndDayBtn?.addEventListener('click', copyEndDayMarkdown);
  elements.downloadEndDayBtn?.addEventListener('click', downloadEndDayMarkdown);
  elements.archivedHabitsBox?.addEventListener('click', (event) => {
    const button = event.target.closest('.restore-archived-habit');
    if (!button) return;
    restoreArchivedHabit(Number(button.dataset.habitId));
  });


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
  elements.lockinSoundBtn?.addEventListener('click', () => {
    lockinSoundEnabled = !lockinSoundEnabled;
    localStorage.setItem('quietProgress.lockin.sound', String(lockinSoundEnabled));
    unlockLockinAudio();
    renderLockinTimer();
    persistLockinState();
  });

  document.addEventListener('click', unlockLockinAudio, { once: true });
  document.addEventListener('touchstart', unlockLockinAudio, { once: true });
}

async function init() {
  updateTemporalHeader();
  attachEvents();
  restoreLockinState();
  renderLockinTimer();

  elements.monthPicker.value = state.currentMonth;
  elements.journalMonthFilter.value = state.currentMonth;
  state.reviewExport.selectedDate = state.selectedDate;
  state.reviewExport.selectedMonth = state.currentMonth;
  updateReviewInputs();

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

  renderLockinTimer();

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



/* ============================================================
   PWA / WEB PUSH / REMINDERS
   Quiet Progress Sprint 2/3
   ============================================================ */

let qpServiceWorkerRegistration = null;
let qpPushSubscription = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function qpPushElements() {
  return {
    pwaInstallStatus: document.getElementById('pwaInstallStatus'),
    permissionStatus: document.getElementById('notificationPermissionStatus'),
    secureContextStatus: document.getElementById('secureContextStatus'),
    pushWarning: document.getElementById('pushWarning'),
    enableBtn: document.getElementById('enableNotificationsBtn'),
    testBtn: document.getElementById('testNotificationBtn'),
    reminderForm: document.getElementById('reminderForm'),
    reminderId: document.getElementById('reminderIdInput'),
    title: document.getElementById('reminderTitleInput'),
    message: document.getElementById('reminderMessageInput'),
    type: document.getElementById('reminderTypeInput'),
    time: document.getElementById('reminderTimeInput'),
    route: document.getElementById('reminderRouteInput'),
    enabled: document.getElementById('reminderEnabledInput'),
    weekdays: document.getElementById('reminderWeekdays'),
    resetBtn: document.getElementById('resetReminderFormBtn'),
    list: document.getElementById('remindersList'),
  };
}

function setPushWarning(message) {
  const { pushWarning } = qpPushElements();
  if (!pushWarning) return;

  pushWarning.hidden = !message;
  pushWarning.textContent = message || '';
}

function updatePwaStatus() {
  const els = qpPushElements();

  if (els.pwaInstallStatus) {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    els.pwaInstallStatus.textContent = standalone ? 'Instalado / standalone' : 'Navegador';
  }

  if (els.permissionStatus) {
    els.permissionStatus.textContent =
      'Notification' in window ? Notification.permission : 'Indisponível';
  }

  if (els.secureContextStatus) {
    els.secureContextStatus.textContent = window.isSecureContext
      ? 'Seguro'
      : 'Requer HTTPS';
  }

  if (!window.isSecureContext) {
    setPushWarning(
      'Web Push em Android exige HTTPS ou localhost. Pela LAN em HTTP, o PWA pode abrir, mas notificações push não funcionam até usar HTTPS/Cloudflare Tunnel.'
    );
  } else {
    setPushWarning('');
  }
}

async function registerQuietProgressServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    setPushWarning('Este navegador não suporta Service Worker.');
    return null;
  }

  try {
    qpServiceWorkerRegistration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });

    await navigator.serviceWorker.ready;
    updatePwaStatus();

    return qpServiceWorkerRegistration;
  } catch (error) {
    console.warn('[PWA] Falha ao registrar service worker:', error);
    setPushWarning('Falha ao registrar Service Worker. Confira HTTPS e console.');
    return null;
  }
}

async function enablePushNotifications() {
  const els = qpPushElements();

  if (!('Notification' in window) || !('PushManager' in window)) {
    setPushWarning('Este navegador não suporta Web Push.');
    return;
  }

  if (!window.isSecureContext) {
    updatePwaStatus();
    return;
  }

  const registration =
    qpServiceWorkerRegistration || (await registerQuietProgressServiceWorker());

  if (!registration) return;

  const keyPayload = await api('/push/vapid-public-key');

  if (!keyPayload.configured || !keyPayload.publicKey) {
    setPushWarning('VAPID keys não configuradas no servidor. Rode npm run generate:vapid e atualize o .env.');
    return;
  }

  const permission = await Notification.requestPermission();
  updatePwaStatus();

  if (permission !== 'granted') {
    setPushWarning('Permissão de notificação não concedida.');
    return;
  }

  qpPushSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
  });

  await api('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(qpPushSubscription),
  });

  if (els.enableBtn) els.enableBtn.textContent = 'Notificações ativas';
  setPushWarning('');
  showToast('Notificações ativadas.');
  updatePwaStatus();
}

async function sendTestPushNotification() {
  const result = await api('/push/test', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (result.skipped) {
    setPushWarning(result.reason || 'Push não configurado no servidor.');
    return;
  }

  showToast(`Teste enviado: ${result.sent} ok / ${result.failed} falhas.`);
}

function getReminderWeekdaysFromForm() {
  const { weekdays } = qpPushElements();

  if (!weekdays) return [0, 1, 2, 3, 4, 5, 6];

  return Array.from(weekdays.querySelectorAll('input[type="checkbox"]:checked')).map((input) =>
    Number(input.value)
  );
}

function setReminderWeekdays(days) {
  const { weekdays } = qpPushElements();
  const selected = new Set((days || []).map(Number));

  if (!weekdays) return;

  weekdays.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = selected.has(Number(input.value));
  });
}

function resetReminderForm() {
  const els = qpPushElements();

  if (!els.reminderForm) return;

  els.reminderId.value = '';
  els.title.value = 'Check-in diário';
  els.message.value = 'Hora de registrar energia, foco, motivação, humor e nota do dia.';
  els.type.value = 'daily_checkin';
  els.time.value = '21:30';
  els.route.value = '/?view=tracker';
  els.enabled.checked = true;
  setReminderWeekdays([0, 1, 2, 3, 4, 5, 6]);
}

async function loadReminders() {
  const els = qpPushElements();
  if (!els.list) return;

  const payload = await api('/reminders');

  els.list.innerHTML = payload.items.length
    ? payload.items.map(renderReminderItem).join('')
    : '<div class="empty-state">Nenhum lembrete configurado.</div>';
}

function renderReminderItem(reminder) {
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const days = reminder.days_of_week.map((day) => dayLabels[day]).join(', ');

  return `
    <article class="reminder-item" data-reminder-id="${reminder.id}">
      <div>
        <strong>${escapeHTML(reminder.title)}</strong>
        <p>${escapeHTML(reminder.message)}</p>
        <span>${escapeHTML(reminder.time)} · ${escapeHTML(days)} · ${escapeHTML(reminder.type)}</span>
      </div>
      <div class="reminder-actions">
        <button class="row-link edit-reminder" type="button" data-reminder-id="${reminder.id}">Editar</button>
        <button class="row-link danger delete-reminder" type="button" data-reminder-id="${reminder.id}">Excluir</button>
      </div>
    </article>
  `;
}

async function saveReminderFromForm(event) {
  event.preventDefault();

  const els = qpPushElements();
  const id = els.reminderId.value;

  const payload = {
    title: els.title.value,
    message: els.message.value,
    type: els.type.value,
    time: els.time.value,
    route: els.route.value || '/',
    enabled: els.enabled.checked,
    days_of_week: getReminderWeekdaysFromForm(),
  };

  if (!payload.title.trim() || !payload.message.trim()) {
    showToast('Título e mensagem são obrigatórios.');
    return;
  }

  if (id) {
    await api(`/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    showToast('Lembrete atualizado.');
  } else {
    await api('/reminders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Lembrete criado.');
  }

  resetReminderForm();
  await loadReminders();
}

async function fillReminderForm(id) {
  const payload = await api('/reminders');
  const reminder = payload.items.find((item) => Number(item.id) === Number(id));
  const els = qpPushElements();

  if (!reminder || !els.reminderForm) return;

  els.reminderId.value = reminder.id;
  els.title.value = reminder.title;
  els.message.value = reminder.message;
  els.type.value = reminder.type;
  els.time.value = reminder.time;
  els.route.value = reminder.route || '/';
  els.enabled.checked = Boolean(reminder.enabled);
  setReminderWeekdays(reminder.days_of_week);
  els.title.focus();
}

async function deleteReminder(id) {
  await api(`/reminders/${id}`, {
    method: 'DELETE',
  });

  showToast('Lembrete removido.');
  await loadReminders();
}

function bindPwaPushUi() {
  const els = qpPushElements();

  if (!els.enableBtn || els.enableBtn.dataset.bound === 'true') return;

  els.enableBtn.dataset.bound = 'true';
  els.enableBtn.addEventListener('click', () => {
    enablePushNotifications().catch((error) => {
      console.error('[PUSH] Erro ao ativar notificações:', error);
      setPushWarning(error.message || 'Erro ao ativar notificações.');
    });
  });

  els.testBtn?.addEventListener('click', () => {
    sendTestPushNotification().catch((error) => {
      console.error('[PUSH] Erro ao enviar teste:', error);
      setPushWarning(error.message || 'Erro ao enviar teste.');
    });
  });

  els.reminderForm?.addEventListener('submit', (event) => {
    saveReminderFromForm(event).catch((error) => {
      console.error('[PUSH] Erro ao salvar lembrete:', error);
      showToast(error.message || 'Erro ao salvar lembrete.');
    });
  });

  els.resetBtn?.addEventListener('click', resetReminderForm);

  els.list?.addEventListener('click', (event) => {
    const editButton = event.target.closest('.edit-reminder');
    const deleteButton = event.target.closest('.delete-reminder');

    if (editButton) {
      fillReminderForm(editButton.dataset.reminderId).catch((error) => {
        showToast(error.message || 'Erro ao editar lembrete.');
      });
      return;
    }

    if (deleteButton) {
      deleteReminder(deleteButton.dataset.reminderId).catch((error) => {
        showToast(error.message || 'Erro ao excluir lembrete.');
      });
    }
  });
}

async function initPwaPush() {
  bindPwaPushUi();
  updatePwaStatus();
  resetReminderForm();

  await registerQuietProgressServiceWorker();

  try {
    if (qpServiceWorkerRegistration?.pushManager) {
      qpPushSubscription = await qpServiceWorkerRegistration.pushManager.getSubscription();

      if (qpPushSubscription && qpPushElements().enableBtn) {
        qpPushElements().enableBtn.textContent = 'Notificações ativas';
      }
    }
  } catch (error) {
    console.warn('[PWA] Não foi possível ler subscription atual:', error);
  }

  try {
    await loadReminders();
  } catch (error) {
    console.warn('[PUSH] Não foi possível carregar lembretes:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPwaPush().catch((error) => {
    console.warn('[PWA] Inicialização falhou:', error);
  });
});
