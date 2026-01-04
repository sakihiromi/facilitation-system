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
  pendingWeek: null, // モーダルで選択中の週
  existingSessionData: null, // 既存セッション情報
  // 音声関連
  isRecording: false,
  recognition: null,
  speechSynthesis: window.speechSynthesis,
  currentUtterance: null,
  ttsEnabled: localStorage.getItem('ttsEnabled') !== 'false', // デフォルトでON
};

function generateUserId() {
  const id = 'user_' + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('userId', id);
  return id;
}

// // === DOM Elements ===
// let elements = {};
// === DOM Elements ===
// グローバルにしてfortune.jsからもアクセス可能にする
window.elements = {};
let elements = window.elements;

function initElements() {
  elements = {
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

    // モーダル関連
    sessionModal: document.getElementById('sessionModal'),
    modalTitle: document.getElementById('modalTitle'),
    existingSessionOptions: document.getElementById('existingSessionOptions'),
    newSessionOptions: document.getElementById('newSessionOptions'),
    sessionInfoDetails: document.getElementById('sessionInfoDetails'),
    resumeSessionBtn: document.getElementById('resumeSessionBtn'),
    startNewSessionBtn: document.getElementById('startNewSessionBtn'),
    startSessionFromModalBtn: document.getElementById('startSessionFromModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    saveSessionBtn: document.getElementById('saveSessionBtn'),

    // 占術モーダル関連
    fortuneModal: document.getElementById('fortuneModal'),
    fortuneGrid: document.getElementById('fortuneGrid'),
    fortuneSearch: document.getElementById('fortuneSearch'),
    selectedFortunes: document.getElementById('selectedFortunes'),
    selectedTags: document.getElementById('selectedTags'),
    fortuneCount: document.getElementById('fortuneCount'),
    clearFortuneBtn: document.getElementById('clearFortuneBtn'),
    confirmFortuneBtn: document.getElementById('confirmFortuneBtn'),
    cancelFortuneBtn: document.getElementById('cancelFortuneBtn'),

    // 音声関連
    voiceBtn: document.getElementById('voiceBtn'),
    ttsEnabled: document.getElementById('ttsEnabled'),
    ttsStopBtn: document.getElementById('ttsStopBtn'),

    // Git同期
    gitSyncBtn: document.getElementById('gitSyncBtn'),

    // レポート出力
    reportExportBtn: document.getElementById('reportExportBtn'),

    // アンケート関連
    surveyModal: document.getElementById('surveyModal'),
    surveyQuestions: document.getElementById('surveyQuestions'),
    submitSurveyBtn: document.getElementById('submitSurveyBtn'),
    skipSurveyBtn: document.getElementById('skipSurveyBtn'),
  };
}

// === Initialization ===
function init() {
  console.log('init() called');

  // DOM要素を初期化
  initElements();
  console.log('Elements initialized:', elements.startFirstSession);

  // 初期画面を表示
  showScreen('welcome');

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
  updateWeekButtonStyles();

  // Event listeners
  if (elements.startFirstSession) {
    elements.startFirstSession.addEventListener('click', startFirstSession);
    console.log('startFirstSession button listener added');
  } else {
    console.error('startFirstSession button not found!');
  }
  // elements.sendBtn.addEventListener('click', sendMessage);
  // elements.endSessionBtn.addEventListener('click', endSession);
  // elements.backToHome.addEventListener('click', goToHome);
  // // nextSessionBtnは動的に設定されるため、ここでは設定しない
  // elements.saveSessionBtn.addEventListener('click', saveSessionManually);

  // // モーダル関連
  // elements.resumeSessionBtn.addEventListener('click', handleResumeSession);
  // elements.startNewSessionBtn.addEventListener('click', handleStartNewSession);
  // elements.startSessionFromModalBtn.addEventListener('click', handleStartSessionFromModal);
  // elements.cancelModalBtn.addEventListener('click', closeSessionModal);
  if (elements.sendBtn) elements.sendBtn.addEventListener('click', sendMessage);
  if (elements.endSessionBtn) elements.endSessionBtn.addEventListener('click', endSession);
  if (elements.backToHome) elements.backToHome.addEventListener('click', goToHome);
  // nextSessionBtnは動的に設定されるため、ここでは設定しない
  if (elements.saveSessionBtn) elements.saveSessionBtn.addEventListener('click', saveSessionManually);

  // モーダル関連
  if (elements.resumeSessionBtn) elements.resumeSessionBtn.addEventListener('click', handleResumeSession);
  if (elements.startNewSessionBtn) elements.startNewSessionBtn.addEventListener('click', handleStartNewSession);
  if (elements.startSessionFromModalBtn) elements.startSessionFromModalBtn.addEventListener('click', handleStartSessionFromModal);
  if (elements.cancelModalBtn) elements.cancelModalBtn.addEventListener('click', closeSessionModal);

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
    btn.addEventListener('click', async () => {
      const week = parseFloat(btn.dataset.week);

      if (!canAccessWeek(week)) {
        alert(`Week ${week}にアクセスするには、前の週を完了してください。`);
        return;
      }

      // 完了済みの週かチェック
      if (state.completedWeeks.includes(week)) {
        // レポートを表示
        await showWeekReport(week);
      } else {
        // 新しいセッションを開始
        await showSessionModalForWeek(week);
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

  // 音声入力の初期化
  initSpeechRecognition();

  // 読み上げ設定の初期化
  if (elements.ttsEnabled) {
    elements.ttsEnabled.checked = state.ttsEnabled;
    elements.ttsEnabled.addEventListener('change', (e) => {
      state.ttsEnabled = e.target.checked;
      localStorage.setItem('ttsEnabled', state.ttsEnabled);
      if (!state.ttsEnabled) {
        stopSpeech();
      }
    });
  }

  // 読み上げ停止ボタン
  if (elements.ttsStopBtn) {
    elements.ttsStopBtn.addEventListener('click', stopSpeech);
  }

  // 音声入力ボタン
  if (elements.voiceBtn) {
    elements.voiceBtn.addEventListener('mousedown', startRecording);
    elements.voiceBtn.addEventListener('mouseup', stopRecording);
    elements.voiceBtn.addEventListener('mouseleave', stopRecording);
    // タッチデバイス対応
    elements.voiceBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startRecording();
    });
    elements.voiceBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      stopRecording();
    });
  }

  // Git同期ボタン
  if (elements.gitSyncBtn) {
    elements.gitSyncBtn.addEventListener('click', handleGitSync);
  }

  // レポート出力ボタン
  if (elements.reportExportBtn) {
    elements.reportExportBtn.addEventListener('click', handleReportExport);
  }

  // アンケート関連
  if (elements.submitSurveyBtn) {
    elements.submitSurveyBtn.addEventListener('click', submitSurvey);
  }
  if (elements.skipSurveyBtn) {
    elements.skipSurveyBtn.addEventListener('click', closeSurveyModal);
  }
}

