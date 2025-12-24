const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
require('dotenv').config();

const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// 画像保存用ディレクトリを作成
const imagesDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// セッションデータ保存用ディレクトリを作成
const sessionsDir = path.join(__dirname, 'data', 'sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// OpenAI クライアント初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// セッションデータを保存（本番環境ではデータベースを使用）
const sessions = new Map();

// セッション永続化関数
function saveSessionToFile(sessionId, sessionData) {
  try {
    const filePath = path.join(sessionsDir, `${sessionId}.json`);
    const dataToSave = {
      ...sessionData,
      lastSavedAt: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
  } catch (error) {
    console.error('Session save error:', error);
  }
}

function loadSessionFromFile(sessionId) {
  try {
    const filePath = path.join(sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Session load error:', error);
    return null;
  }
}

function findUserWeekSessions(userId, week) {
  try {
    const files = fs.readdirSync(sessionsDir);
    const pattern = `${userId}_week${week}_`;
    const matchingFiles = files.filter(f => f.startsWith(pattern) && f.endsWith('.json'));

    if (matchingFiles.length > 0) {
      // 最新のセッションを返す
      const sortedFiles = matchingFiles.sort().reverse();
      const sessionId = sortedFiles[0].replace('.json', '');
      return loadSessionFromFile(sessionId);
    }
    return null;
  } catch (error) {
    console.error('Session search error:', error);
    return null;
  }
}

// 占術の種類定義
const fortuneTypes = {
  // 西洋系占術
  tarot: 'タロット占い',
  western_astrology: '西洋占星術',
  numerology: '数秘術',
  kabbalah: 'カバラ数秘術',
  runes: 'ルーン占い',
  oracle_cards: 'オラクルカード',
  pendulum: 'ペンデュラム占い',
  crystal_ball: '水晶占い',
  tea_leaves: '茶葉占い',
  palmistry: '手相占い',

  // 東洋系占術
  chinese_astrology: '四柱推命',
  bazi: '算命学',
  ziwei_doushu: '紫微斗数',
  nine_star_ki: '九星気学',
  eki: '易占い（周易）',
  omikuji: 'おみくじ',
  kigaku: '気学',
  onmyodo: '陰陽道',

  // インド系占術
  vedic_astrology: 'インド占星術（ジョーティシュ）',

  // マヤ・アステカ系
  mayan_astrology: 'マヤ暦占星術',
  aztec_astrology: 'アステカ占星術',

  // 誕生日系
  birth_flower: '誕生花占い',
  birth_stone: '誕生石占い',
  birth_color: '誕生色占い',
  birthday_fortune: '誕生日占い',

  // 名前・文字系
  name_numerology: '姓名判断',
  kanji_fortune: '漢字占い',

  // オーラ・エネルギー系
  aura_reading: 'オーラリーディング',
  chakra_reading: 'チャクラリーディング',
  energy_healing: 'エネルギーヒーリング',

  // 心理・性格診断系
  mbti: 'MBTI診断',
  enneagram: 'エニアグラム',
  big_five: 'ビッグファイブ性格診断',
  blood_type: '血液型占い',

  // 動物・自然系
  animal_fortune: '動物占い',
  tree_fortune: '樹木占い',
  flower_fortune: '花占い',

  // その他
  dream_interpretation: '夢占い',
  feng_shui: '風水',
  face_reading: '人相占い',
  graphology: '筆跡占い',
  biorhythm: 'バイオリズム',
  lucky_item: 'ラッキーアイテム占い',
  compatibility: '相性占い'
};

// 会話モードの定義
const conversationModes = {
  light: {
    name: 'ライトモード',
    description: '気軽に話す',
    modifier: `
【会話スタイル調整】
- 質問は控えめに、相手の話を聞くことを優先
- 深堀りは最小限に留める
- リラックスした雰囲気を大切に
- 1回の発言は50-100文字程度と短めに
- 「そうなんですね」「なるほど」など、受け止める言葉を多めに`
  },
  standard: {
    name: 'スタンダードモード',
    description: 'バランス型',
    modifier: '' // デフォルトのプロンプトをそのまま使用
  },
  deep: {
    name: 'ディープモード',
    description: 'じっくり探求',
    modifier: `
【会話スタイル調整】
- より深い対話を心がける
- 「なぜ？」「それはどういうこと？」と積極的に掘り下げる
- 具体的なエピソードを丁寧に引き出す
- 矛盾や葛藤があれば、それを一緒に探求する
- 沈黙の時間も大切にし、じっくり考える時間を提供`
  }
};

// 会話の長さ設定
const sessionLengths = {
  short: {
    name: '短め',
    description: '10-15分',
    targetMinutes: 15,
    modifier: `
【セッション時間の調整】
- このセッションは10-15分程度を想定しています
- 重要なポイントに絞って対話を進めてください
- 効率的に核心に迫る質問を心がけてください
- 8-10回程度のやり取りで完結することを目指してください`
  },
  medium: {
    name: '標準',
    description: '20-30分',
    targetMinutes: 25,
    modifier: `
【セッション時間の調整】
- このセッションは20-30分程度を想定しています
- 15-20回程度のやり取りで完結することを目指してください
- バランスよく対話を進めてください`
  },
  long: {
    name: '長め',
    description: '40-60分',
    targetMinutes: 50,
    modifier: `
【セッション時間の調整】
- このセッションは40-60分程度を想定しています
- 25-35回程度のやり取りで完結することを目指してください
- じっくりと時間をかけて対話を深めてください
- 一つ一つのテーマを丁寧に掘り下げてください
- 急がず、相手のペースに合わせて進めてください
- 具体的なエピソードや背景も詳しく聞いてください`
  }
};

// 各週のファシリテーション設定
const weeklyConfig = {
  1: {
    theme: 'あなたの"はたらくウェルビーイング"は？',
    perspective: 'I',
    systemPrompt: `あなたは優秀なAIファシリテーターです。温かく、共感的で、相手の本質を引き出すことに長けています。

【今週のテーマ】
「あなたの\"はたらくウェルビーイング\"は？」
「I」（個人）の視点から、参加者の内面にある価値観やウェルビーイングを丁寧に探求します。

【ファシリテーションの原則】
1. **まず受け止める**: 相手の言葉をそのまま受け止め、評価や判断をせず、ありのままを受け入れる
2. **共感を示す**: 相手の想いや感情に寄り添い、「そうなんですね」「大切にされているんですね」と共感する
3. **相手の言葉から次を紡ぐ**: 定型的な質問は避け、相手が話した言葉の中から自然に次の問いを見つける
4. **問いは自然に生まれる**: 「なぜ？」と聞く前に、まず相手の言葉を丁寧に受け止める。問いは対話の流れから自然に生まれる

【対話の心得】
- 定型的な質問パターンは使わない
- 相手の言葉を丁寧に受け止め、その中から次の問いを見つける
- 質問する前に、まず共感を示す
- 沈黙を恐れず、相手が考える時間を大切にする
- 相手のペースを最優先に、急がない
- 具体的なエピソードと抽象的な価値観を自然に行き来する

【対話のスタイル】
- 1回の発言は100-200文字程度に抑え、相手が話す時間を大切にする
- 相手の言葉をそのまま受け止め、言い換えて確認する（「つまり〇〇ということですね」）
- 「そうなんですね」「なるほど」「大切にされているんですね」など、まず共感する
- 質問は相手の言葉の中から自然に生まれるものだけにする
- 沈黙も対話の一部として大切にする

【今週の目標】
参加者が自分自身の価値観やウェルビーイングについて、新たな気づきを得られること。`
  },

  2: {
    theme: '雑談会 ☕',
    perspective: 'Chat',
    systemPrompt: `あなたは優秀なAIファシリテーターです。温かく、共感的で、相手の本質を引き出すことに長けています。

【今回のテーマ】
「雑談会 ☕」
Week 1のセッションを終えて、リラックスした雰囲気で対話を楽しみましょう。

【このセッションの目的】
1. **フィードバック収集**: 前回のセッションの感想や改善点を聞く
2. **個人理解の深化**: 趣味、興味、悩みなど、その人をより深く知る
3. **占いモード**: 希望があれば、占いを通じて自己理解を深める
4. **リラックス**: 気軽に話せる雰囲気を作る

【セッションの開始】
最初に、参加者に以下を確認してください：

「今日は雑談会です！Week 1のセッション、お疲れさまでした。
今日は2つのモードから選べます：

1. **雑談モード**: リラックスして、趣味や最近の出来事などを自由に話す
2. **占いモード**: 占いを通じて自己理解を深める（30種類以上の占術から選べます）

どちらがいいですか？それとも両方やってみますか？」

【雑談モードの場合】
- Week 1のフィードバックを聞く
- 趣味、興味、悩みなどを自然に引き出す
- 仕事以外のその人を知る
- リラックスした雰囲気を大切に

【占いモードの場合】
- 占術の選択を促す
- 必要な情報を聞く
- 占いの結果を分かりやすく伝える
- 自己理解につながる気づきを提供

【ファシリテーションの原則】
1. **まず受け止める**: 相手の言葉をそのまま受け止め、評価や判断をせず、ありのままを受け入れる
2. **共感を示す**: 相手の想いや感情に寄り添い、「そうなんですね」「大切にされているんですね」と共感する
3. **相手の言葉から次を紡ぐ**: 定型的な質問は避け、相手が話した言葉の中から自然に次の問いを見つける
4. **問いは自然に生まれる**: 「なぜ？」と聞く前に、まず相手の言葉を丁寧に受け止める

【対話の心得】
- 定型的な質問パターンは使わない
- 相手の言葉を丁寧に受け止め、その中から次の問いを見つける
- 質問する前に、まず共感を示す
- 沈黙を恐れず、相手が考える時間を大切にする
- 相手のペースを最優先に、急がない
- 雑談なので、楽しく、リラックスした雰囲気を大切に

【対話のスタイル】
- 1回の発言は100-200文字程度に抑える
- 相手の言葉をそのまま受け止め、言い換えて確認する
- 「そうなんですね」「なるほど」「面白いですね」など、まず共感する
- 質問は相手の言葉の中から自然に生まれるものだけにする
- 沈黙も対話の一部として大切にする
- フィードバックは真摯に受け止め、改善につなげる姿勢を示す

【今回の目標】
参加者がリラックスして話せ、次回以降のセッションがより良いものになること。
そして、その人自身をより深く理解すること。`
  },

  3: {
    theme: 'あなたはどんな仕事をしている？',
    perspective: 'WE',
    systemPrompt: `あなたは優秀なAIファシリテーターです。温かく、共感的で、相手の本質を引き出すことに長けています。

【今週のテーマ】
「あなたはどんな仕事をしている？」
「WE」（チーム・本部）の視点から、参加者の仕事や役割、組織との関わりを探求します。

【重要な視点】
- **「I」の視点での「WE」**: 組織の中で自分はどう在りたいか、どんな価値を発揮したいか
- **「WE」の視点での「I」**: 組織やチームが大切にしていることと、自分の価値観との関係
- **前週の振り返り**: 1週目で明らかになった個人の価値観を踏まえて対話する

【ファシリテーションの原則】
1. **まず受け止める**: 相手の言葉をそのまま受け止め、評価や判断をせず、ありのままを受け入れる
2. **共感を示す**: 相手の想いや感情に寄り添い、「そうなんですね」「大切にされているんですね」と共感する
3. **相手の言葉から次を紡ぐ**: 定型的な質問は避け、相手が話した言葉の中から自然に次の問いを見つける
4. **問いは自然に生まれる**: 「なぜ？」と聞く前に、まず相手の言葉を丁寧に受け止める。問いは対話の流れから自然に生まれる

【対話の心得】
- 定型的な質問パターンは使わない
- 相手の言葉を丁寧に受け止め、その中から次の問いを見つける
- 質問する前に、まず共感を示す
- 沈黙を恐れず、相手が考える時間を大切にする
- 相手のペースを最優先に、急がない
- 組織の話と個人の話を自然に行き来する
- 前週の内容を自然に参照し、つながりを見出す

【対話のスタイル】
- 1回の発言は100-200文字程度に抑える
- 相手の言葉をそのまま受け止め、言い換えて確認する
- 「そうなんですね」「なるほど」「大切にされているんですね」など、まず共感する
- 質問は相手の言葉の中から自然に生まれるものだけにする
- 「それは1週目でお話しされた〇〇とつながりますね」のように前週の内容を自然に参照する
- 理想と現実のギャップがあれば、それを否定せず一緒に向き合う
- 沈黙も対話の一部として大切にする

【今週の目標】
参加者が、組織の中での自分の役割や価値発揮について、新たな視点を得られること。`
  },
  4: {
    theme: 'あなたの会社について教えてください',
    perspective: 'S',
    systemPrompt: `あなたは優秀なAIファシリテーターです。温かく、共感的で、相手の本質を引き出すことに長けています。

【今週のテーマ】
「あなたの会社について教えてください」
「S」（Society/会社・社会）の視点から、より大きな文脈での自分の位置づけを探求します。

【重要な視点】
- **「I」の視点での「S」**: 会社や社会の中で、自分はどう在りたいか、どんな影響を与えたいか
- **「S」の視点での「I」**: 会社のビジョンや社会的使命と、自分の価値観との関係
- **視座の拡大**: 日常の業務から一歩引いて、より大きな視点で考える
- **これまでの統合**: 1週目、2週目の内容を踏まえて、全体像を描く

【ファシリテーションの原則】
1. **まず受け止める**: 相手の言葉をそのまま受け止め、評価や判断をせず、ありのままを受け入れる
2. **共感を示す**: 相手の想いや感情に寄り添い、「そうなんですね」「大切にされているんですね」と共感する
3. **相手の言葉から次を紡ぐ**: 定型的な質問は避け、相手が話した言葉の中から自然に次の問いを見つける
4. **問いは自然に生まれる**: 「なぜ？」と聞く前に、まず相手の言葉を丁寧に受け止める。問いは対話の流れから自然に生まれる

【対話の心得】
- 定型的な質問パターンは使わない
- 相手の言葉を丁寧に受け止め、その中から次の問いを見つける
- 質問する前に、まず共感を示す
- 沈黙を恐れず、相手が考える時間を大切にする
- 相手のペースを最優先に、急がない
- 日常業務から会社全体、社会へと視野を自然に広げる
- これまでの2週間の内容を自然に参照し、統合を促す

【対話のスタイル】
- 1回の発言は100-200文字程度に抑える
- 相手の言葉をそのまま受け止め、言い換えて確認する
- 「そうなんですね」「なるほど」「大切にされているんですね」など、まず共感する
- 質問は相手の言葉の中から自然に生まれるものだけにする
- 抽象的になりすぎないよう、具体的なエピソードも引き出す
- 理想論だけでなく、現実的な葛藤も丁寧に扱う
- 「1週目では〇〇、2週目では△△とお話しされていましたね」と統合を促す
- 視座を高く持ちつつ、地に足のついた対話を心がける
- 沈黙も対話の一部として大切にする

【今週の目標】
参加者が、会社・社会との関係の中で自分の存在意義や役割について、新たな視点を得られること。`
  },
  5: {
    theme: '統合フェーズ - 1週間内の1個の行動プラン',
    perspective: 'Integration',
    systemPrompt: `あなたは優秀なAIファシリテーターです。温かく、共感的で、相手の本質を引き出すことに長けています。

【今週のテーマ】
「統合フェーズ - 1週間内の1個の行動プラン」
これまでの3週間の対話を統合し、実践的な行動プランを一緒に考えます。

【重要な視点】
- **統合**: 「I」「WE」「S」の3つの視点で見えてきたことを統合する
- **折り合い**: 個人のWBと組織・社会のWBの折り合いをつける
- **実践性**: 1週間以内に実行できる、具体的で現実的な行動を考える
- **主体性**: 相手の主体性を尊重し、押し付けない

【ファシリテーションの原則】
1. **まず受け止める**: 相手の言葉をそのまま受け止め、評価や判断をせず、ありのままを受け入れる
2. **共感を示す**: 相手の想いや感情に寄り添い、「そうなんですね」「大切にされているんですね」と共感する
3. **相手の言葉から次を紡ぐ**: 定型的な質問は避け、相手が話した言葉の中から自然に次の問いを見つける
4. **問いは自然に生まれる**: 「なぜ？」と聞く前に、まず相手の言葉を丁寧に受け止める。問いは対話の流れから自然に生まれる
5. **応援と信頼**: 相手の可能性を信じ、温かく応援する

【対話の心得】
- 定型的な質問パターンは使わない
- 相手の言葉を丁寧に受け止め、その中から次の問いを見つける
- 質問する前に、まず共感を示す
- 沈黙を恐れず、相手が考える時間を大切にする
- 相手のペースを最優先に、急がない
- これまでの3週間を自然に振り返り、統合を促す
- 行動プランは相手が自分で決めることを大切にする
- 小さな一歩を大切にし、完璧を求めない

【対話のスタイル】
- 1回の発言は100-200文字程度に抑える
- 相手の言葉をそのまま受け止め、言い換えて確認する
- 「そうなんですね」「なるほど」「大切にされているんですね」など、まず共感する
- 質問は相手の言葉の中から自然に生まれるものだけにする
- これまでの3週間の内容を適切に参照し、つなげる
- 相手のペースを尊重し、急がない
- 行動プランは相手が自分で決めることを大切にする
- 完璧を求めず、小さな一歩を大切にする姿勢を示す
- 温かく、希望を持てる雰囲気で締めくくる
- 沈黙も対話の一部として大切にする

【今週の目標】
参加者が、これまでの気づきを統合し、自分なりの小さな行動プランを見出せること。
そして、これからの一歩に希望を持てること。`
  }
};

// 占いプロンプト生成関数
function getFortunePrompt(fortuneType, userInfo) {
  const fortuneName = fortuneTypes[fortuneType];

  return `
【占いモード: ${fortuneName}】

あなたは${fortuneName}の専門家でもあります。
参加者: ${userInfo.userName}

占いの進め方:
1. 必要な情報を自然に聞く
2. ${fortuneName}の手法に基づいて分析
3. 結果を分かりやすく、前向きに伝える
4. 仕事や人生に活かせる気づきを提供
5. 占いはあくまで自己理解のツールとして扱う

重要: 
- 断定的な表現は避け、「〜かもしれません」「〜の傾向があります」という柔らかい表現を使う
- ネガティブな結果も、成長の機会として前向きに伝える
- 占いを楽しみながらも、自己理解を深めることを重視する
- 専門的すぎる用語は避け、分かりやすく説明する
`;
}

// セッション開始エンドポイント
app.post('/api/session/start', (req, res) => {
  const { userId, userName, priorInfo, conversationMode = 'standard', sessionLength = 'medium' } = req.body;
  const week = parseInt(req.body.week, 10); // 文字列から整数に変換

  const sessionId = `${userId}_week${week}_${Date.now()}`;

  // 過去のセッション情報を取得
  const pastSessions = [];
  for (let w = 1; w < week; w++) {
    const pastSessionKey = Array.from(sessions.keys()).find(key =>
      key.startsWith(`${userId}_week${w}_`)
    );
    if (pastSessionKey) {
      pastSessions.push(sessions.get(pastSessionKey));
    }
  }

  console.log(`Session start requested: week=${week}, type=${typeof week}, weeklyConfig keys=${Object.keys(weeklyConfig).join(', ')}`);
  
  const config = weeklyConfig[week];

  // 週の設定が見つからない場合のエラーハンドリング
  if (!config) {
    console.error(`週 ${week} の設定が見つかりません`);
    return res.status(400).json({ 
      error: `週 ${week} の設定が見つかりません。有効な週: ${Object.keys(weeklyConfig).join(', ')}` 
    });
  }

  let systemMessage = config.systemPrompt;

  // 会話モードの調整を追加
  const modeConfig = conversationModes[conversationMode];
  if (modeConfig && modeConfig.modifier) {
    systemMessage += modeConfig.modifier;
  }

  // セッション長さの調整を追加
  const lengthConfig = sessionLengths[sessionLength];
  if (lengthConfig && lengthConfig.modifier) {
    systemMessage += lengthConfig.modifier;
  }

  // 事前情報があれば追加
  if (priorInfo) {
    systemMessage += `\n\n【参加者の事前情報】\n${priorInfo}`;
  }

  // 過去のセッション情報があれば追加
  if (pastSessions.length > 0) {
    systemMessage += '\n\n【これまでのセッション要約】\n';
    pastSessions.forEach(session => {
      if (session.summary) {
        systemMessage += `第${session.week}週: ${session.summary}\n`;
      }
    });
  }

  const sessionData = {
    sessionId,
    userId,
    userName: userName || '参加者',
    week,
    theme: config.theme,
    perspective: config.perspective,
    conversationMode,
    sessionLength,
    targetMinutes: lengthConfig.targetMinutes,
    messages: [
      { role: 'system', content: systemMessage }
    ],
    createdAt: new Date().toISOString(),
    summary: null
  };

  sessions.set(sessionId, sessionData);
  saveSessionToFile(sessionId, sessionData);

  res.json({
    sessionId,
    week,
    theme: config.theme,
    perspective: config.perspective,
    conversationMode,
    sessionLength,
    targetMinutes: lengthConfig.targetMinutes
  });
});

// メッセージ送信エンドポイント
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'セッションが見つかりません' });
  }

  // ユーザーメッセージを追加
  session.messages.push({ role: 'user', content: message });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: session.messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = completion.choices[0].message.content;

    // アシスタントメッセージを追加
    session.messages.push({ role: 'assistant', content: assistantMessage });

    // 自動保存
    saveSessionToFile(sessionId, session);

    res.json({
      message: assistantMessage,
      messageCount: session.messages.length - 1 // システムメッセージを除く
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ error: 'AI応答の生成に失敗しました' });
  }
});

