// 占術選択用のグローバル変数
let selectedFortuneTypes = [];
let allFortuneTypes = {};

// 占術選択モーダルを表示
async function showFortuneModal() {
    console.log('showFortuneModal (fortune.js) called');
    console.log('elements:', elements);
    console.log('elements.fortuneModal:', elements.fortuneModal);

    try {
        // 占術一覧を取得
        console.log('Fetching fortune types...');
        const response = await fetch('/api/fortune-types');
        allFortuneTypes = await response.json();
        console.log('Fortune types loaded:', Object.keys(allFortuneTypes).length);

        // モーダルを初期化
        selectedFortuneTypes = [];
        populateFortuneGrid();
        setupFortuneModalEvents();

        // console.log('Setting modal display to flex...');
        // // elements.fortuneModal.style.display = 'flex';
        // elements.fortuneModal.style.setProperty('display', 'flex', 'important');
        // elements.fortuneModal.style.zIndex = '9999';
        // elements.fortuneModal.style.position = 'fixed';
        // elements.fortuneModal.style.opacity = '1';
        // console.log('Modal should now be visible');
        console.log('Setting modal display to flex...');
        elements.fortuneModal.style.setProperty('display', 'flex', 'important');
        elements.fortuneModal.style.zIndex = '9999';
        elements.fortuneModal.style.position = 'fixed';
        elements.fortuneModal.style.top = '0';
        elements.fortuneModal.style.left = '0';
        elements.fortuneModal.style.width = '100%';
        elements.fortuneModal.style.height = '100%';
        elements.fortuneModal.style.opacity = '1';
        console.log('Modal should now be visible');


    } catch (error) {
        console.error('Fortune types fetch error:', error);
    }
}

// 占術グリッドを生成
function populateFortuneGrid() {
    console.log('populateFortuneGrid called');
    const grid = elements.fortuneGrid;
    console.log('fortuneGrid element:', grid);
    grid.innerHTML = '';

    const categories = {
        western: ['tarot', 'western_astrology', 'numerology', 'kabbalah', 'runes', 'oracle_cards', 'pendulum', 'crystal_ball', 'tea_leaves', 'palmistry'],
        eastern: ['chinese_astrology', 'bazi', 'ziwei_doushu', 'nine_star_ki', 'eki', 'omikuji', 'kigaku', 'onmyodo'],
        birthday: ['birth_flower', 'birth_stone', 'birth_color', 'birthday_fortune'],
        psychology: ['mbti', 'enneagram', 'big_five', 'blood_type'],
        other: ['vedic_astrology', 'mayan_astrology', 'aztec_astrology', 'name_numerology', 'kanji_fortune', 'aura_reading', 'chakra_reading', 'energy_healing', 'animal_fortune', 'tree_fortune', 'flower_fortune', 'dream_interpretation', 'feng_shui', 'face_reading', 'graphology', 'biorhythm', 'lucky_item', 'compatibility']
    };

    const icons = {
        tarot: '🔮', western_astrology: '⭐', numerology: '🔢', mbti: '🧠',
        chinese_astrology: '🐉', nine_star_ki: '🎋', blood_type: '🩸', palmistry: '🤚'
    };

    console.log('allFortuneTypes:', Object.keys(allFortuneTypes).length, 'items');
    Object.entries(allFortuneTypes).forEach(([key, name]) => {
        const card = document.createElement('button');
        card.className = 'fortune-card';
        card.dataset.fortune = key;
        card.dataset.category = getCategoryForFortune(key, categories);

        card.innerHTML = `
    < div class="fortune-icon" > ${icons[key] || '✨'}</div >
      <div class="fortune-name">${name}</div>
      <div class="fortune-check">✓</div>
`;

        card.addEventListener('click', () => toggleFortuneSelection(key, card));
        grid.appendChild(card);
    });
    console.log('populateFortuneGrid completed, added', grid.children.length, 'cards');
}

// 占術の選択/解除をトグル
function toggleFortuneSelection(fortuneKey, cardElement) {
    console.log('toggleFortuneSelection called:', fortuneKey, cardElement);
    const index = selectedFortuneTypes.indexOf(fortuneKey);

    if (index > -1) {
        selectedFortuneTypes.splice(index, 1);
        cardElement.classList.remove('selected');
        console.log('Deselected:', fortuneKey);
    } else {
        selectedFortuneTypes.push(fortuneKey);
        cardElement.classList.add('selected');
        console.log('Selected:', fortuneKey);
    }

    updateSelectedDisplay();
}