// === Week Access Control ===
function canAccessWeek(week) {
  if (week === 1) return true;
  const canAccess = state.completedWeeks.includes(week - 1);
  console.log(`canAccessWeek(${week}): completedWeeks=${JSON.stringify(state.completedWeeks)}, result=${canAccess}`);
  return canAccess;
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

  // await startSession(1);
  // await showSessionModalForWeek(1);
  // ウェルカム画面の設定を取得
  const conversationMode = document.querySelector('input[name="conversationMode"]:checked')?.value || 'standard';
  const sessionLength = document.querySelector('input[name="sessionLength"]:checked')?.value || 'medium';

  // Week 1のセッションを開始
  await startSession(1, conversationMode, sessionLength);
}

async function startSession(week, conversationMode = null, sessionLength = null) {
  console.log(`startSession called: week=${week}, type=${typeof week}`);

  // weekが無効な場合のチェック
  if (week === null || week === undefined || isNaN(week)) {
    console.error(`Invalid week value: ${week}`);
    alert('週の設定が正しくありません。ページをリロードしてください。');
    return;
  }

  state.currentWeek = week;
  showLoading(true);

  // モーダルから渡されない場合はウェルカム画面の値を使用
  if (!conversationMode) {
    const conversationModeInput = document.querySelector('input[name="conversationMode"]:checked');
    conversationMode = conversationModeInput ? conversationModeInput.value : 'standard';
  }

  if (!sessionLength) {
    const sessionLengthInput = document.querySelector('input[name="sessionLength"]:checked');
    sessionLength = sessionLengthInput ? sessionLengthInput.value : 'medium';
  }

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

    // エラーレスポンスかどうかチェック
    if (!response.ok || data.error) {
      console.error('Greeting API error:', data.error || response.statusText);
      addMessage('assistant', 'こんにちは！今日のセッションを始めましょう。');
    } else {
      addMessage('assistant', data.message || 'こんにちは！今日のセッションを始めましょう。');
    }

    console.log('getGreeting: currentWeek =', state.currentWeek, 'checking if === 2:', state.currentWeek === 2);

    // Week 2（雑談会）の場合、占いモーダルを表示するオプションを追加
    if (state.currentWeek === 2) {
      console.log('Week 2 detected, adding fortune selection card in 1 second...');
      setTimeout(() => {
        console.log('Calling addFortuneSelectionCard()');
        addFortuneSelectionCard();
      }, 1000);
    }

  } catch (error) {
    console.error('Greeting error:', error);
    removeTypingIndicator();
    addMessage('assistant', 'こんにちは！今日のセッションを始めましょう。');
  }
}