// 最初の挨拶を取得
app.post('/api/chat/greeting', async (req, res) => {
  const { sessionId } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'セッションが見つかりません' });
  }

  const greetingPrompt = `セッションを開始してください。${session.userName}さんへの挨拶と、今週のテーマ「${session.theme}」について簡単に説明し、最初の質問をしてください。`;

  session.messages.push({ role: 'user', content: greetingPrompt });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: session.messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = completion.choices[0].message.content;

    // プロンプトを削除してアシスタントメッセージのみ保持
    session.messages.pop();
    session.messages.push({ role: 'assistant', content: assistantMessage });

    res.json({
      message: assistantMessage
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ error: 'AI応答の生成に失敗しました' });
  }
});

// セッション終了・要約生成
app.post('/api/session/end', async (req, res) => {
  const { sessionId } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'セッションが見つかりません' });
  }

  try {
    // 要約を生成
    const summaryMessages = [
      ...session.messages,
      {
        role: 'user',
        content: '今回のセッションの内容を200文字程度で要約してください。参加者の価値観、大切にしていること、気づきなどをまとめてください。'
      }
    ];

    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: summaryMessages,
      temperature: 0.5,
      max_tokens: 300,
    });

    session.summary = summaryCompletion.choices[0].message.content;

    // 記事を生成
    const articleMessages = [
      ...session.messages,
      {
        role: 'user',
        content: `今回のセッションの内容を、読みやすく、心に残る記事形式にまとめてください。
参加者が後で読み返したときに、セッションでの気づきや大切なことを思い出せるようにしてください。

以下の形式でお願いします：

# タイトル（セッションの核心を表す、温かく前向きなタイトル）

## 今週のテーマ
${session.theme}（${session.perspective}の視点）

## 対話のハイライト
このセッションで特に印象的だった対話や気づきを3-5項目で紹介してください。
- 参加者の言葉を大切にし、具体的なエピソードを含める
- 「なぜ？」を掘り下げた部分や、新たな気づきがあった瞬間を捉える
- 箇条書きまたは小見出しで整理

## ${session.userName}さんの大切にしていること
このセッションで明らかになった価値観、大切にしていること、想いをまとめてください。
- 抽象的な言葉だけでなく、具体的な表現も含める
- 参加者の言葉をできるだけそのまま活かす
- 前週との繋がりがあれば言及する

## 気づきと発見
セッションを通じて得られた新たな視点や気づきをまとめてください。
- 参加者自身が発見したこと
- 対話の中で見えてきたパターンや傾向
- 今後に活かせそうな洞察

## 次への一歩
今後に向けてのヒントや、考えてみたいことを提案してください。
- 押し付けがましくなく、優しく提案する
- 次週のセッション（あれば）への期待を込める
- 温かく、希望を持てる言葉で締めくくる

**トーン**: 温かく、共感的で、前向き。参加者を応援する気持ちを込めて。`
      }
    ];

    const articleCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: articleMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const article = articleCompletion.choices[0].message.content;

    // イメージを生成
    let imageUrl = null;
    let localImagePath = null;
    try {
      const imagePrompt = generateImagePrompt(session.week, session.perspective, session.theme);
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      imageUrl = imageResponse.data[0].url;

      // 一時URLから画像をダウンロードしてローカルに保存
      try {
        localImagePath = await downloadAndSaveImage(imageUrl, session.sessionId);
        console.log('Image saved locally:', localImagePath);
      } catch (downloadError) {
        console.error('Image download error:', downloadError);
        // ダウンロードに失敗した場合は一時URLを使用
        localImagePath = imageUrl;
      }
    } catch (imageError) {
      console.error('Image generation error:', imageError);
      // イメージ生成に失敗しても記事は返す
    }

    // イメージを記事に埋め込む（ローカルパスを使用）
    let finalArticle = article;
    const displayImageUrl = localImagePath || imageUrl;
    if (displayImageUrl) {
      // タイトルの後にイメージを挿入
      const lines = article.split('\n');
      const titleIndex = lines.findIndex(line => line.startsWith('# '));
      if (titleIndex !== -1) {
        lines.splice(titleIndex + 1, 0, '', `![セッションのイメージ](${displayImageUrl})`, '');
        finalArticle = lines.join('\n');
      }
    }

    // レポートをセッションデータに保存
    session.article = finalArticle;
    session.summary = session.summary; // 既に保存済み
    session.completedAt = new Date().toISOString();
    session.isCompleted = true;
    session.imageUrl = displayImageUrl;

    // ファイルに保存
    saveSessionToFile(sessionId, session);

    res.json({
      summary: session.summary,
      article: finalArticle,
      week: session.week,
      theme: session.theme,
      imageUrl: displayImageUrl
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ error: '要約の生成に失敗しました' });
  }
});

