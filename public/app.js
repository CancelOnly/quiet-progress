const API_BASE = '/api';

let progressChartInstance = null;
let habitsChartInstance = null;
let mindsetChartInstance = null;
let estatisticasLoaded = false;

let lockinInitialSeconds = 25 * 60;
let lockinRemainingSeconds = lockinInitialSeconds;
let lockinInterval = null;
let lockinRunning = false;

const state = {
  dashboard: null,
  route: 'cockpit',
};

const paginationState = {
  journal: {
    page: 1,
    limit: 20,
    hasMore: false,
    loading: false,
  },
  taskHistory: {
    page: 1,
    limit: 20,
    hasMore: false,
    loading: false,
  },
};

const routes = {
  cockpit: document.getElementById('view-cockpit'),
  habits: document.getElementById('view-habits'),
  tasks: document.getElementById('view-tasks'),
  stats: document.getElementById('view-stats'),
};

const elements = {
  navItems: Array.from(document.querySelectorAll('.nav-item')),
  apiStatus: document.getElementById('apiStatus'),
  progressFill: document.getElementById('progressFill'),
  progressPercent: document.getElementById('progressPercent'),
  progressMeta: document.getElementById('progressMeta'),
  stateChip: document.getElementById('stateChip'),
  doneCount: document.getElementById('doneCount'),
  remainingCount: document.getElementById('remainingCount'),
  focusState: document.getElementById('focusState'),
  todayHighlights: document.getElementById('todayHighlights'),
  habitList: document.getElementById('habitList'),
  taskList: document.getElementById('taskList'),
  mindsetGrid: document.getElementById('mindsetGrid'),
  habitCountChip: document.getElementById('habitCountChip'),
  taskCountChip: document.getElementById('taskCountChip'),
  taskForm: document.getElementById('taskForm'),
  taskTitleInput: document.getElementById('taskTitleInput'),
  taskPriorityInput: document.getElementById('taskPriorityInput'),
  heatmapGrid: document.getElementById('heatmapGrid'),
  progressChart: document.getElementById('progressChart'),
  habitsChart: document.getElementById('habitsChart'),
  mindsetChart: document.getElementById('mindsetChart'),
  toast: document.getElementById('toast'),
  backupBtn: document.getElementById('backupBtn'),
  lockinTime: document.getElementById('lockinTime'),
  lockinStartBtn: document.getElementById('lockinStartBtn'),
  lockinPauseBtn: document.getElementById('lockinPauseBtn'),
  lockinResetBtn: document.getElementById('lockinResetBtn'),
  habitForm: document.getElementById('habitForm'),
  habitTitleInput: document.getElementById('habitTitleInput'),
  mindsetNotes: document.getElementById('mindsetNotes'),
  journalFeed: document.getElementById('journal-feed'),
  reloadJournalBtn: document.getElementById('reloadJournalBtn'),
  weeklyTracker: document.getElementById('weekly-tracker'),
  saveJournalBtn: document.getElementById('saveJournalBtn'),
  taskHistoryBtn: document.getElementById('taskHistoryBtn'),
  taskHistoryList: document.getElementById('taskHistoryList'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  modalInputWrap: document.getElementById('modalInputWrap'),
  modalInput: document.getElementById('modalInput'),
  modalCancelBtn: document.getElementById('modalCancelBtn'),
  modalConfirmBtn: document.getElementById('modalConfirmBtn'),
  restoreDbBtn: document.getElementById('restoreDbBtn'),
  restoreDbInput: document.getElementById('restoreDbInput'),
  lockinPresetButtons: Array.from(document.querySelectorAll('.lockin-preset')),
  lockinCustomWrap: document.getElementById('lockinCustomWrap'),
  lockinCustomInput: document.getElementById('lockinCustomInput'),
  cockpitTitle: document.getElementById('cockpitTitle'),
  tasksTitle: document.getElementById('tasksTitle'),
  exportObsidianBtn: document.getElementById('exportObsidianBtn'),
};

function formatLockinTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderLockinTimer() {
  if (!elements.lockinTime) return;

  elements.lockinTime.textContent = formatLockinTime(lockinRemainingSeconds);
  document.body.classList.toggle('focus-mode', lockinRunning);
}

function startLockinTimer() {
  if (lockinRunning) return;

  lockinRunning = true;
  renderLockinTimer();

  lockinInterval = window.setInterval(() => {
    lockinRemainingSeconds -= 1;

    if (lockinRemainingSeconds <= 0) {
      lockinRemainingSeconds = 0;
      pauseLockinTimer();
      showToast('Lock In finalizado. Respira e registra o próximo passo.');
    }

    renderLockinTimer();
  }, 1000);
}

function pauseLockinTimer() {
  lockinRunning = false;

  if (lockinInterval) {
    window.clearInterval(lockinInterval);
    lockinInterval = null;
  }

  renderLockinTimer();
}

function resetLockinTimer() {
  pauseLockinTimer();
  lockinRemainingSeconds = lockinInitialSeconds;
  renderLockinTimer();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');

  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 1800);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
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

function navigateTo(routeName) {
  state.route = routeName;

  Object.entries(routes).forEach(([name, view]) => {
    view.classList.toggle('active-view', name === routeName);
  });

  elements.navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.route === routeName);
  });

  if (routeName === 'stats') {
    loadEstatisticas();
  }

  if (routeName === 'cockpit' || routeName === 'habits') {
    loadJournalHistory();
  }
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function priorityClass(priority) {
  const normalized = String(priority).toUpperCase();

  if (normalized === 'ALTA') return 'high';
  if (normalized === 'BAIXA') return 'low';
  return 'medium';
}