// Week 1.5用の占い選択カードを追加
function addFortuneSelectionCard() {
  const card = document.createElement('div');
  card.className = 'mode-selection-card';
  card.innerHTML = `
    <div class="mode-selection-content">
      <h4>今日のモードを選んでください</h4>
      <div class="mode-buttons">
        <button class="mode-select-btn" data-mode="chat">
          <span class="mode-icon">💬</span>
          <span class="mode-title">雑談モード</span>
          <span class="mode-desc">リラックスして自由に話す</span>
        </button>
        <button class="mode-select-btn" data-mode="fortune">
          <span class="mode-icon">🔮</span>
          <span class="mode-title">占いモード</span>
          <span class="mode-desc">30種類以上の占術から選べます</span>
        </button>
      </div>
    </div>
  `;

  elements.chatMessages.appendChild(card);
  scrollToBottom();

  //   // ボタンのイベントリスナー
  //   card.querySelectorAll('.mode-select-btn').forEach(btn => {
  //     btn.addEventListener('click', async (e) => {
  //       const mode = e.currentTarget.dataset.mode;
  //       card.remove();

  //       if (mode === 'fortune') {
  //         await showFortuneModal();
  //       } else {
  //         await sendMessage('雑談モードを選びました。');
  //       }
  //     });
  //   });
  // }
  // ボタンのイベントリスナー
  card.querySelectorAll('.mode-select-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      console.log('Mode button clicked:', e.currentTarget.dataset.mode);
      const mode = e.currentTarget.dataset.mode;
      card.remove();

      if (mode === 'fortune') {
        console.log('Calling showFortuneModal()...');
        try {
          await showFortuneModal();
        } catch (error) {
          console.error('showFortuneModal error:', error);
        }
      } else {
        console.log('Sending chat mode message...');
        await sendMessage('雑談モードを選びました。');
      }
    });
  });
}

async function sendMessage(messageText) {
  const message = messageText || elements.messageInput.value.trim();
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

    // Update week button styles
    updateWeekButtonStyles();

    // Show article
    showArticleScreen(data.article, data.theme, state.currentWeek);

    // 少し待ってからアンケートを表示
    setTimeout(() => {
      showSurveyModal();
    }, 2000);

  } catch (error) {
    console.error('End session error:', error);
    alert('セッションの終了に失敗しました。');
  } finally {
    showLoading(false);
  }
}