// イメージ生成用のプロンプトを生成
function generateImagePrompt(week, perspective, theme) {
  const baseStyle = "Soft, warm, minimalist illustration with gentle colors and abstract shapes. Peaceful and inspiring atmosphere.";

  const weekPrompts = {
    1: `${baseStyle} A serene scene representing personal values and well-being. Show a peaceful figure in contemplation, surrounded by soft light and abstract symbols of personal growth. Warm pastel colors, gentle gradients. Focus on introspection and self-discovery.`,
    2: `${baseStyle} A harmonious scene showing connection between individual and team. Abstract representation of collaboration and roles within an organization. Soft interconnected shapes, warm colors suggesting belonging and contribution.`,
    3: `${baseStyle} An expansive scene representing company and society. Abstract cityscape or organizational structure with a human element. Broader perspective, showing connection to larger purpose. Inspiring and hopeful atmosphere.`,
    4: `${baseStyle} An integrative scene showing a journey coming together. Abstract path or bridge connecting different elements. Warm, hopeful colors suggesting forward movement and new beginnings. Symbols of small steps and growth.`
  };

  return weekPrompts[week] || weekPrompts[1];
}

// 画像をダウンロードしてローカルに保存する関数
async function downloadAndSaveImage(imageUrl, sessionId) {
  return new Promise((resolve, reject) => {
    const filename = `session_${sessionId}_${Date.now()}.png`;
    const filepath = path.join(imagesDir, filename);
    const file = fs.createWriteStream(filepath);

    https.get(imageUrl, (response) => {
      // リダイレクトに対応
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (redirectedResponse) => {
          redirectedResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(`/images/${filename}`);
          });
        }).on('error', (err) => {
          fs.unlink(filepath, () => { }); // ファイルを削除
          reject(err);
        });
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(`/images/${filename}`);
        }).on('error', (err) => {
          fs.unlink(filepath, () => { }); // ファイルを削除
          reject(err);
        });
      }
    }).on('error', (err) => {
      fs.unlink(filepath, () => { }); // ファイルを削除
      reject(err);
    });
  });
}

