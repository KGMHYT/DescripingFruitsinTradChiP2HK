const fruits = [
  { name: "士多啤梨", emoji: "🍓", color: "紅色", taste: "甜甜酸酸", shape: "心形", pair: ["紅", "甜"] },
  { name: "香蕉", emoji: "🍌", color: "黃色", taste: "香甜", shape: "彎彎的", pair: ["香", "甜"] },
  { name: "橙", emoji: "🍊", color: "橙色", taste: "甜甜酸酸", shape: "圓形", pair: ["多汁", "酸甜"] },
  { name: "蘋果", emoji: "🍎", color: "紅色", taste: "清甜", shape: "圓形", pair: ["爽脆", "清甜"] },
  { name: "奇異果", emoji: "🥝", color: "啡色外皮、綠色果肉", taste: "酸甜", shape: "橢圓形", pair: ["酸甜", "多汁"] },
  { name: "提子", emoji: "🍇", color: "紫色", taste: "香甜", shape: "一粒粒", pair: ["紫", "甜"] },
];

const levels = [
  { id: 1, title: "水果認一認", detail: "看圖找水果，熱身一下", skill: "認讀水果名稱" },
  { id: 2, title: "特徵配一配", detail: "找出水果的顏色和味道", skill: "描述顏色和味道" },
  { id: 3, title: "小小介紹員", detail: "選詞組句，介紹心水水果", skill: "用完整句子介紹" },
  { id: 4, title: "又……又……句子隊", detail: "用兩個特徵說好一句話", skill: "運用「又……又……」句式" },
  { id: 5, title: "神秘水果猜猜看", detail: "聽特徵，猜猜藏起來的水果", skill: "根據特徵推想水果" },
  { id: 6, title: "倒數水果挑戰", detail: "限時猜水果，也可選擇不限時", skill: "在自選節奏下綜合運用特徵" },
];