// === Message Display ===
function addMessage(role, content, shouldSpeak = true) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const avatar = role === 'assistant' ? '🌿' : '👤';

  messageDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">${formatMessage(content)}</div>
  `;

  elements.chatMessages.appendChild(messageDiv);
  scrollToBottom();

  // AIの応答を自動で読み上げ
  if (role === 'assistant' && shouldSpeak) {
    speakText(content);
  }
}

function formatMessage(content) {
  // contentがnull/undefined/非文字列の場合は空文字を返す
  if (!content || typeof content !== 'string') {
    return '<p></p>';
  }
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

// === Modal Functions ===
async function showSessionModalForWeek(week) {
  console.log(`showSessionModalForWeek called: week=${week}`);
  state.pendingWeek = week;
  elements.modalTitle.textContent = `Week ${week} セッション設定`;

  // 既存セッションをチェック
  const existingSession = await checkExistingSession(state.userId, week);

  if (existingSession && existingSession.exists) {
    // 既存セッションがある場合
    state.existingSessionData = existingSession;
    elements.existingSessionOptions.style.display = 'block';

    const createdDate = new Date(existingSession.createdAt).toLocaleString('ja-JP');
    const lastSavedDate = existingSession.lastSavedAt
      ? new Date(existingSession.lastSavedAt).toLocaleString('ja-JP')
      : '未保存';

    elements.sessionInfoDetails.innerHTML = `
      <p><strong>作成日時:</strong> ${createdDate}</p>
      <p><strong>最終保存:</strong> ${lastSavedDate}</p>
      <p><strong>メッセージ数:</strong> ${existingSession.messageCount}件</p>
      <p><strong>会話モード:</strong> ${getModeName(existingSession.conversationMode)}</p>
      <p><strong>会話の長さ:</strong> ${getLengthName(existingSession.sessionLength)}</p>
    `;
  } else {
    // 既存セッションがない場合
    state.existingSessionData = null;
    elements.existingSessionOptions.style.display = 'none';
  }

  elements.sessionModal.style.display = 'flex';
}

function closeSessionModal() {
  elements.sessionModal.style.display = 'none';
  state.pendingWeek = null;
  state.existingSessionData = null;
}

async function handleResumeSession() {
  if (!state.existingSessionData) return;

  closeSessionModal();
  await resumeSession(state.existingSessionData.sessionId);
}

async function handleStartNewSession() {
  // 既存セッションがあっても新規作成
  elements.existingSessionOptions.style.display = 'none';
  state.existingSessionData = null;
}

async function handleStartSessionFromModal() {
  const conversationMode = document.querySelector('input[name="modalConversationMode"]:checked').value;
  const sessionLength = document.querySelector('input[name="modalSessionLength"]:checked').value;

  // closeSessionModal() の前に week を保存（closeで null にリセットされるため）
  const weekToStart = state.pendingWeek;

  closeSessionModal();
  await startSession(weekToStart, conversationMode, sessionLength);
}

async function checkExistingSession(userId, week) {
  try {
    const response = await fetch(`/api/session/check/${userId}/${week}`);
    if (response.ok) {
      return await response.json();
    }
    return { exists: false };
  } catch (error) {
    console.error('Session check error:', error);
    return { exists: false };
  }
}

async function resumeSession(sessionId) {
  showLoading(true);

  try {
    const response = await fetch('/api/session/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });

    const data = await response.json();

    // UIを復元
    state.currentSessionId = sessionId;
    state.currentWeek = data.week;
    updateChatHeader(data.week, data.theme);

    // メッセージ履歴を復元
    elements.chatMessages.innerHTML = '';
    data.messages.forEach(msg => {
      if (msg.role !== 'system') {
        addMessage(msg.role, msg.content);
      }
    });

    // 週ボタンを更新
    elements.weekButtons.forEach(btn => {
      btn.classList.remove('active');
      if (parseInt(btn.dataset.week) === data.week) {
        btn.classList.add('active');
      }
    });

    showScreen('chat');
    startTimer();

  } catch (error) {
    console.error('Resume session error:', error);
    alert('セッションの再開に失敗しました。');
  } finally {
    showLoading(false);
  }
}

async function saveSessionManually() {
  if (!state.currentSessionId) return;

  try {
    const response = await fetch('/api/session/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.currentSessionId
      })
    });

    if (response.ok) {
      // 保存成功のフィードバック
      const originalText = elements.saveSessionBtn.textContent;
      elements.saveSessionBtn.textContent = '✓';
      setTimeout(() => {
        elements.saveSessionBtn.textContent = originalText;
      }, 1000);
    }
  } catch (error) {
    console.error('Save session error:', error);
  }
}

function getModeName(mode) {
  const modes = {
    light: 'ライト',
    standard: 'スタンダード',
    deep: 'ディープ'
  };
  return modes[mode] || mode;
}

function getLengthName(length) {
  const lengths = {
    short: '短め (10-15分)',
    medium: '標準 (20-30分)',
    long: '長め (40-60分)'
  };
  return lengths[length] || length;
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

// === Report Display ===
async function showWeekReport(week) {
  try {
    const response = await fetch(`/api/session/report/${state.userId}/${week}`);

    if (!response.ok) {
      // レポートがない場合は新規セッション開始
      await showSessionModalForWeek(week);
      return;
    }

    const data = await response.json();

    // 記事画面を表示
    showArticleScreen(data.article, data.theme, week);

  } catch (error) {
    console.error('Report fetch error:', error);
    alert('レポートの取得に失敗しました');
  }
}

function showArticleScreen(article, theme, week) {
  console.log(`showArticleScreen called: week=${week}, completedWeeks=${JSON.stringify(state.completedWeeks)}`);

  // MarkdownをHTMLに変換
  const html = markdownToHtml(article);
  elements.articleContent.innerHTML = html;

  // 次セッションボタンの設定
  const nextWeek = getNextWeek(week);
  console.log(`nextWeek=${nextWeek}, canAccessWeek(${nextWeek})=${nextWeek ? canAccessWeek(nextWeek) : 'N/A'}`);

  if (nextWeek && canAccessWeek(nextWeek)) {
    elements.nextSessionBtn.style.display = 'block';
    elements.nextSessionBtn.textContent = `Week ${nextWeek}のセッションへ進む →`;
    elements.nextSessionBtn.onclick = () => {
      console.log(`Next session button clicked: navigating to week ${nextWeek}`);
      hideArticleScreen();
      showSessionModalForWeek(nextWeek);
    };
  } else {
    console.log('Next session button hidden');
    elements.nextSessionBtn.style.display = 'none';
  }

  // 画面切り替え
  elements.welcomeScreen.style.display = 'none';
  elements.chatScreen.style.display = 'none';
  elements.articleScreen.style.display = 'flex';
}

function hideArticleScreen() {
  elements.articleScreen.style.display = 'none';
  elements.welcomeScreen.style.display = 'flex';
}

function getNextWeek(currentWeek) {
  const weeks = [1, 2, 3, 4, 5];
  const currentIndex = weeks.indexOf(currentWeek);
  if (currentIndex >= 0 && currentIndex < weeks.length - 1) {
    return weeks[currentIndex + 1];
  }
  return null;
}

function updateWeekButtonStyles() {
  elements.weekButtons.forEach(btn => {
    const week = parseFloat(btn.dataset.week);
    if (state.completedWeeks.includes(week)) {
      btn.classList.add('completed');
    }
  });
}

// // === Fortune Modal Functions ===
// let selectedFortuneTypes = [];

// // 占術のカテゴリ分け
// const fortuneCategories = {
//   western: ['tarot', 'western_astrology', 'numerology', 'kabbalah', 'runes', 'oracle_cards', 'pendulum', 'crystal_ball', 'tea_leaves', 'palmistry'],
//   eastern: ['chinese_astrology', 'bazi', 'ziwei_doushu', 'nine_star_ki', 'eki', 'omikuji', 'kigaku', 'onmyodo', 'vedic_astrology', 'mayan_astrology', 'aztec_astrology'],
//   birthday: ['birth_flower', 'birth_stone', 'birth_color', 'birthday_fortune'],
//   psychology: ['mbti', 'enneagram', 'big_five', 'blood_type', 'aura_reading', 'chakra_reading'],
//   other: ['name_numerology', 'kanji_fortune', 'animal_fortune', 'tree_fortune', 'flower_fortune', 'dream_interpretation', 'feng_shui', 'face_reading', 'graphology', 'biorhythm', 'lucky_item', 'compatibility', 'energy_healing']
// };

// // プリセット
// const fortunePresets = {
//   popular: ['tarot', 'western_astrology', 'numerology'],
//   eastern: ['chinese_astrology', 'nine_star_ki', 'eki'],
//   deep: ['mbti', 'enneagram', 'aura_reading']
// };

// async function showFortuneModal() {
//   const modal = elements.fortuneModal;
//   if (!modal) {
//     console.error('Fortune modal not found');
//     return;
//   }

//   // 占術一覧を取得
//   try {
//     const response = await fetch('/api/fortune-types');
//     const fortuneTypes = await response.json();

//     // グリッドを生成
//     renderFortuneGrid(fortuneTypes, 'all');

//     // タブのイベントリスナー
//     const tabs = modal.querySelectorAll('.fortune-tab');
//     tabs.forEach(tab => {
//       tab.addEventListener('click', () => {
//         tabs.forEach(t => t.classList.remove('active'));
//         tab.classList.add('active');
//         renderFortuneGrid(fortuneTypes, tab.dataset.category);
//       });
//     });

//     // プリセットボタンのイベントリスナー
//     const presetBtns = modal.querySelectorAll('.preset-btn');
//     presetBtns.forEach(btn => {
//       btn.addEventListener('click', async () => {
//         const preset = btn.dataset.preset;

//         if (preset === 'omakase') {
//           // お任せ占い
//           modal.style.display = 'none';
//           await handleOmakaseFortune();
//         } else {
//           // プリセット選択
//           selectedFortuneTypes = [...fortunePresets[preset]];
//           updateSelectedDisplay();
//         }
//       });
//     });

//     // 検索機能
//     const searchInput = elements.fortuneSearch;
//     if (searchInput) {
//       searchInput.addEventListener('input', (e) => {
//         const query = e.target.value.toLowerCase();
//         filterFortuneGrid(fortuneTypes, query);
//       });
//     }

//     // 確定ボタン
//     const confirmBtn = elements.confirmFortuneBtn;
//     if (confirmBtn) {
//       confirmBtn.onclick = async () => {
//         if (selectedFortuneTypes.length === 0) {
//           alert('占術を選択してください');
//           return;
//         }
//         modal.style.display = 'none';
//         await handleFortuneSelection(selectedFortuneTypes);
//       };
//     }

//     // キャンセルボタン
//     const cancelBtn = elements.cancelFortuneBtn;
//     if (cancelBtn) {
//       cancelBtn.onclick = () => {
//         modal.style.display = 'none';
//         selectedFortuneTypes = [];
//       };
//     }

//     // クリアボタン
//     const clearBtn = elements.clearFortuneBtn;
//     if (clearBtn) {
//       clearBtn.onclick = () => {
//         selectedFortuneTypes = [];
//         updateSelectedDisplay();
//         // チェックを外す
//         modal.querySelectorAll('.fortune-card.selected').forEach(card => {
//           card.classList.remove('selected');
//         });
//       };
//     }

//     modal.style.display = 'flex';

//   } catch (error) {
//     console.error('Failed to load fortune types:', error);
//     alert('占術データの読み込みに失敗しました');
//   }
// }

// function renderFortuneGrid(fortuneTypes, category) {
//   const grid = elements.fortuneGrid;
//   if (!grid) return;

//   grid.innerHTML = '';

//   const entries = Object.entries(fortuneTypes);
//   const filtered = category === 'all'
//     ? entries
//     : entries.filter(([key]) => fortuneCategories[category]?.includes(key));

//   filtered.forEach(([key, name]) => {
//     const card = document.createElement('div');
//     card.className = `fortune-card ${selectedFortuneTypes.includes(key) ? 'selected' : ''}`;
//     card.dataset.fortune = key;
//     card.innerHTML = `
//       <div class="fortune-name">${name}</div>
//     `;