// 占術一覧取得
app.get('/api/fortune-types', (req, res) => {
  res.json(fortuneTypes);
});

// 占術設定（複数対応）
app.post('/api/session/set-fortune', (req, res) => {
  const { sessionId, fortuneTypes: selectedFortunes } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'セッションが見つかりません' });
  }

  // 複数の占術に対応
  const fortuneArray = Array.isArray(selectedFortunes) ? selectedFortunes : [selectedFortunes];

  // 各占術のプロンプトを追加
  fortuneArray.forEach(fortuneType => {
    const fortunePrompt = getFortunePrompt(fortuneType, {
      userName: session.userName
    });

    session.messages.push({
      role: 'system',
      content: fortunePrompt
    });
  });

  session.fortuneTypes = fortuneArray;
  saveSessionToFile(sessionId, session);

  res.json({ success: true, selectedFortunes: fortuneArray });
});

// お任せ占い
app.post('/api/session/omakase-fortune', async (req, res) => {
  const { sessionId } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'セッションが見つかりません' });
  }

  // AIに占術を選んでもらうプロンプト
  const omakasePrompt = `
【お任せ占いモード】

参加者が「お任せ占い」を選びました。
以下の占術の中から、これまでの対話や参加者の状況を踏まえて、
最も適切だと思われる2〜3種類の占術を選んでください。

利用可能な占術:
${Object.entries(fortuneTypes).map(([key, name]) => `- ${name}`).join('\n')}

選んだ占術とその理由を簡潔に説明してから、占いを始めてください。
例: 「あなたには西洋占星術とタロット占いが良さそうです。なぜなら...」
`;

  session.messages.push({
    role: 'system',
    content: omakasePrompt
  });

  session.fortuneMode = 'omakase';
  saveSessionToFile(sessionId, session);

  res.json({ success: true, mode: 'omakase' });
});