const game = document.querySelector("#game");
const speechToggle = document.querySelector("#sound-toggle");
let currentLevel = 1;
let questionIndex = 0;
let score = 0;
let questions = [];
let answerLocked = false;
let speechEnabled = true;
let recognition = null;
let timerInterval = null;
let timeLimitSeconds = 0;
let remainingSeconds = 0;
let timerPaused = false;
let timeExpired = false;

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function speak(text) {
  if (!speechEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const cantoneseVoice = window.speechSynthesis.getVoices().find((voice) => /^zh[-_]hk(?:$|[-_])/i.test(voice.lang));
  const notice = document.querySelector("#speech-notice");
  if (!cantoneseVoice) {
    notice.hidden = false;
    notice.textContent = "此裝置未找到香港粵語聲線；你可以閱讀螢幕文字作答。";
    return;
  }
  notice.hidden = true;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-HK";
  utterance.rate = 0.85;
  utterance.voice = cantoneseVoice;
  window.speechSynthesis.speak(utterance);
}

function homeScreen() {
  stopTimer();
  game.innerHTML = `
    <section class="screen" aria-labelledby="welcome-title">
      <p class="eyebrow">🍎 水果檔開門了！</p>
      <h1 id="welcome-title" tabindex="-1">水果形容小達人</h1>
      <p class="intro">認識水果的名字、顏色和味道，再用「又……又……」介紹它，最後挑戰猜神秘水果。揀一個適合自己的關卡吧！</p>
      <h2>選擇一個關卡</h2>
      <div class="level-grid">${levels.map((level) => `
        <button class="level-button" type="button" data-level="${level.id}">
          <span><span class="level-number">第 ${level.id} 關</span><span class="level-title">${level.title}</span></span>
          <span class="level-detail">${level.detail}</span>
        </button>`).join("")}
      </div>
      <p class="quiet-note">每關四題。第六關可選倒數或不限時；遇到難題可以重聽，答錯也可以再試。</p>
    </section>`;
  game.querySelectorAll("[data-level]").forEach((button) => button.addEventListener("click", () => {
    const levelId = Number(button.dataset.level);
    if (levelId === 6) renderTimeModeScreen();
    else startLevel(levelId);
  }));
  game.querySelector("#welcome-title").focus();
  speak("歡迎來到水果形容小達人。請選擇一個關卡開始。");
}

function buildQuestions(levelId) {
  const picked = shuffle(fruits).slice(0, 4);
  if (levelId === 1) return picked.map((fruit) => ({ fruit, prompt: `邊個係${fruit.name}？`, correct: fruit.name }));
  if (levelId === 2) return picked.map((fruit) => {
    const property = Math.random() > 0.45 ? "color" : "taste";
    const label = property === "color" ? "顏色" : "味道";
    return { fruit, prompt: `${fruit.name}通常係咩${label}？`, correct: fruit[property], property };
  });
  if (levelId === 3) return picked.map((fruit) => ({ fruit, prompt: `完成句子，介紹${fruit.name}。`, correct: fruit.name }));
  if (levelId === 4) return picked.map((fruit) => ({
    fruit,
    prompt: `用「又……又……」形容${fruit.name}，選一句合適的句子。`,
    correct: `${fruit.name}又${fruit.pair[0]}又${fruit.pair[1]}。`,
  }));
  return picked.map((fruit) => ({
    fruit,
    prompt: `我又${fruit.pair[0]}又${fruit.pair[1]}，你估我係邊種水果？`,
    correct: fruit.name,
    mystery: true,
  }));
}

function answerOptions(question) {
  if (currentLevel === 1) return shuffle([question.fruit, ...shuffle(fruits.filter((fruit) => fruit.name !== question.fruit.name)).slice(0, 2)]);
  if (currentLevel === 4) {
    const distractors = shuffle(fruits.filter((fruit) => fruit !== question.fruit).map((fruit) => `${fruit.name}又${fruit.pair[0]}又${fruit.pair[1]}。`)).slice(0, 2);
    return shuffle([question.correct, ...distractors]);
  }
  if (currentLevel >= 5) return shuffle([question.correct, ...shuffle(fruits.filter((fruit) => fruit !== question.fruit).map((fruit) => fruit.name)).slice(0, 2)]);
  const pool = currentLevel === 2
    ? [...new Set(fruits.map((fruit) => fruit[question.property]))]
    : [question.fruit.color, question.fruit.taste, question.fruit.shape];
  const distractors = shuffle(pool.filter((option) => option !== question.correct)).slice(0, 2);
  return shuffle([question.correct, ...distractors]);
}

function startLevel(levelId, seconds = 0) {
  stopTimer();
  currentLevel = levelId;
  questionIndex = 0;
  score = 0;
  answerLocked = false;
  timeExpired = false;
  questions = buildQuestions(levelId);
  if (levelId === 6 && seconds > 0) startTimer(seconds);
  renderQuestion();
}

function renderTimeModeScreen() {
  stopTimer();
  game.innerHTML = `
    <section class="screen" aria-labelledby="time-mode-title">
      <p class="eyebrow">第 6 關・進階挑戰</p>
      <h1 id="time-mode-title" tabindex="-1">選擇你的答題節奏</h1>
      <p class="intro">倒數只供自選挑戰，沒有懲罰；也可以選不限時，慢慢觀察和作答。</p>
      <div class="mode-grid">
        <button class="level-button mode-button" type="button" data-seconds="120"><span class="level-title">⏱ 2 分鐘</span><span class="level-detail">悠閒倒數挑戰</span></button>
        <button class="level-button mode-button" type="button" data-seconds="90"><span class="level-title">⚡ 1 分 30 秒</span><span class="level-detail">進階倒數挑戰</span></button>
        <button class="level-button mode-button" type="button" data-seconds="0"><span class="level-title">不限時</span><span class="level-detail">按自己的節奏完成</span></button>
      </div>
      <div class="button-row"><button class="secondary-button" id="back-home" type="button">← 返回選關</button></div>
    </section>`;
  game.querySelectorAll("[data-seconds]").forEach((button) => button.addEventListener("click", () => startLevel(6, Number(button.dataset.seconds))));
  game.querySelector("#back-home").addEventListener("click", homeScreen);
  game.querySelector("#time-mode-title").focus();
}

function stopTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerPaused = false;
  timeLimitSeconds = 0;
  remainingSeconds = 0;
}