//     card.addEventListener('click', () => {
//       toggleFortuneSelection(key);
//       card.classList.toggle('selected');
//     });

//     grid.appendChild(card);
//   });
// }

// function filterFortuneGrid(fortuneTypes, query) {
//   const grid = elements.fortuneGrid;
//   if (!grid) return;

//   const cards = grid.querySelectorAll('.fortune-card');
//   cards.forEach(card => {
//     const key = card.dataset.fortune;
//     const name = fortuneTypes[key] || '';
//     const matches = name.toLowerCase().includes(query) || key.toLowerCase().includes(query);
//     card.style.display = matches ? 'block' : 'none';
//   });
// }

// function toggleFortuneSelection(fortuneKey) {
//   const index = selectedFortuneTypes.indexOf(fortuneKey);
//   if (index === -1) {
//     selectedFortuneTypes.push(fortuneKey);
//   } else {
//     selectedFortuneTypes.splice(index, 1);
//   }
//   updateSelectedDisplay();
// }

// function updateSelectedDisplay() {
//   const container = elements.selectedFortunes;
//   const tagsContainer = elements.selectedTags;
//   const countDisplay = elements.fortuneCount;
//   const confirmBtn = elements.confirmFortuneBtn;

//   if (selectedFortuneTypes.length > 0) {
//     if (container) container.style.display = 'flex';
//     if (tagsContainer) {
//       tagsContainer.innerHTML = selectedFortuneTypes.map(key =>
//         `<span class="selected-tag">${key}</span>`
//       ).join('');
//     }
//     if (confirmBtn) confirmBtn.disabled = false;
//   } else {
//     if (container) container.style.display = 'none';
//     if (confirmBtn) confirmBtn.disabled = true;
//   }