// 選択中の占術表示を更新
function updateSelectedDisplay() {
    if (selectedFortuneTypes.length > 0) {
        elements.selectedFortunes.style.display = 'flex';
        elements.confirmFortuneBtn.disabled = false;

        elements.selectedTags.innerHTML = selectedFortuneTypes.map(key => {
            const name = allFortuneTypes[key];
            return `
    < span class="selected-tag" >
        ${name}
<button class="tag-remove" data-fortune="${key}">×</button>
        </span >
    `;
        }).join('');

        // タグ削除ボタンのイベント
        elements.selectedTags.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fortuneKey = e.currentTarget.dataset.fortune;
                const card = document.querySelector(`[data - fortune="${fortuneKey}"]`);
                toggleFortuneSelection(fortuneKey, card);
            });
        });
    } else {
        elements.selectedFortunes.style.display = 'none';
        elements.confirmFortuneBtn.disabled = true;
    }

    elements.fortuneCount.textContent = selectedFortuneTypes.length;
}

// 占術モーダルのイベントを設定
function setupFortuneModalEvents() {
    // プリセットボタン
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', handlePresetSelection);
    });

    // カテゴリータブ
    document.querySelectorAll('.fortune-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.fortune-tab').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            filterFortunesByCategory(e.currentTarget.dataset.category);
        });
    });

    // 検索
    elements.fortuneSearch.addEventListener('input', (e) => {
        filterFortunesBySearch(e.target.value);
    });

    // ボタン
    elements.clearFortuneBtn.addEventListener('click', clearFortuneSelection);
    elements.confirmFortuneBtn.addEventListener('click', confirmFortuneSelection);
    elements.cancelFortuneBtn.addEventListener('click', () => {
        elements.fortuneModal.style.display = 'none';
    });
}

// プリセット選択
async function handlePresetSelection(e) {
    const preset = e.currentTarget.dataset.preset;

    const presets = {
        omakase: 'omakase',
        popular: ['tarot', 'western_astrology', 'numerology'],
        eastern: ['chinese_astrology', 'nine_star_ki', 'eki'],
        deep: ['mbti', 'enneagram', 'aura_reading']
    };

    if (preset === 'omakase') {
        elements.fortuneModal.style.display = 'none';
        await selectOmakaseFortune();
    } else {
        selectedFortuneTypes = presets[preset];
        await confirmFortuneSelection();
    }
}

// お任せ占い
async function selectOmakaseFortune() {
    try {
        await fetch('/api/session/omakase-fortune', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: state.currentSessionId })
        });

        await sendMessage('お任せ占いを選びました。私に合った占術を選んでください。');
    } catch (error) {
        console.error('Omakase fortune error:', error);
    }
}

// 占術選択を確定
async function confirmFortuneSelection() {
    if (selectedFortuneTypes.length === 0) return;

    elements.fortuneModal.style.display = 'none';

    try {
        await fetch('/api/session/set-fortune', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: state.currentSessionId,
                fortuneTypes: selectedFortuneTypes
            })
        });

        const fortuneNames = selectedFortuneTypes.map(key => allFortuneTypes[key]).join('、');
        await sendMessage(`占いモードを選びました。${fortuneNames} でお願いします。`);
    } catch (error) {
        console.error('Fortune selection error:', error);
    }
}

// 選択をクリア
function clearFortuneSelection() {
    selectedFortuneTypes = [];
    document.querySelectorAll('.fortune-card').forEach(card => {
        card.classList.remove('selected');
    });
    updateSelectedDisplay();
}

// カテゴリーでフィルター
function filterFortunesByCategory(category) {
    const cards = document.querySelectorAll('.fortune-card');
    cards.forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// 検索でフィルター
function filterFortunesBySearch(query) {
    const cards = document.querySelectorAll('.fortune-card');
    const lowerQuery = query.toLowerCase();

    cards.forEach(card => {
        const name = card.querySelector('.fortune-name').textContent.toLowerCase();
        if (name.includes(lowerQuery)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// カテゴリー判定
function getCategoryForFortune(fortuneKey, categories) {
    for (const [category, keys] of Object.entries(categories)) {
        if (keys.includes(fortuneKey)) return category;
    }
    return 'other';
}