function startTimer(seconds) {
  timeLimitSeconds = seconds;
  remainingSeconds = seconds;
  timerInterval = window.setInterval(() => {
    if (timerPaused) return;
    remainingSeconds -= 1;
    updateTimerDisplay();
    if (remainingSeconds <= 0) expireTimer();
  }, 1000);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function updateTimerDisplay() {
  const clock = game.querySelector("#countdown");
  if (!clock) return;
  clock.textContent = formatTime(remainingSeconds);
  clock.setAttribute("aria-label", `剩餘時間 ${Math.floor(remainingSeconds / 60)} 分 ${remainingSeconds % 60} 秒`);
}

function toggleTimer() {
  timerPaused = !timerPaused;
  const button = game.querySelector("#timer-toggle");
  button.textContent = timerPaused ? "繼續" : "暫停";
  button.setAttribute("aria-pressed", String(timerPaused));
}

function expireTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  answerLocked = true;
  timeExpired = true;
  recognition?.abort();
  game.querySelectorAll(".answer-button, .sentence-builder select, #check-sentence, #voice-input, #timer-toggle").forEach((control) => { control.disabled = true; });
  setFeedback(`時間到！你已答對 ${score} 題。`, false);
  game.querySelector("#hint").textContent = "你可以看看成績，亦可選不限時再挑戰。";
  const resultButton = document.createElement("button");
  resultButton.className = "primary-button";
  resultButton.type = "button";
  resultButton.textContent = "看看成績 →";
  resultButton.addEventListener("click", renderResult);
  game.querySelector("#feedback").insertAdjacentElement("afterend", resultButton);
  resultButton.focus();
  speak("時間到，你已完成這次水果挑戰。");
}

function renderQuestion() {
  if (questionIndex >= questions.length) return renderResult();
  answerLocked = false;
  const question = questions[questionIndex];
  const level = levels[currentLevel - 1];
  const options = answerOptions(question);
  const timerPanel = currentLevel === 6 ? `<div class="timer-panel">
    <div class="timer-readout"><span>剩餘時間</span><span id="countdown" role="timer" aria-live="off" aria-label="${timeLimitSeconds ? `剩餘時間 ${Math.floor(remainingSeconds / 60)} 分 ${remainingSeconds % 60} 秒` : "不限時"}">${timeLimitSeconds ? formatTime(remainingSeconds) : "不限時"}</span></div>
    ${timeLimitSeconds ? `<button class="timer-toggle" id="timer-toggle" type="button" aria-pressed="false">暫停</button>` : ""}
  </div>` : "";
  const hint = currentLevel === 1 ? "小提示：先看看水果的樣子，再讀讀名稱。"
    : currentLevel === 2 ? "小提示：想一想你見過這種水果嗎？"
      : currentLevel === 3 ? "小提示：選好水果、顏色和味道，再朗讀句子。"
        : currentLevel === 4 ? "小提示：讀一讀兩個特徵，試用「又……又……」連起來。"
          : "小提示：根據兩個特徵，想一想是哪種水果。";
  game.innerHTML = `
    <section class="screen" aria-labelledby="question-title">
      <div class="game-topline">
        <span class="progress-label">第 ${currentLevel} 關：${level.title}　・　${questionIndex + 1} / ${questions.length}</span>
        <div class="game-status"><div class="progress-track" role="progressbar" aria-label="答題進度" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${questionIndex}"><div class="progress-fill" style="width:${questionIndex / questions.length * 100}%"></div></div>${timerPanel}</div>
      </div>
      <div class="prompt-box"><div class="prompt-row"><h2 id="question-title" tabindex="-1">${question.prompt}</h2><button class="listen-button" type="button" aria-label="重聽題目" title="重聽題目">🔊</button></div></div>
      ${question.mystery ? `<div class="mystery-fruit" aria-hidden="true"><span>？</span><span>神秘水果</span></div>` : ""}
      ${currentLevel === 3 ? renderSentenceBuilder(question) : `<div class="answers" role="group" aria-label="選擇答案">${options.map((option) => {
        const label = currentLevel === 1 ? option.name : option;
        const emoji = currentLevel === 1 ? `<span class="answer-emoji" aria-hidden="true">${option.emoji}</span>` : "";
        return `<button class="answer-button" type="button" data-answer="${label}">${emoji}<span>${label}</span></button>`;
      }).join("")}</div>`}
      <p class="feedback" id="feedback" role="status" aria-live="polite"></p>
      <p class="hint-text" id="hint">${hint}</p>
      <div class="button-row"><button class="secondary-button" id="back-home" type="button">← 返回選關</button></div>
    </section>`;
  game.querySelector(".listen-button").addEventListener("click", () => speak(question.prompt));
  game.querySelector("#back-home").addEventListener("click", homeScreen);
  game.querySelector("#timer-toggle")?.addEventListener("click", toggleTimer);
  game.querySelectorAll("[data-answer]").forEach((button) => button.addEventListener("click", () => checkAnswer(button.dataset.answer, question.correct)));
  if (currentLevel === 3) setupSentenceBuilder(question);
  game.querySelector("#question-title").focus();
  speak(question.prompt);
}