//   if (countDisplay) {
//     countDisplay.textContent = selectedFortuneTypes.length;
//   }
// }

// async function handleOmakaseFortune() {
//   try {
//     const response = await fetch('/api/session/omakase-fortune', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         sessionId: state.currentSessionId
//       })
//     });

//     if (response.ok) {
//       await sendMessage('お任せ占いを選びました。AIさんにおすすめの占いを選んでもらいたいです。');
//     }
//   } catch (error) {
//     console.error('Omakase fortune error:', error);
//   }
// }

// async function handleFortuneSelection(selectedFortunes) {
//   try {
//     const response = await fetch('/api/session/set-fortune', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         sessionId: state.currentSessionId,
//         fortuneTypes: selectedFortunes
//       })
//     });

//     if (response.ok) {
//       const fortuneNames = selectedFortunes.join('、');
//       await sendMessage(`占いモードを選びました。${fortuneNames} をお願いします。`);
//     }
//   } catch (error) {
//     console.error('Fortune selection error:', error);
//   }

//   selectedFortuneTypes = [];
// }

// === Speech Recognition (音声入力) ===
// 音声認識の累積テキストを保持
let accumulatedTranscript = '';

function initSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('音声認識はこのブラウザでサポートされていません');
    if (elements.voiceBtn) {
      elements.voiceBtn.style.display = 'none';
    }
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SpeechRecognition();
  state.recognition.lang = 'ja-JP';
  state.recognition.interimResults = true;
  state.recognition.continuous = true;

  state.recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    
    // 確定したテキストを累積
    if (finalTranscript) {
      accumulatedTranscript += finalTranscript;
    }
    
    // 累積テキスト + 現在の中間結果を表示
    elements.messageInput.value = accumulatedTranscript + interimTranscript;
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 150) + 'px';
  };

  state.recognition.onerror = (event) => {
    console.error('音声認識エラー:', event.error);
    // no-speech エラーは無視（途切れただけ）
    if (event.error !== 'no-speech') {
      stopRecording();
    }
  };

  state.recognition.onend = () => {
    if (state.isRecording) {
      // 録音中に終了した場合は再開（累積テキストは保持される）
      try {
        state.recognition.start();
      } catch (e) {
        stopRecording();
      }
    }
  };
}