function updateProgress(resumo) {
  const percent = resumo?.porcentagem || 0;
  const total = resumo?.totalItens || 0;
  const done = resumo?.totalConcluidos || 0;
  const remaining = resumo?.restantes || 0;

  elements.progressFill.style.width = `${percent}%`;
  elements.progressPercent.textContent = percent;
  elements.progressMeta.textContent = `${done} de ${total} sistemas concluídos`;
  elements.doneCount.textContent = done;
  elements.remainingCount.textContent = remaining;
  elements.progressFill.classList.toggle(
    'complete',
    percent === 100 && total > 0
  );

  if (percent === 100 && total > 0) {
    elements.stateChip.textContent = 'CLEAR';
    elements.focusState.textContent = 'Locked';
  } else if (percent >= 65) {
    elements.stateChip.textContent = 'FLOW';
    elements.focusState.textContent = 'Warm';
  } else if (percent >= 30) {
    elements.stateChip.textContent = 'SYNC';
    elements.focusState.textContent = 'Boot';
  } else {
    elements.stateChip.textContent = 'INIT';
    elements.focusState.textContent = 'Cold';
  }
}

async function addHabit(titulo) {
  const cleanTitle = String(titulo || '').trim();

  if (!cleanTitle) {
    showToast('Digite um nome para o hábito.');
    return;
  }

  try {
    const payload = await request('/habitos', {
      method: 'POST',
      body: JSON.stringify({
        titulo: cleanTitle,
        subtitulo: 'Hábito personalizado.',
      }),
    });

    elements.habitTitleInput.value = '';
    renderDashboard(payload.dashboard);
    showToast('Hábito criado.');
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteHabit(id, itemElement) {
  showConfirmModal(
    'Tem certeza que deseja excluir? Isso apagará todo o histórico associado.',
    async () => {
      try {
        itemElement.classList.add('removing');

        const payload = await request(`/habitos/${id}`, {
          method: 'DELETE',
        });

        window.setTimeout(() => {
          renderDashboard(payload.dashboard);
          showToast('Hábito removido.');
        }, 220);
      } catch (error) {
        itemElement.classList.remove('removing');
        showToast(error.message);
      }
    }
  );
}

function renderTasks(tarefas) {
  elements.taskCountChip.textContent = `${tarefas.length} Ops`;

  if (!tarefas.length) {
    elements.taskList.innerHTML = `<li class="empty-state">Nenhuma tarefa cadastrada para hoje.</li>`;
    return;
  }

  elements.taskList.innerHTML = tarefas
    .map((task) => {
      const done = task.status === 'CONCLUIDO';

      return `
  <li class="task-item ${done ? 'done' : ''}" data-task-id="${task.id}">
    <label class="custom-check">
      <input type="checkbox" class="task-check" ${done ? 'checked' : ''} />
      <span class="box"></span>
    </label>

    <div class="item-main">
      <div class="item-title">${escapeHTML(task.titulo)}</div>
      <div class="item-subtitle">Criada em ${escapeHTML(task.data_criacao)} · Status: ${escapeHTML(task.status)}</div>
    </div>

    <span class="priority ${priorityClass(task.prioridade)}">${escapeHTML(task.prioridade)}</span>

    <div class="task-actions">
      <button class="status-btn" type="button">${done ? 'Done' : 'Start'}</button>
      <button class="edit-task-btn" type="button" aria-label="Editar tarefa">✎</button>
      <button class="delete-task-btn" type="button" aria-label="Excluir tarefa">×</button>
    </div>
  </li>
`;
    })
    .join('');

  elements.taskList.querySelectorAll('.task-check').forEach((checkbox) => {
    checkbox.addEventListener('change', async (event) => {
      const item = event.target.closest('.task-item');
      const taskId = Number(item.dataset.taskId);

      item.classList.toggle('done', event.target.checked);

      try {
        const payload = await request(`/tarefas/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ action: 'toggle' }),
        });

        renderDashboard(payload.dashboard);
      } catch (error) {
        event.target.checked = !event.target.checked;
        item.classList.toggle('done', event.target.checked);
        showToast(error.message);
      }
    });
  });

  elements.taskList.querySelectorAll('.status-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const checkbox = button
        .closest('.task-item')
        .querySelector('.task-check');
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  elements.taskList.querySelectorAll('.edit-task-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();

      const item = button.closest('.task-item');
      const taskId = Number(item.dataset.taskId);
      const title = item.querySelector('.item-title')?.textContent || '';

      await editTask(taskId, title);
    });
  });

  elements.taskList.querySelectorAll('.delete-task-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();

      const item = button.closest('.task-item');
      const taskId = Number(item.dataset.taskId);

      await deleteTask(taskId, item);
    });
  });
}

function getDarkChartOptions(extraOptions = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 650,
      easing: 'easeOutQuart',
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: '#A2A7B4',
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            family: 'Inter',
            size: 11,
            weight: '800',
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 10, 0.94)',
        titleColor: '#F5F7FA',
        bodyColor: '#A2A7B4',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      x: {
        display: true,
        ticks: {
          color: '#777B86',
          maxRotation: 0,
          autoSkip: true,
          font: {
            family: 'Inter',
            size: 10,
            weight: '700',
          },
        },
        grid: {
          display: false,
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        display: true,
        ticks: {
          color: '#777B86',
          font: {
            family: 'Inter',
            size: 10,
            weight: '700',
          },
        },
        grid: {
          display: false,
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
    },
    ...extraOptions,
  };
}

function renderProgressChart(heatmapData) {
  if (!elements.progressChart || typeof Chart === 'undefined') return;

  const ctx = elements.progressChart.getContext('2d');

  const labels = heatmapData.map((item) => {
    const [, month, day] = item.data.split('-');
    return `${day}/${month}`;
  });

  const values = heatmapData.map((item) => Number(item.totalConcluido || 0));

  if (progressChartInstance) {
    progressChartInstance.destroy();
  }

  progressChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Itens concluídos',
          data: values,
          fill: true,
          borderColor: '#DEFF9A',
          backgroundColor: 'rgba(222, 255, 154, 0.10)',
          pointBackgroundColor: '#DEFF9A',
          pointBorderColor: '#000000',
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 3,
          tension: 0.4,
        },
      ],
    },
    options: getDarkChartOptions({
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#A2A7B4',
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              family: 'Inter',
              size: 11,
              weight: '800',
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(10, 10, 10, 0.94)',
          titleColor: '#F5F7FA',
          bodyColor: '#A2A7B4',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
        },
      },
      scales: {
        x: {
          display: true,
          ticks: {
            color: '#777B86',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            font: {
              family: 'Inter',
              size: 10,
              weight: '700',
            },
          },
          grid: {
            display: false,
            drawBorder: false,
          },
          border: {
            display: false,
          },
        },
        y: {
          display: true,
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: '#777B86',
            font: {
              family: 'Inter',
              size: 10,
              weight: '700',
            },
          },
          grid: {
            display: false,
            drawBorder: false,
          },
          border: {
            display: false,
          },
        },
      },
    }),
  });
}

function renderHabits(habitos) {
  elements.habitCountChip.textContent = `${habitos.length} Core`;

  elements.habitList.innerHTML = habitos
    .map(
      (habit) => `
    <li class="habit-item ${habit.concluido ? 'done' : ''}" data-habit-id="${habit.id}">
      <label class="custom-check">
        <input type="checkbox" class="habit-check" ${habit.concluido ? 'checked' : ''} />
        <span class="box"></span>
      </label>

      <div class="item-main">
        <div class="habit-title-row">
          <div class="item-title">${escapeHTML(habit.titulo)}</div>
          <span class="streak-pill" title="Streak atual">🔥 ${Number(habit.streak || 0)}</span>
        </div>
        <div class="item-subtitle">${escapeHTML(habit.subtitulo)}</div>
      </div>

     <div class="habit-actions">
      <button class="edit-habit-btn" type="button" aria-label="Editar hábito">✎</button>
      <button class="delete-habit-btn" type="button" aria-label="Excluir hábito">×</button>
    </div>
    </li>
  `
    )
    .join('');

  elements.habitList.querySelectorAll('.habit-check').forEach((checkbox) => {
    checkbox.addEventListener('change', async (event) => {
      const item = event.target.closest('.habit-item');
      const habitId = Number(item.dataset.habitId);

      item.classList.toggle('done', event.target.checked);

      try {
        const payload = await request('/habitos/toggle', {
          method: 'POST',
          body: JSON.stringify({ habito_id: habitId }),
        });

        renderDashboard(payload.dashboard);
      } catch (error) {
        event.target.checked = !event.target.checked;
        item.classList.toggle('done', event.target.checked);
        showToast(error.message);
      }
    });
  });

  elements.habitList.querySelectorAll('.edit-habit-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();

      const item = button.closest('.habit-item');
      const habitId = Number(item.dataset.habitId);
      const title = item.querySelector('.item-title')?.textContent || '';

      await editHabit(habitId, title);
    });
  });

  elements.habitList.querySelectorAll('.delete-habit-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();

      const item = button.closest('.habit-item');
      const habitId = Number(item.dataset.habitId);

      await deleteHabit(habitId, item);
    });
  });
}

function renderHabitsChart(rankingData) {
  if (!elements.habitsChart || typeof Chart === 'undefined') return;

  const ctx = elements.habitsChart.getContext('2d');

  const labels = rankingData.map((item) => item.titulo);
  const values = rankingData.map((item) => Number(item.porcentagem || 0));

  const colors = rankingData.map((_, index) => {
    return index % 2 === 0 ? '#11CAA0' : '#BC84EE';
  });

  if (habitsChartInstance) {
    habitsChartInstance.destroy();
  }

  habitsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Taxa de sucesso',
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 0,
          borderRadius: 999,
          barThickness: 16,
          maxBarThickness: 18,
        },
      ],
    },
    options: getDarkChartOptions({
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(10, 10, 10, 0.94)',
          titleColor: '#F5F7FA',
          bodyColor: '#A2A7B4',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => `${context.raw}% de sucesso`,
          },
        },
      },
      scales: {
        x: {
          display: true,
          min: 0,
          max: 100,
          ticks: {
            color: '#777B86',
            callback: (value) => `${value}%`,
            font: {
              family: 'Inter',
              size: 10,
              weight: '700',
            },
          },
          grid: {
            display: false,
            drawBorder: false,
          },
          border: {
            display: false,
          },
        },
        y: {
          display: true,
          ticks: {
            color: '#A2A7B4',
            font: {
              family: 'Inter',
              size: 11,
              weight: '800',
            },
          },
          grid: {
            display: false,
            drawBorder: false,
          },
          border: {
            display: false,
          },
        },
      },
    }),
  });
}

function renderMindset(mindset) {
  const config = [
    { key: 'energia', label: 'Energia', icon: '⚡' },
    { key: 'foco', label: 'Foco', icon: '◎' },
    { key: 'humor', label: 'Humor', icon: '◌' },
  ];

  elements.mindsetGrid.innerHTML = config
    .map((item) => {
      const currentValue = Number(mindset[item.key] || 2);

      return `
      <article class="mind-card" data-stat="${item.key}">
        <div class="mind-label">${item.label} <span>${item.icon}</span></div>
        <div class="mind-value" data-value>${currentValue}</div>
        <div class="mind-buttons">
          ${[1, 2, 3]
            .map(
              (value) => `
            <button class="mind-btn ${value === currentValue ? 'active' : ''}" data-value="${value}" type="button">${value}</button>
          `
            )
            .join('')}
        </div>
      </article>
    `;
    })
    .join('');

  elements.mindsetGrid.querySelectorAll('.mind-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const card = button.closest('.mind-card');
      const stat = card.dataset.stat;
      const value = Number(button.dataset.value);

      const nextMindset = {
        energia: Number(state.dashboard.mindset.energia),
        foco: Number(state.dashboard.mindset.foco),
        humor: Number(state.dashboard.mindset.humor),
        notas: elements.mindsetNotes ? elements.mindsetNotes.value : '',
        [stat]: value,
      };

      try {
        const payload = await request('/mindset', {
          method: 'POST',
          body: JSON.stringify(nextMindset),
        });

        renderDashboard(payload.dashboard);
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  if (elements.mindsetNotes) {
    elements.mindsetNotes.value = mindset.notas || '';
  }
}

async function saveJournal() {
  if (!state.dashboard?.mindset) return;

  const mindset = state.dashboard.mindset;

  try {
    const payload = await request('/mindset', {
      method: 'POST',
      body: JSON.stringify({
        energia: Number(mindset.energia),
        foco: Number(mindset.foco),
        humor: Number(mindset.humor),
        notas: elements.mindsetNotes ? elements.mindsetNotes.value : '',
      }),
    });

    renderDashboard(payload.dashboard);
    showToast('Journal salvo.');
    loadJournalHistory();
  } catch (error) {
    showToast(error.message);
  }
}

function renderHighlights(dashboard) {
  const firstPendingTask = dashboard.tarefas.find(
    (task) => task.status !== 'CONCLUIDO'
  );
  const firstPendingHabit = dashboard.habitos.find((habit) => !habit.concluido);

  const items = [
    {
      icon: '✓',
      kind: 'success',
      title: 'Progresso atual',
      text: `${dashboard.resumo.totalConcluidos} de ${dashboard.resumo.totalItens} itens concluídos hoje.`,
    },
    {
      icon: '↯',
      kind: 'action',
      title: 'Próxima tarefa',
      text: firstPendingTask
        ? firstPendingTask.titulo
        : 'Nenhuma tarefa pendente no momento.',
    },
    {
      icon: '◎',
      kind: 'focus',
      title: 'Próximo hábito',
      text: firstPendingHabit
        ? firstPendingHabit.titulo
        : 'Todos os hábitos padrão estão completos.',
    },
  ];

  elements.todayHighlights.innerHTML = items
    .map(
      (item) => `
    <div class="highlight-item">
      <span class="highlight-icon ${item.kind}">${item.icon}</span>
      <div>
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.text)}</p>
      </div>
    </div>
  `
    )
    .join('');
}

function renderDashboard(dashboard) {
  state.dashboard = dashboard;

  updateProgress(dashboard.resumo);
  renderHighlights(dashboard);
  renderHabits(dashboard.habitos);
  renderTasks(dashboard.tarefas);
  renderMindset(dashboard.mindset);

  elements.apiStatus.textContent = 'DB ONLINE';
}

async function loadDashboard() {
  try {
    elements.apiStatus.textContent = 'SYNCING';
    const dashboard = await request('/dashboard/hoje');
    renderDashboard(dashboard);
  } catch (error) {
    elements.apiStatus.textContent = 'API OFFLINE';
    showToast(`Falha ao conectar no backend: ${error.message}`);
  }
}

async function createTask(event) {
  event.preventDefault();

  const titulo = elements.taskTitleInput.value.trim();
  const prioridade = elements.taskPriorityInput.value;

  if (!titulo) {
    showToast('Digite um título para a tarefa.');
    return;
  }

  try {
    const payload = await request('/tarefas', {
      method: 'POST',
      body: JSON.stringify({ titulo, prioridade }),
    });

    elements.taskTitleInput.value = '';
    renderDashboard(payload.dashboard);
    showToast('Tarefa salva no SQLite.');
  } catch (error) {
    showToast(error.message);
  }
}

let activeModalCallback = null;

function closeModal() {
  if (!elements.modalOverlay) return;

  elements.modalOverlay.setAttribute('hidden', '');
  elements.modalInputWrap?.setAttribute('hidden', '');
  elements.modalInput.value = '';
  activeModalCallback = null;
}

function showConfirmModal(mensagem, callback) {
  if (!elements.modalOverlay) return;

  activeModalCallback = callback;

  elements.modalTitle.textContent = 'Confirmar ação';
  elements.modalMessage.textContent = mensagem;
  elements.modalConfirmBtn.textContent = 'Confirmar';
  elements.modalConfirmBtn.classList.remove('confirm');
  elements.modalConfirmBtn.classList.add('danger');
  elements.modalInputWrap.setAttribute('hidden', '');
  elements.modalInput.value = '';

  elements.modalOverlay.removeAttribute('hidden');
}

function showEditModal({
  title,
  message,
  initialValue = '',
  confirmText = 'Salvar',
  onConfirm,
}) {
  if (!elements.modalOverlay) return;

  activeModalCallback = () => {
    const value = elements.modalInput.value.trim();

    if (!value) {
      showToast('O campo não pode ficar vazio.');
      return false;
    }

    onConfirm(value);
    return true;
  };

  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modalConfirmBtn.textContent = confirmText;
  elements.modalConfirmBtn.classList.remove('danger');
  elements.modalConfirmBtn.classList.add('confirm');

  elements.modalInputWrap.removeAttribute('hidden');
  elements.modalInput.value = initialValue;

  elements.modalOverlay.removeAttribute('hidden');

  window.setTimeout(() => {
    elements.modalInput.focus();
    elements.modalInput.select();
  }, 50);
}

document.addEventListener('DOMContentLoaded', () => {
  elements.navItems.forEach((item) => {
    item.addEventListener('click', () => navigateTo(item.dataset.route));
  });

  injectTemporalAnchors();

  if (elements.exportObsidianBtn) {
    elements.exportObsidianBtn.addEventListener('click', exportTodayToObsidian);
  }

  if (elements.journalFeed) {
    elements.journalFeed.addEventListener('click', (event) => {
      const button = event.target.closest('.journal-download-btn');

      if (!button) return;

      event.stopPropagation();

      const dateISO = button.dataset.exportDate;

      if (!dateISO) {
        showToast('Data inválida para exportação.');
        return;
      }

      exportDateToObsidian(dateISO);
    });
  }

  if (elements.backupBtn) {
    elements.backupBtn.addEventListener('click', () => {
      window.open('/api/backup', '_blank');
    });
  }

  if (elements.lockinStartBtn) {
    elements.lockinStartBtn.addEventListener('click', startLockinTimer);
  }

  if (elements.lockinPauseBtn) {
    elements.lockinPauseBtn.addEventListener('click', pauseLockinTimer);
  }

  if (elements.lockinResetBtn) {
    elements.lockinResetBtn.addEventListener('click', resetLockinTimer);
  }

  if (elements.habitForm) {
    elements.habitForm.addEventListener('submit', (event) => {
      event.preventDefault();
      addHabit(elements.habitTitleInput.value);
    });
  }

  if (elements.saveJournalBtn) {
    elements.saveJournalBtn.addEventListener('click', saveJournal);
  }

  if (elements.taskHistoryBtn) {
    elements.taskHistoryBtn.addEventListener('click', loadTaskHistory);
  }

  if (elements.reloadJournalBtn) {
    elements.reloadJournalBtn.addEventListener('click', loadJournalHistory);
  }

  if (elements.modalCancelBtn) {
    elements.modalCancelBtn.addEventListener('click', closeModal);
  }

  if (elements.modalOverlay) {
    elements.modalOverlay.addEventListener('click', (event) => {
      if (event.target === elements.modalOverlay) {
        closeModal();
      }
    });
  }

  if (elements.modalConfirmBtn) {
    elements.modalConfirmBtn.addEventListener('click', async () => {
      if (!activeModalCallback) {
        closeModal();
        return;
      }

      const shouldClose = await activeModalCallback();

      if (shouldClose !== false) {
        closeModal();
      }
    });
  }
  if (elements.restoreDbBtn && elements.restoreDbInput) {
    elements.restoreDbBtn.addEventListener('click', () => {
      elements.restoreDbInput.click();
    });

    elements.restoreDbInput.addEventListener('change', () => {
      const file = elements.restoreDbInput.files?.[0];

      if (!file) return;

      restoreDatabase(file);
    });
  }
  elements.lockinPresetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      handleLockinPresetClick(button);
    });
  });

  if (elements.lockinCustomInput) {
    elements.lockinCustomInput.addEventListener('change', () => {
      if (lockinRunning) {
        showToast('Pause o Lock In antes de mudar o tempo.');
        return;
      }

      setLockinDuration(elements.lockinCustomInput.value);
    });

    elements.lockinCustomInput.addEventListener('input', () => {
      if (!lockinRunning) {
        setLockinDuration(elements.lockinCustomInput.value);
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      elements.modalOverlay &&
      !elements.modalOverlay.hasAttribute('hidden')
    ) {
      closeModal();
    }
  });

  renderLockinTimer();

  elements.taskForm.addEventListener('submit', createTask);

  navigateTo('cockpit');
  loadDashboard();
  loadJournalHistory();
});

async function loadEstatisticas() {
  try {
    const estatisticas = await request('/estatisticas');

    await renderWeeklyGrid();
    renderHeatmapFromData(estatisticas.heatmap || []);
    renderProgressChart(estatisticas.heatmap || []);
    renderHabitsChart(estatisticas.rankingHabitos || []);
    renderMindsetChart(estatisticas.mindset || []);

    estatisticasLoaded = true;
  } catch (error) {
    showToast(`Erro ao carregar estatísticas: ${error.message}`);
  }
}

function renderHeatmapFromData(heatmap) {
  if (!elements.heatmapGrid) return;

  elements.heatmapGrid.innerHTML = '';

  heatmap.forEach((day) => {
    const cell = document.createElement('span');
    const percent = Number(day.porcentagem || 0);

    cell.title = `${day.data} · ${day.totalConcluido}/${day.totalItens} · ${percent}%`;

    if (percent <= 0) {
      cell.style.background = 'rgba(255,255,255,0.045)';
      cell.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.035)';
    } else if (percent < 100) {
      const opacity = 0.1 + (percent / 100) * 0.28;

      cell.style.background = `rgba(222, 255, 154, ${opacity})`;
      cell.style.boxShadow = '0 0 14px rgba(222, 255, 154, 0.10)';
    } else {
      cell.style.background = '#DEFF9A';
      cell.style.boxShadow = 'var(--glow-success)';
    }

    elements.heatmapGrid.appendChild(cell);
  });
}

function renderMindsetChart(mindset) {
  if (!elements.mindsetChart || typeof Chart === 'undefined') return;

  const ctx = elements.mindsetChart.getContext('2d');

  const labels = mindset.map((item) => {
    const [, month, day] = item.data_registro.split('-');
    return `${day}/${month}`;
  });

  const energia = mindset.map((item) => Number(item.energia));
  const foco = mindset.map((item) => Number(item.foco));
  const humor = mindset.map((item) => Number(item.humor));

  if (mindsetChartInstance) {
    mindsetChartInstance.destroy();
  }

  mindsetChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Energia',
          data: energia,
          borderColor: '#DEFF9A',
          backgroundColor: 'rgba(222, 255, 154, 0.08)',
          pointBackgroundColor: '#DEFF9A',
          pointBorderColor: '#000000',
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 3,
          tension: 0.4,
        },
        {
          label: 'Foco',
          data: foco,
          borderColor: '#BC84EE',
          backgroundColor: 'rgba(188, 132, 238, 0.08)',
          pointBackgroundColor: '#BC84EE',
          pointBorderColor: '#000000',
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 3,
          tension: 0.4,
        },
        {
          label: 'Humor',
          data: humor,
          borderColor: '#11CAA0',
          backgroundColor: 'rgba(17, 202, 160, 0.08)',
          pointBackgroundColor: '#11CAA0',
          pointBorderColor: '#000000',
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 3,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 650,
        easing: 'easeOutQuart',
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#A2A7B4',
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              family: 'Inter',
              size: 11,
              weight: '800',
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(10, 10, 10, 0.94)',
          titleColor: '#F5F7FA',
          bodyColor: '#A2A7B4',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
        },
      },
      scales: {
        x: {
          display: false,
          grid: {
            display: false,
            drawBorder: false,
          },
        },
        y: {
          display: false,
          min: 1,
          max: 3,
          ticks: {
            stepSize: 1,
          },
          grid: {
            display: false,
            drawBorder: false,
          },
        },
      },
    },
  });
}

async function deleteTask(taskId, itemElement) {
  showConfirmModal(
    'Tem certeza que deseja excluir? Isso apagará todo o histórico associado.',
    async () => {
      try {
        itemElement.classList.add('removing');

        await request(`/tarefas/${taskId}`, {
          method: 'DELETE',
        });

        window.setTimeout(() => {
          itemElement.remove();

          if (state.dashboard) {
            state.dashboard.tarefas = state.dashboard.tarefas.filter(
              (task) => Number(task.id) !== Number(taskId)
            );

            recalculateLocalSummary();
            updateProgress(state.dashboard.resumo);
            renderHighlights(state.dashboard);
            elements.taskCountChip.textContent = `${state.dashboard.tarefas.length} Ops`;

            if (!state.dashboard.tarefas.length) {
              elements.taskList.innerHTML = `<li class="empty-state">Nenhuma tarefa cadastrada para hoje.</li>`;
            }
          }

          showToast('Tarefa excluída.');
        }, 220);
      } catch (error) {
        itemElement.classList.remove('removing');
        showToast(error.message);
      }
    }
  );
}

function recalculateLocalSummary() {
  const habitos = state.dashboard?.habitos || [];
  const tarefas = state.dashboard?.tarefas || [];

  const habitosConcluidos = habitos.filter((habit) => habit.concluido).length;
  const tarefasConcluidas = tarefas.filter(
    (task) => task.status === 'CONCLUIDO'
  ).length;

  const totalItens = habitos.length + tarefas.length;
  const totalConcluidos = habitosConcluidos + tarefasConcluidas;

  state.dashboard.resumo = {
    totalItens,
    totalConcluidos,
    restantes: Math.max(totalItens - totalConcluidos, 0),
    habitosConcluidos,
    tarefasConcluidas,
    porcentagem:
      totalItens === 0 ? 0 : Math.round((totalConcluidos / totalItens) * 100),
  };
}

async function loadTaskHistory({ append = false } = {}) {
  if (!elements.taskHistoryList || !elements.taskHistoryBtn) return;

  const pagination = paginationState.taskHistory;
  const isHidden = elements.taskHistoryList.hasAttribute('hidden');

  if (isHidden && !append) {
    elements.taskHistoryList.removeAttribute('hidden');
    elements.taskHistoryBtn.textContent = 'Ocultar Histórico';
  } else if (
    !isHidden &&
    !append &&
    elements.taskHistoryList.dataset.open === 'true'
  ) {
    elements.taskHistoryList.setAttribute('hidden', '');
    elements.taskHistoryBtn.textContent = 'Ver Histórico';
    elements.taskHistoryList.dataset.open = 'false';
    return;
  }

  elements.taskHistoryList.dataset.open = 'true';

  if (pagination.loading) return;

  if (!append) {
    pagination.page = 1;
    elements.taskHistoryList.innerHTML = '';
  }

  pagination.loading = true;

  try {
    const payload = await request(
      `/tarefas/historico?page=${pagination.page}&limit=${pagination.limit}`
    );

    const tarefas = payload.tarefas || [];

    if (!append && !tarefas.length) {
      elements.taskHistoryList.innerHTML = `
        <div class="empty-state">Nenhuma tarefa antiga encontrada.</div>
      `;
      pagination.hasMore = false;
      return;
    }

    const existingLoadMore = elements.taskHistoryList.querySelector(
      '.task-history-load-more'
    );
    if (existingLoadMore) existingLoadMore.remove();

    const html = tarefas
      .map((task) => {
        const done = task.status === 'CONCLUIDO';

        return `
          <div class="history-item ${done ? 'done' : ''}">
            <div class="history-date">${escapeHTML(task.data_criacao)}</div>
            <div class="history-title">${escapeHTML(task.titulo)}</div>
            <div class="history-status">${escapeHTML(task.status)}</div>
          </div>
        `;
      })
      .join('');

    elements.taskHistoryList.insertAdjacentHTML('beforeend', html);

    pagination.hasMore = Boolean(payload.hasMore);
    pagination.page = payload.nextPage || pagination.page;

    if (pagination.hasMore) {
      elements.taskHistoryList.insertAdjacentHTML(
        'beforeend',
        `
        <button class="task-history-load-more load-more-btn" type="button">
          Carregar Mais
        </button>
        `
      );

      elements.taskHistoryList
        .querySelector('.task-history-load-more')
        .addEventListener('click', () => loadTaskHistory({ append: true }));
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    pagination.loading = false;
  }
}

async function loadJournalHistory({ append = false } = {}) {
  if (!elements.journalFeed) return;

  const pagination = paginationState.journal;

  if (pagination.loading) return;

  if (!append) {
    pagination.page = 1;
    elements.journalFeed.innerHTML = '';
  }

  pagination.loading = true;

  try {
    const payload = await request(
      `/mindset/historico?page=${pagination.page}&limit=${pagination.limit}`
    );

    const registros = payload.registros || [];

    if (!append && !registros.length) {
      elements.journalFeed.innerHTML = `
        <div class="journal-empty">Nenhuma reflexão salva ainda.</div>
      `;
      pagination.hasMore = false;
      return;
    }

    const cards = registros
      .map((entry) => {
        const [year, month, day] = entry.data_registro.split('-');
        const formattedDate = `${day}/${month}/${year}`;

        return `
      <article class="journal-card">
        <div class="journal-card-top">
          <div class="journal-date">${escapeHTML(formattedDate)}</div>

          <button
            class="journal-download-btn"
            type="button"
            data-export-date="${escapeHTML(entry.data_registro)}"
            aria-label="Exportar journal de ${escapeHTML(formattedDate)} para Markdown"
          >
            ↓ MD
          </button>
        </div>

        <div class="journal-text">${escapeHTML(entry.notas)}</div>
      </article>
    `;
      })
      .join('');

    const existingLoadMore =
      elements.journalFeed.querySelector('.journal-load-more');

    if (existingLoadMore) {
      existingLoadMore.remove();
    }

    elements.journalFeed.insertAdjacentHTML('beforeend', cards);

    pagination.hasMore = Boolean(payload.hasMore);
    pagination.page = payload.nextPage || pagination.page;

    if (pagination.hasMore) {
      elements.journalFeed.insertAdjacentHTML(
        'beforeend',
        `
    <button class="journal-load-more load-more-btn" type="button">
      Carregar Mais
    </button>
    `
      );

      elements.journalFeed
        .querySelector('.journal-load-more')
        .addEventListener('click', () => loadJournalHistory({ append: true }));
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    pagination.loading = false;
  }
}

async function renderWeeklyGrid() {
  if (!elements.weeklyTracker) return;

  try {
    const payload = await request('/habitos/semana');
    const habitos = payload.habitos || [];
    const datas = payload.datas || [];

    if (!habitos.length) {
      elements.weeklyTracker.innerHTML = `
        <div class="weekly-empty">Nenhum hábito cadastrado.</div>
      `;
      return;
    }

    const dayLabels = datas.map((date) => {
      const parsed = new Date(`${date}T00:00:00`);
      return parsed
        .toLocaleDateString('pt-BR', {
          weekday: 'short',
        })
        .replace('.', '');
    });

    const header = `
      <div class="weekly-row header">
        <div>Hábito</div>
        ${dayLabels
          .map(
            (label) =>
              `<div class="weekly-day-label">${escapeHTML(label)}</div>`
          )
          .join('')}
      </div>
    `;

    const rows = habitos
      .map((habit) => {
        return `
          <div class="weekly-row">
            <div class="weekly-habit-name">${escapeHTML(habit.nome)}</div>
            ${(habit.ultimos7Dias || [])
              .map((done, index) => {
                const date = datas[index] || '';
                const title = `${habit.nome} · ${date} · ${done ? 'concluído' : 'pendente'}`;

                return `
                  <span
                    class="weekly-cell ${done ? 'done' : 'miss'}"
                    title="${escapeHTML(title)}"
                  ></span>
                `;
              })
              .join('')}
          </div>
        `;
      })
      .join('');

    elements.weeklyTracker.innerHTML = header + rows;
  } catch (error) {
    showToast(error.message);
  }
}

async function editTask(taskId, currentTitle) {
  showEditModal({
    title: 'Editar tarefa',
    message: 'Renomeie a tarefa sem perder seu histórico operacional.',
    initialValue: currentTitle,
    confirmText: 'Salvar',
    onConfirm: async (newTitle) => {
      try {
        const payload = await request(`/tarefas/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            titulo: newTitle,
          }),
        });

        renderDashboard(payload.dashboard);
        showToast('Tarefa atualizada.');
      } catch (error) {
        showToast(error.message);
      }
    },
  });
}