function renderSentenceBuilder(question) {
  const colorOptions = [...new Set(fruits.map((fruit) => fruit.color))];
  const tasteOptions = [...new Set(fruits.map((fruit) => fruit.taste))];
  return `<div class="sentence-builder">
    <label class="select-label" for="fruit-choice">水果
      <select id="fruit-choice"><option value="">選水果</option>${fruits.map((fruit) => `<option value="${fruit.name}">${fruit.emoji} ${fruit.name}</option>`).join("")}</select>
    </label>
    <label class="select-label" for="color-choice">顏色
      <select id="color-choice"><option value="">選顏色</option>${colorOptions.map((color) => `<option value="${color}">${color}</option>`).join("")}</select>
    </label>
    <label class="select-label" for="taste-choice">味道
      <select id="taste-choice"><option value="">選味道</option>${tasteOptions.map((taste) => `<option value="${taste}">${taste}</option>`).join("")}</select>
    </label>
  </div>
  <p class="sentence-preview" id="sentence-preview" aria-live="polite">我想介紹＿＿。它是＿＿色，味道＿＿。</p>
  <div class="button-row">
    <button class="primary-button" id="check-sentence" type="button">✓ 完成介紹</button>
    <button class="mic-button" id="voice-input" type="button" aria-pressed="false">🎙️ 用語音回答</button>
  </div>
  <p class="voice-status" id="voice-status" role="status" aria-live="polite">也可以用上面的選單組句，不一定要說話。</p>`;
}

function setupSentenceBuilder(question) {
  const fruitChoice = game.querySelector("#fruit-choice");
  const colorChoice = game.querySelector("#color-choice");
  const tasteChoice = game.querySelector("#taste-choice");
  const preview = game.querySelector("#sentence-preview");
  const updateSentence = () => {
    const fruit = fruitChoice.value || "＿＿";
    const color = colorChoice.value || "＿＿";
    const taste = tasteChoice.value || "＿＿";
    preview.textContent = `我想介紹${fruit}。它是${color}，味道${taste}。`;
  };
  [fruitChoice, colorChoice, tasteChoice].forEach((select) => select.addEventListener("change", updateSentence));
  game.querySelector("#check-sentence").addEventListener("click", () => {
    if (!fruitChoice.value || !colorChoice.value || !tasteChoice.value) {
      setFeedback("再選好水果、顏色和味道，就完成了！", false);
      return;
    }
    const correct = fruitChoice.value === question.fruit.name && colorChoice.value === question.fruit.color && tasteChoice.value === question.fruit.taste;
    speak(preview.textContent);
    checkAnswer(correct ? question.fruit.name : "", question.fruit.name);
  });
  game.querySelector("#voice-input").addEventListener("click", startVoiceInput);
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const status = game.querySelector("#voice-status");
  if (!SpeechRecognition) {
    status.textContent = "這部裝置未提供語音輸入，請用選單組句。";
    return;
  }
  recognition?.abort();
  recognition = new SpeechRecognition();
  recognition.lang = "zh-HK";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  const button = game.querySelector("#voice-input");
  button.setAttribute("aria-pressed", "true");
  status.textContent = "請開始說話……";
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    status.textContent = `聽到：「${transcript}」已填入水果選單。`;
    const fruit = fruits.find((item) => transcript.includes(item.name));
    if (fruit) {
      game.querySelector("#fruit-choice").value = fruit.name;
      game.querySelector("#color-choice").value = fruit.color;
      game.querySelector("#taste-choice").value = fruit.taste;
      game.querySelector("#sentence-preview").textContent = `我想介紹${fruit.name}。它是${fruit.color}，味道${fruit.taste}。`;
    } else {
      status.textContent += " 可以再試一次，或直接使用選單。";
    }
  };
  recognition.onerror = () => { status.textContent = "未能辨認語音，可以再試或使用選單。"; };
  recognition.onend = () => button.setAttribute("aria-pressed", "false");
  try { recognition.start(); } catch { status.textContent = "語音輸入未能啟動，請使用選單。"; button.setAttribute("aria-pressed", "false"); }
}