function startRecording() {
  if (!state.recognition || state.isRecording) return;

  try {
    // 録音開始時に累積テキストをリセット（既存の入力は保持）
    accumulatedTranscript = elements.messageInput.value;
    state.recognition.start();
    state.isRecording = true;
    if (elements.voiceBtn) {
      elements.voiceBtn.classList.add('recording');
    }
  } catch (e) {
    console.error('録音開始エラー:', e);
  }
}

function stopRecording() {
  if (!state.recognition || !state.isRecording) return;

  try {
    state.recognition.stop();
    state.isRecording = false;
    if (elements.voiceBtn) {
      elements.voiceBtn.classList.remove('recording');
    }
  } catch (e) {
    console.error('録音停止エラー:', e);
  }
}

// === Text-to-Speech (読み上げ) ===
function speakText(text) {
  if (!state.ttsEnabled || !state.speechSynthesis) return;

  // 既存の読み上げを停止
  stopSpeech();

  // テキストをクリーンアップ（マークダウン記号を除去）
  const cleanText = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^-\s*/gm, '')
    .replace(/^\d+\.\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  state.currentUtterance = new SpeechSynthesisUtterance(cleanText);
  state.currentUtterance.lang = 'ja-JP';
  state.currentUtterance.rate = 1.0;
  state.currentUtterance.pitch = 1.0;

  // 日本語音声を優先選択
  const voices = state.speechSynthesis.getVoices();
  const japaneseVoice = voices.find(v => v.lang.includes('ja'));
  if (japaneseVoice) {
    state.currentUtterance.voice = japaneseVoice;
  }

  state.currentUtterance.onstart = () => {
    if (elements.ttsStopBtn) {
      elements.ttsStopBtn.style.display = 'block';
    }
  };

  state.currentUtterance.onend = () => {
    if (elements.ttsStopBtn) {
      elements.ttsStopBtn.style.display = 'none';
    }
    state.currentUtterance = null;
  };

  state.speechSynthesis.speak(state.currentUtterance);
}

function stopSpeech() {
  if (state.speechSynthesis) {
    state.speechSynthesis.cancel();
  }
  if (elements.ttsStopBtn) {
    elements.ttsStopBtn.style.display = 'none';
  }
  state.currentUtterance = null;
}