async function editHabit(habitId, currentTitle) {
  showEditModal({
    title: 'Editar hábito',
    message: 'Renomeie o hábito mantendo streaks e histórico intactos.',
    initialValue: currentTitle,
    confirmText: 'Salvar',
    onConfirm: async (newTitle) => {
      try {
        const payload = await request(`/habitos/${habitId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            titulo: newTitle,
          }),
        });

        renderDashboard(payload.dashboard);
        showToast('Hábito atualizado.');
      } catch (error) {
        showToast(error.message);
      }
    },
  });
}

async function restoreDatabase(file) {
  if (!file) return;

  showConfirmModal(
    'Restaurar este arquivo irá sobrescrever todos os dados atuais. Faça backup antes de continuar. Deseja prosseguir?',
    async () => {
      try {
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
        window.setTimeout(() => {
          window.location.reload();
        }, 900);
      } catch (error) {
        showToast(error.message);
      } finally {
        elements.restoreDbInput.value = '';
      }
    }
  );
}

function setLockinDuration(minutes) {
  const safeMinutes = Math.min(Math.max(Number(minutes) || 25, 1), 180);

  lockinInitialSeconds = safeMinutes * 60;

  if (!lockinRunning) {
    lockinRemainingSeconds = lockinInitialSeconds;
    renderLockinTimer();
  }
}

function handleLockinPresetClick(button) {
  if (lockinRunning) {
    showToast('Pause o Lock In antes de mudar o tempo.');
    return;
  }

  elements.lockinPresetButtons.forEach((preset) => {
    preset.classList.remove('active');
  });

  button.classList.add('active');

  const isCustom = button.dataset.custom === 'true';

  if (elements.lockinCustomWrap) {
    elements.lockinCustomWrap.toggleAttribute('hidden', !isCustom);
  }

  if (isCustom) {
    const customMinutes = Number(elements.lockinCustomInput?.value || 25);
    setLockinDuration(customMinutes);

    window.setTimeout(() => {
      elements.lockinCustomInput?.focus();
      elements.lockinCustomInput?.select();
    }, 50);

    return;
  }

  setLockinDuration(Number(button.dataset.minutes));
}

function capitalizeFirstLetter(text) {
  if (!text) return '';

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function titleCaseDatePart(text) {
  return String(text)
    .split(' ')
    .map((part) => capitalizeFirstLetter(part))
    .join(' ');
}

function getTodayISOForFile() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getTodayLabelPTBR() {
  const date = new Date();

  const weekday = titleCaseDatePart(
    date.toLocaleDateString('pt-BR', {
      weekday: 'long',
    })
  );

  const day = String(date.getDate()).padStart(2, '0');

  const month = titleCaseDatePart(
    date.toLocaleDateString('pt-BR', {
      month: 'long',
    })
  );

  return `${weekday}, ${day} de ${month}`;
}

function injectTemporalAnchors() {
  const todayLabel = getTodayLabelPTBR();

  if (elements.cockpitTitle) {
    const baseTitle =
      elements.cockpitTitle.dataset.baseTitle || 'Quiet Progress Cockpit';
    elements.cockpitTitle.innerHTML = `
      ${baseTitle}
      <span class="title-date-anchor">${todayLabel}</span>
    `;
  }

  if (elements.tasksTitle) {
    const baseTitle = elements.tasksTitle.dataset.baseTitle || 'Tarefas';
    elements.tasksTitle.innerHTML = `
      ${baseTitle}
      <span class="title-date-anchor">${todayLabel}</span>
    `;
  }
}

function yamlSafe(value) {
  return String(value ?? '')
    .replaceAll('"', '\\"')
    .replaceAll('\n', ' ')
    .trim();
}

function buildObsidianMarkdown() {
  if (!state.dashboard) {
    throw new Error('Dashboard ainda não carregado.');
  }

  const dashboard = state.dashboard;
  const dateISO = getTodayISOForFile();

  const habits = dashboard.habitos || [];
  const tasks = dashboard.tarefas || [];
  const mindset = dashboard.mindset || {};
  const resumo = dashboard.resumo || {};

  const completedHabits = habits.filter((habit) => habit.concluido);
  const completedTasks = tasks.filter((task) => task.status === 'CONCLUIDO');

  const journalText =
    elements.mindsetNotes?.value?.trim() || mindset.notas || '';

  const habitLines = habits.length
    ? habits
        .map((habit) => {
          const checked = habit.concluido ? 'x' : ' ';
          const streak = Number(habit.streak || 0);

          return `- [${checked}] ${habit.titulo}${streak > 0 ? ` 🔥${streak}` : ''}`;
        })
        .join('\n')
    : '- Nenhum hábito cadastrado.';

  const taskLines = tasks.length
    ? tasks
        .map((task) => {
          const checked = task.status === 'CONCLUIDO' ? 'x' : ' ';
          const prioridade = task.prioridade
            ? ` #${task.prioridade.toLowerCase()}`
            : '';

          return `- [${checked}] ${task.titulo}${prioridade}`;
        })
        .join('\n')
    : '- Nenhuma tarefa cadastrada.';

  return `---
type: quiet-progress-daily
date: ${dateISO}
completion: ${Number(resumo.porcentagem || 0)}
completed_items: ${Number(resumo.totalConcluidos || 0)}
total_items: ${Number(resumo.totalItens || 0)}
completed_habits: ${completedHabits.length}
total_habits: ${habits.length}
completed_tasks: ${completedTasks.length}
total_tasks: ${tasks.length}
energia: ${Number(mindset.energia || 0)}
foco: ${Number(mindset.foco || 0)}
humor: ${Number(mindset.humor || 0)}
source: "Quiet Progress"
---

# Quiet Progress — ${dateISO}

## Resumo

- Progresso geral: **${Number(resumo.porcentagem || 0)}%**
- Itens concluídos: **${Number(resumo.totalConcluidos || 0)}/${Number(resumo.totalItens || 0)}**
- Hábitos concluídos: **${completedHabits.length}/${habits.length}**
- Tarefas concluídas: **${completedTasks.length}/${tasks.length}**

## Mindset

- Energia: **${Number(mindset.energia || 0)}/3**
- Foco: **${Number(mindset.foco || 0)}/3**
- Humor: **${Number(mindset.humor || 0)}/3**

## Hábitos

${habitLines}

## Tarefas

${taskLines}

## Journal

${journalText || '_Sem journal registrado._'}
`;
}

function downloadMarkdownFile(filename, content) {
  const blob = new Blob([content], {
    type: 'text/markdown;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportTodayToObsidian() {
  try {
    const dateISO = getTodayISOForFile();
    const markdown = buildObsidianMarkdown();

    downloadMarkdownFile(`${dateISO}-QuietProgress.md`, markdown);
    showToast('Arquivo Markdown exportado.');
  } catch (error) {
    showToast(error.message);
  }
}

async function exportDateToObsidian(dateISO) {
  try {
    const payload = await request(`/exportar/${dateISO}`);

    if (!payload.markdown) {
      throw new Error('Markdown não retornado pelo servidor.');
    }

    downloadMarkdownFile(`${dateISO}-QuietProgress.md`, payload.markdown);
    showToast(`Exportado: ${dateISO}`);
  } catch (error) {
    showToast(error.message);
  }
}