function setFeedback(message, correct) {
  const feedback = game.querySelector("#feedback");
  feedback.textContent = message;
  feedback.className = `feedback ${correct ? "good" : "try-again"}`;
}

function checkAnswer(answer, correctAnswer) {
  if (answerLocked) return;
  if (answer !== correctAnswer) {
    setFeedback("差一點點！再想一想，或者重聽題目。", false);
    speak("差一點點，再試一次。");
    return;
  }
  answerLocked = true;
  score += 1;
  setFeedback("答對了！你觀察得真仔細。", true);
  speak("答對了，你觀察得真仔細。");
  game.querySelectorAll("button.answer-button").forEach((button) => { button.disabled = true; });
  game.querySelectorAll(".sentence-builder select, #check-sentence, #voice-input").forEach((control) => { control.disabled = true; });
  recognition?.abort();
  game.querySelector("#hint").textContent = "準備好後，按「下一題」繼續。";
  const nextButton = document.createElement("button");
  nextButton.className = "primary-button";
  nextButton.type = "button";
  nextButton.textContent = questionIndex === questions.length - 1 ? "看看成績 →" : "下一題 →";
  nextButton.addEventListener("click", () => { questionIndex += 1; renderQuestion(); });
  game.querySelector("#feedback").insertAdjacentElement("afterend", nextButton);
  nextButton.focus();
}

function renderResult() {
  stopTimer();
  const level = levels[currentLevel - 1];
  const message = timeExpired ? `時間到！你答對 ${score} 題，下次再試也可以。` : score === 4 ? "四題全中！你是水果小專家！" : score >= 2 ? "做得好！你認識更多水果特徵了。" : "謝謝你的努力，再玩一次會更熟悉！";
  game.innerHTML = `
    <section class="screen result-layout" aria-labelledby="result-title">
      <div>
        <p class="eyebrow">🎉 關卡完成</p>
        <h1 id="result-title" tabindex="-1">${message}</h1>
        <p class="intro">你完成了「${level.title}」，練習了${level.skill}。</p>
        <div class="medal-row" aria-label="獲得水果徽章">${"🍊".repeat(Math.max(1, Math.ceil(score / 2)))}</div>
        <div class="button-row">
          <button class="primary-button" id="play-again" type="button">再玩一次 ↻</button>
          <button class="secondary-button" id="choose-level" type="button">選另一關</button>
        </div>
      </div>
      <div class="result-score" aria-label="四題答對 ${score} 題">${score} / 4</div>
    </section>`;
  game.querySelector("#play-again").addEventListener("click", () => startLevel(currentLevel));
  game.querySelector("#choose-level").addEventListener("click", homeScreen);
  game.querySelector("#result-title").focus();
  speak(timeExpired ? `時間到，你答對四題中的${score}題。` : `關卡完成，你答對四題中的${score}題。`);
}

document.querySelector("#read-help").addEventListener("click", () => speak("選擇一個關卡。每關有四題，不限時間。你可以重聽題目，答錯也可以再試。"));
document.querySelector("#text-size").addEventListener("click", () => {
  const enlarged = document.body.classList.toggle("large-text");
  document.querySelector("#text-size").setAttribute("aria-label", enlarged ? "切換標準文字" : "切換較大文字");
});
speechToggle.addEventListener("click", () => {
  speechEnabled = !speechEnabled;
  speechToggle.textContent = speechEnabled ? "語音開" : "語音關";
  speechToggle.setAttribute("aria-pressed", String(speechEnabled));
  speechToggle.setAttribute("aria-label", speechEnabled ? "關閉語音朗讀" : "開啟語音朗讀");
  if (!speechEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
});

homeScreen();