// 既存セッションチェック
app.get('/api/session/check/:userId/:week', (req, res) => {
  const { userId, week } = req.params;

  const existingSession = findUserWeekSessions(userId, parseInt(week));

  if (existingSession) {
    res.json({
      exists: true,
      sessionId: existingSession.sessionId,
      week: existingSession.week,
      theme: existingSession.theme,
      conversationMode: existingSession.conversationMode,
      sessionLength: existingSession.sessionLength,
      messageCount: existingSession.messages.length - 1,
      createdAt: existingSession.createdAt,
      lastSavedAt: existingSession.lastSavedAt
    });
  } else {
    res.json({ exists: false });
  }
});

// セッション再開
app.post('/api/session/resume', (req, res) => {
  const { sessionId } = req.body;

  // メモリから取得を試みる
  let session = sessions.get(sessionId);

  // メモリになければファイルから読み込む
  if (!session) {
    session = loadSessionFromFile(sessionId);
    if (session) {
      sessions.set(sessionId, session);
    }
  }

  if (!session) {
    return res.status(404).json({ error: 'セッションが見つかりません' });
  }

  res.json({
    sessionId: session.sessionId,
    week: session.week,
    theme: session.theme,
    perspective: session.perspective,
    article: session.article,
    summary: session.summary,
    completedAt: session.completedAt,
    imageUrl: session.imageUrl,
    sessionId: session.sessionId
  });
});

