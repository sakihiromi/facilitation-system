// === State Management ===
const state = {
  userId: localStorage.getItem('userId') || generateUserId(),
  userName: localStorage.getItem('userName') || '',
  priorInfo: localStorage.getItem('priorInfo') || '',
  currentWeek: 1,
  currentSessionId: null,
  completedWeeks: JSON.parse(localStorage.getItem('completedWeeks') || '[]'),
  timerInterval: null,
  sessionStartTime: null,
};

function generateUserId() {
  const id = 'user_' + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('userId', id);
  return id;
}

// === DOM Elements ===
const elements = {
  welcomeScreen: document.getElementById('welcomeScreen'),
  chatScreen: document.getElementById('chatScreen'),
  articleScreen: document.getElementById('articleScreen'),
  loadingOverlay: document.getElementById('loadingOverlay'),

  userName: document.getElementById('userName'),
  priorInfo: document.getElementById('priorInfo'),
  userNameDisplay: document.getElementById('userNameDisplay'),
  startFirstSession: document.getElementById('startFirstSession'),

  weekButtons: document.querySelectorAll('.week-btn'),

  sessionBadge: document.getElementById('sessionBadge'),
  sessionTheme: document.getElementById('sessionTheme'),
  sessionTimer: document.getElementById('sessionTimer'),
  chatMessages: document.getElementById('chatMessages'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  endSessionBtn: document.getElementById('endSessionBtn'),

  articleContent: document.getElementById('articleContent'),
  nextSessionBtn: document.getElementById('nextSessionBtn'),
  backToHome: document.getElementById('backToHome'),
};

// === Initialization ===
function init() {
  // Restore saved user info
  if (state.userName) {
    elements.userName.value = state.userName;
    elements.userNameDisplay.textContent = state.userName;
  }
  if (state.priorInfo) {
    elements.priorInfo.value = state.priorInfo;
  }

  // Update week buttons state
  updateWeekButtons();

  // Event listeners
  elements.startFirstSession.addEventListener('click', startFirstSession);
  elements.sendBtn.addEventListener('click', sendMessage);
  elements.endSessionBtn.addEventListener('click', endSession);
  elements.backToHome.addEventListener('click', goToHome);
  elements.nextSessionBtn.addEventListener('click', startNextSession);

  // IME変換中かどうかを追跡
  let isComposing = false;

  elements.messageInput.addEventListener('compositionstart', () => {
    isComposing = true;
  });

  elements.messageInput.addEventListener('compositionend', () => {
    isComposing = false;
  });

  elements.messageInput.addEventListener('keydown', (e) => {
    // IME変換中でない場合のみEnterで送信
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      sendMessage();
    }
  });

  elements.messageInput.addEventListener('input', () => {
    // Auto-resize textarea
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 150) + 'px';
  });

  elements.weekButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const week = parseInt(btn.dataset.week);
      if (canAccessWeek(week)) {
        startSession(week);
      }
    });
  });

  elements.userName.addEventListener('input', (e) => {
    state.userName = e.target.value;
    localStorage.setItem('userName', state.userName);
    elements.userNameDisplay.textContent = state.userName || 'ゲスト';
  });

  elements.priorInfo.addEventListener('input', (e) => {
    state.priorInfo = e.target.value;
    localStorage.setItem('priorInfo', state.priorInfo);
  });
}

// === Week Access Control ===
function canAccessWeek(week) {
  if (week === 1) return true;
  return state.completedWeeks.includes(week - 1);
}

function updateWeekButtons() {
  elements.weekButtons.forEach(btn => {
    const week = parseInt(btn.dataset.week);
    btn.classList.remove('active', 'completed');

    if (state.completedWeeks.includes(week)) {
      btn.classList.add('completed');
    }

    if (!canAccessWeek(week)) {
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  });
}

// === Screen Navigation ===
function showScreen(screen) {
  elements.welcomeScreen.style.display = 'none';
  elements.chatScreen.style.display = 'none';
  elements.articleScreen.style.display = 'none';

  if (screen === 'welcome') {
    elements.welcomeScreen.style.display = 'flex';
  } else if (screen === 'chat') {
    elements.chatScreen.style.display = 'flex';
  } else if (screen === 'article') {
    elements.articleScreen.style.display = 'flex';
  }
}

function goToHome() {
  stopTimer();
  showScreen('welcome');
  updateWeekButtons();
}

// === Session Management ===
async function startFirstSession() {
  if (!state.userName.trim()) {
    alert('お名前を入力してください');
    elements.userName.focus();
    return;
  }

  await startSession(1);
}

async function startSession(week) {
  state.currentWeek = week;
  showLoading(true);

  // 会話モードを取得
  const conversationModeInput = document.querySelector('input[name="conversationMode"]:checked');
  const conversationMode = conversationModeInput ? conversationModeInput.value : 'standard';

  // 会話の長さを取得
  const sessionLengthInput = document.querySelector('input[name="sessionLength"]:checked');
  const sessionLength = sessionLengthInput ? sessionLengthInput.value : 'medium';

  try {
    const response = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.userId,
        week: week,
        userName: state.userName,
        priorInfo: state.priorInfo,
        conversationMode: conversationMode,
        sessionLength: sessionLength
      })
    });

    const data = await response.json();
    state.currentSessionId = data.sessionId;

    // Update UI
    updateChatHeader(week, data.theme);
    elements.chatMessages.innerHTML = '';

    // Update active week button
    elements.weekButtons.forEach(btn => {
      btn.classList.remove('active');
      if (parseInt(btn.dataset.week) === week) {
        btn.classList.add('active');
      }
    });

    showScreen('chat');
    startTimer();

    // Get greeting from AI
    await getGreeting();

  } catch (error) {
    console.error('Session start error:', error);
    alert('セッションの開始に失敗しました。もう一度お試しください。');
  } finally {
    showLoading(false);
  }
}