// 音声合成の声リストを取得（ブラウザによってはonvoiceschangedが必要）
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// === Survey (アンケート) ===
async function showSurveyModal() {
  try {
    const response = await fetch('/api/survey/questions');
    const data = await response.json();
    const questions = data.postSession;

    const container = elements.surveyQuestions;
    container.innerHTML = '';

    questions.forEach(q => {
      const questionDiv = document.createElement('div');
      questionDiv.className = 'survey-question';

      if (q.type === 'scale') {
        questionDiv.innerHTML = `
          <label>${q.question}</label>
          <div class="survey-scale">
            ${Array.from({ length: q.max - q.min + 1 }, (_, i) => {
              const value = q.min + i;
              const label = value === q.min ? q.minLabel : (value === q.max ? q.maxLabel : value);
              return `
                <label>
                  <input type="radio" name="${q.id}" value="${value}">
                  <span class="scale-option">${label}</span>
                </label>
              `;
            }).join('')}
          </div>
        `;
      } else if (q.type === 'text') {
        questionDiv.innerHTML = `
          <label>${q.question}</label>
          <textarea class="survey-textarea" name="${q.id}" placeholder="ご自由にお書きください..."></textarea>
        `;
      }

      container.appendChild(questionDiv);
    });

    elements.surveyModal.style.display = 'flex';
  } catch (error) {
    console.error('Survey load error:', error);
  }
}

async function submitSurvey() {
  const container = elements.surveyQuestions;
  const responses = {};

  // 各設問の回答を収集
  container.querySelectorAll('input[type="radio"]:checked').forEach(input => {
    responses[input.name] = parseInt(input.value);
  });

  container.querySelectorAll('textarea').forEach(textarea => {
    if (textarea.value.trim()) {
      responses[textarea.name] = textarea.value.trim();
    }
  });

  try {
    await fetch('/api/survey/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.currentSessionId,
        userId: state.userId,
        week: state.currentWeek,
        responses
      })
    });

    closeSurveyModal();
    alert('アンケートにご協力いただきありがとうございました！');
  } catch (error) {
    console.error('Survey submit error:', error);
    alert('アンケートの送信に失敗しました');
  }
}

function closeSurveyModal() {
  elements.surveyModal.style.display = 'none';
}

// === Report Export ===
async function handleReportExport() {
  const btn = elements.reportExportBtn;
  if (!btn || btn.classList.contains('exporting')) return;

  // 完了した週があるか確認
  if (state.completedWeeks.length === 0) {
    alert('完了したセッションがありません。\n少なくとも1つのセッションを完了してからレポートを出力してください。');
    return;
  }

  btn.classList.add('exporting');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="export-icon">⏳</span><span>生成中...</span>';

  try {
    const response = await fetch('/api/report/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.userId,
        userName: state.userName || 'ゲスト'
      })
    });

    const data = await response.json();

    if (data.success) {
      btn.innerHTML = '<span class="export-icon">✅</span><span>完了!</span>';
      alert(`レポートを生成しました！\n\n保存先: ${data.outputPath}\n\n生成されたファイル:\n${data.files.join('\n')}`);
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('exporting');
      }, 2000);
    } else {
      throw new Error(data.error || 'レポート生成に失敗しました');
    }
  } catch (error) {
    console.error('Report export error:', error);
    btn.innerHTML = '<span class="export-icon">❌</span><span>失敗</span>';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.remove('exporting');
    }, 2000);
    alert('レポート出力に失敗しました: ' + error.message);
  }
}

// === Git Sync ===
async function handleGitSync() {
  const btn = elements.gitSyncBtn;
  if (!btn || btn.classList.contains('syncing')) return;

  btn.classList.add('syncing');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="sync-icon">🔄</span><span>同期中...</span>';

  try {
    const response = await fetch('/api/git/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (data.success) {
      btn.innerHTML = '<span class="sync-icon">✅</span><span>完了!</span>';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('syncing');
      }, 2000);
    } else {
      throw new Error(data.error || 'Git同期に失敗しました');
    }
  } catch (error) {
    console.error('Git sync error:', error);
    btn.innerHTML = '<span class="sync-icon">❌</span><span>失敗</span>';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.remove('syncing');
    }, 2000);
    alert('Git同期に失敗しました: ' + error.message);
  }
}

// === Initialize ===
document.addEventListener('DOMContentLoaded', init);