// セッション手動保存
app.post('/api/session/save', (req, res) => {
  const { sessionId } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'セッションが見つかりません' });
  }

  saveSessionToFile(sessionId, session);

  res.json({
    success: true,
    lastSavedAt: new Date().toISOString()
  });
});

// セッション一覧取得
app.get('/api/sessions/:userId', (req, res) => {
  const { userId } = req.params;

  const userSessions = Array.from(sessions.entries())
    .filter(([key]) => key.startsWith(userId))
    .map(([, value]) => ({
      sessionId: value.sessionId,
      week: value.week,
      theme: value.theme,
      createdAt: value.createdAt,
      summary: value.summary,
      messageCount: value.messages.length - 1
    }));

  res.json(userSessions);
});

// セッションレポート取得
app.get('/api/session/report/:userId/:week', (req, res) => {
  const { userId, week } = req.params;
  const weekNum = parseInt(week, 10);

  console.log(`Report requested: userId=${userId}, week=${weekNum}`);

  // ファイルから完了したセッションを検索
  const session = findUserWeekSessions(userId, weekNum);

  if (!session) {
    console.log('Session not found in files, checking memory...');
    // メモリからも検索
    const memorySession = Array.from(sessions.values()).find(
      s => s.userId === userId && s.week === weekNum && s.isCompleted
    );
    
    if (!memorySession) {
      return res.status(404).json({ error: 'レポートが見つかりません' });
    }
    
    return res.json({
      article: memorySession.article,
      summary: memorySession.summary,
      theme: memorySession.theme,
      week: memorySession.week,
      imageUrl: memorySession.imageUrl,
      completedAt: memorySession.completedAt
    });
  }

  // 完了していないセッションの場合
  if (!session.isCompleted || !session.article) {
    return res.status(404).json({ error: 'このセッションはまだ完了していません' });
  }

  res.json({
    article: session.article,
    summary: session.summary,
    theme: session.theme,
    week: session.week,
    imageUrl: session.imageUrl,
    completedAt: session.completedAt
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AIファシリテーションシステムが起動しました: http://localhost:${PORT}`);
});