function updateChatHeader(week, theme) {
  const weekClass = `week-${week}`;
  elements.sessionBadge.className = 'session-badge ' + weekClass;
  elements.sessionBadge.textContent = `Week ${week}`;
  elements.sessionTheme.textContent = theme;
}

async function getGreeting() {
  showTypingIndicator();

  try {
    const response = await fetch('/api/chat/greeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.currentSessionId
      })
    });

    const data = await response.json();
    removeTypingIndicator();
    addMessage('assistant', data.message);

  } catch (error) {
    console.error('Greeting error:', error);
    removeTypingIndicator();
    addMessage('assistant', 'こんにちは！今日のセッションを始めましょう。');
  }
}

async function sendMessage() {
  const message = elements.messageInput.value.trim();
  if (!message) return;

  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';
  elements.sendBtn.disabled = true;

  addMessage('user', message);
  showTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.currentSessionId,
        message: message
      })
    });

    const data = await response.json();
    removeTypingIndicator();
    addMessage('assistant', data.message);

  } catch (error) {
    console.error('Chat error:', error);
    removeTypingIndicator();
    addMessage('assistant', '申し訳ございません。通信エラーが発生しました。もう一度お試しください。');
  } finally {
    elements.sendBtn.disabled = false;
    elements.messageInput.focus();
  }
}

async function endSession() {
  if (!confirm('セッションを終了しますか？\n終了すると、このセッションの記事が生成されます。')) {
    return;
  }

  stopTimer();
  showLoading(true);

  try {
    const response = await fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.currentSessionId
      })
    });

    const data = await response.json();

    // Mark week as completed
    if (!state.completedWeeks.includes(state.currentWeek)) {
      state.completedWeeks.push(state.currentWeek);
      localStorage.setItem('completedWeeks', JSON.stringify(state.completedWeeks));
    }

    // Show article
    showArticle(data.article, state.currentWeek);

  } catch (error) {
    console.error('End session error:', error);
    alert('セッションの終了に失敗しました。');
  } finally {
    showLoading(false);
  }
}

function showArticle(articleMarkdown, week) {
  // Convert markdown to HTML (simple conversion)
  const html = markdownToHtml(articleMarkdown);
  elements.articleContent.innerHTML = html;

  // Show next session button if not last week
  if (week < 4) {
    elements.nextSessionBtn.style.display = 'inline-block';
    elements.nextSessionBtn.textContent = `${week + 1}週目のセッションへ進む →`;
  } else {
    elements.nextSessionBtn.style.display = 'none';
  }

  showScreen('article');
  updateWeekButtons();
}

async function startNextSession() {
  const nextWeek = state.currentWeek + 1;
  if (nextWeek <= 4) {
    await startSession(nextWeek);
  }
}

// === Message Display ===
function addMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const avatar = role === 'assistant' ? '🌿' : '👤';

  messageDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">${formatMessage(content)}</div>
  `;

  elements.chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

function formatMessage(content) {
  // Convert line breaks to paragraphs
  return content
    .split('\n\n')
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'message assistant';
  indicator.id = 'typingIndicator';
  indicator.innerHTML = `
    <div class="message-avatar">🌿</div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  elements.chatMessages.appendChild(indicator);
  scrollToBottom();
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

function scrollToBottom() {
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// === Timer ===
function startTimer() {
  state.sessionStartTime = Date.now();
  updateTimer();
  state.timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimer() {
  const elapsed = Date.now() - state.sessionStartTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  elements.sessionTimer.textContent =
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// === Utilities ===
function showLoading(show) {
  elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function markdownToHtml(markdown) {
  return markdown
    // Images - ![alt](url) を <img> タグに変換
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="article-image" loading="lazy">')
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    // Lists
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    // Paragraphs
    .split('\n\n')
    .map(p => {
      if (p.startsWith('<h') || p.startsWith('<li') || p.startsWith('<img')) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n')
    // Wrap list items
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
}

// === Initialize ===
document.addEventListener('DOMContentLoaded', init);

