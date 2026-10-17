const fruits = [
  { name: "士多啤梨", emoji: "🍓", color: "紅色", taste: "甜甜酸酸", shape: "心形" },
  { name: "香蕉", emoji: "🍌", color: "黃色", taste: "香甜", shape: "彎彎的" },
  { name: "橙", emoji: "🍊", color: "橙色", taste: "甜甜酸酸", shape: "圓形" },
  { name: "蘋果", emoji: "🍎", color: "紅色", taste: "清甜", shape: "圓形" },
  { name: "奇異果", emoji: "🥝", color: "啡色外皮、綠色果肉", taste: "酸甜", shape: "橢圓形" },
  { name: "提子", emoji: "🍇", color: "紫色", taste: "香甜", shape: "一粒粒" },
];

const levels = [
  { id: 1, title: "水果認一認", detail: "看圖找水果，熱身一下", skill: "認讀水果名稱" },
  { id: 2, title: "特徵配一配", detail: "找出水果的顏色和味道", skill: "描述顏色和味道" },
  { id: 3, title: "小小介紹員", detail: "選詞組句，介紹心水水果", skill: "用完整句子介紹" },
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

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function speak(text) {
  if (!speechEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-HK";
  utterance.rate = 0.85;
  const cantoneseVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase() === "zh-hk");
  if (cantoneseVoice) utterance.voice = cantoneseVoice;
  window.speechSynthesis.speak(utterance);
}

function homeScreen() {
  game.innerHTML = `
    <section class="screen" aria-labelledby="welcome-title">
      <p class="eyebrow">🍎 水果檔開門了！</p>
      <h1 id="welcome-title" tabindex="-1">水果形容小達人</h1>
      <p class="intro">認識水果的名字、顏色和味道，再用一句完整句子介紹它。揀一個適合自己的挑戰開始吧！</p>
      <h2>選擇一個關卡</h2>
      <div class="level-grid">${levels.map((level) => `
        <button class="level-button" type="button" data-level="${level.id}">
          <span><span class="level-number">第 ${level.id} 關</span><span class="level-title">${level.title}</span></span>
          <span class="level-detail">${level.detail}</span>
        </button>`).join("")}
      </div>
      <p class="quiet-note">每關四題，不計時。遇到難題可以重聽，答錯也可以再試。</p>
    </section>`;
  game.querySelectorAll("[data-level]").forEach((button) => button.addEventListener("click", () => startLevel(Number(button.dataset.level))));
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
  return picked.map((fruit) => ({ fruit, prompt: `完成句子，介紹${fruit.name}。`, correct: fruit.name }));
}

function answerOptions(question) {
  if (currentLevel === 1) return shuffle([question.fruit, ...shuffle(fruits.filter((fruit) => fruit.name !== question.fruit.name)).slice(0, 2)]);
  const pool = currentLevel === 2
    ? [...new Set(fruits.map((fruit) => fruit[question.property]))]
    : [question.fruit.color, question.fruit.taste, question.fruit.shape];
  const distractors = shuffle(pool.filter((option) => option !== question.correct)).slice(0, 2);
  return shuffle([question.correct, ...distractors]);
}

function startLevel(levelId) {
  currentLevel = levelId;
  questionIndex = 0;
  score = 0;
  answerLocked = false;
  questions = buildQuestions(levelId);
  renderQuestion();
}

function renderQuestion() {
  if (questionIndex >= questions.length) return renderResult();
  answerLocked = false;
  const question = questions[questionIndex];
  const level = levels[currentLevel - 1];
  const options = answerOptions(question);
  game.innerHTML = `
    <section class="screen" aria-labelledby="question-title">
      <div class="game-topline">
        <span class="progress-label">第 ${currentLevel} 關：${level.title}　・　${questionIndex + 1} / ${questions.length}</span>
        <div class="progress-track" role="progressbar" aria-label="答題進度" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${questionIndex}"><div class="progress-fill" style="width:${questionIndex * 25}%"></div></div>
      </div>
      <div class="prompt-box"><div class="prompt-row"><h2 id="question-title" tabindex="-1">${question.prompt}</h2><button class="listen-button" type="button" aria-label="重聽題目" title="重聽題目">🔊</button></div></div>
      ${currentLevel === 3 ? renderSentenceBuilder(question) : `<div class="answers" role="group" aria-label="選擇答案">${options.map((option) => {
        const label = currentLevel === 1 ? option.name : option;
        const emoji = currentLevel === 1 ? `<span class="answer-emoji" aria-hidden="true">${option.emoji}</span>` : "";
        return `<button class="answer-button" type="button" data-answer="${label}">${emoji}<span>${label}</span></button>`;
      }).join("")}</div>`}
      <p class="feedback" id="feedback" role="status" aria-live="polite"></p>
      <p class="hint-text" id="hint">${currentLevel === 1 ? "小提示：先看看水果的樣子，再讀讀名稱。" : currentLevel === 2 ? "小提示：想一想你見過這種水果嗎？" : "小提示：選好水果、顏色和味道，再朗讀句子。"}</p>
      <div class="button-row"><button class="secondary-button" id="back-home" type="button">← 返回選關</button></div>
    </section>`;
  game.querySelector(".listen-button").addEventListener("click", () => speak(question.prompt));
  game.querySelector("#back-home").addEventListener("click", homeScreen);
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
  const level = levels[currentLevel - 1];
  const message = score === 4 ? "四題全中！你是水果小專家！" : score >= 2 ? "做得好！你認識更多水果特徵了。" : "謝謝你的努力，再玩一次會更熟悉！";
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
  speak(`關卡完成，你答對四題中的${score}題。`);
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