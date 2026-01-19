const startHourSelect = document.getElementById("start-hour");
const startMinuteSelect = document.getElementById("start-minute");
const endHourSelect = document.getElementById("end-hour");
const endMinuteSelect = document.getElementById("end-minute");
const workDurationInput = document.getElementById("work-duration");
const restDurationInput = document.getElementById("rest-duration");
const startButton = document.getElementById("start-button");
const resetButton = document.getElementById("reset-button");
const pauseButton = document.getElementById("pause-button");

const phaseLabel = document.getElementById("phase-label");
const countdownEl = document.getElementById("countdown");
const hintEl = document.getElementById("hint");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const timeWindow = document.getElementById("time-window");

let timerId = null;
let schedule = null;
let audioContext = null;
let isPaused = false;
let pausedAt = null;

const pad = (value) => value.toString().padStart(2, "0");

const buildOptions = (select, max, defaultValue) => {
  select.innerHTML = "";
  for (let i = 0; i <= max; i += 1) {
    const option = document.createElement("option");
    option.value = i.toString();
    option.textContent = pad(i);
    if (i === defaultValue) {
      option.selected = true;
    }
    select.appendChild(option);
  }
};

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const formatTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const getTodayTime = (hour, minute) => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  return date;
};

const createSchedule = () => {
  const startHour = Number(startHourSelect.value);
  const startMinute = Number(startMinuteSelect.value);
  const endHour = Number(endHourSelect.value);
  const endMinute = Number(endMinuteSelect.value);
  const workMinutes = Number(workDurationInput.value) || 30;
  const restMinutes = Number(restDurationInput.value) || 3;

  let startTime = getTodayTime(startHour, startMinute);
  let endTime = getTodayTime(endHour, endMinute);

  if (endTime <= startTime) {
    endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
  }

  return {
    startTime,
    endTime,
    workMinutes,
    restMinutes,
  };
};

const resetTimer = () => {
  if (timerId) {
    clearInterval(timerId);
  }
  timerId = null;
  schedule = null;
  isPaused = false;
  pausedAt = null;
};

const setIdleState = () => {
  phaseLabel.textContent = "尚未开始";
  countdownEl.textContent = "--:--:--";
  hintEl.textContent = "请先设置时间并启动。";
  progressBar.style.width = "0%";
  progressText.textContent = "进度：0%";
  timeWindow.textContent = "--";
  pauseButton.textContent = "中断";
};

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

const beepThreeTimes = () => {
  const context = getAudioContext();
  const startAt = context.currentTime;
  for (let i = 0; i < 3; i += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, startAt + i * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.3, startAt + i * 0.35 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + i * 0.35 + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt + i * 0.35);
    oscillator.stop(startAt + i * 0.35 + 0.22);
  }
};

const updateProgress = (now, startTime, endTime) => {
  const total = endTime - startTime;
  const elapsed = Math.min(Math.max(now - startTime, 0), total);
  const percent = total > 0 ? Math.round((elapsed / total) * 100) : 0;
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `进度：${percent}%`;
  timeWindow.textContent = `${formatTime(startTime)} - ${formatTime(endTime)}`;
};

const runTick = () => {
  if (!schedule) return;
  const now = new Date();
  const { startTime, endTime, workMinutes, restMinutes } = schedule;

  updateProgress(now, startTime, endTime);

  if (now >= endTime) {
    phaseLabel.textContent = "已结束";
    countdownEl.textContent = "00:00:00";
    hintEl.textContent = "本次计时已经结束。";
    if (!schedule.hasEnded) {
      beepThreeTimes();
      schedule.hasEnded = true;
    }
    resetTimer();
    setIdleState();
    resetTimer();
    return;
  }

  if (now < startTime) {
    const remaining = startTime - now;
    phaseLabel.textContent = "等待开始";
    countdownEl.textContent = formatDuration(remaining);
    hintEl.textContent = "距离开始时间倒计时中。";
    return;
  }

  let phaseStart = schedule.phaseStart;
  let phaseEnd = schedule.phaseEnd;
  let phaseType = schedule.phaseType;

  if (!phaseStart || !phaseEnd) {
    phaseStart = new Date(startTime);
    phaseEnd = new Date(startTime.getTime() + workMinutes * 60 * 1000);
    phaseType = "work";
    if (!schedule.hasStarted) {
      beepThreeTimes();
      schedule.hasStarted = true;
    }
  }

  while (now >= phaseEnd) {
    phaseStart = new Date(phaseEnd);
    if (phaseType === "work") {
      beepThreeTimes();
      phaseType = "rest";
      phaseEnd = new Date(phaseStart.getTime() + restMinutes * 60 * 1000);
    } else {
      beepThreeTimes();
      phaseType = "rest";
      phaseEnd = new Date(phaseStart.getTime() + restMinutes * 60 * 1000);
    } else {
      phaseType = "work";
      phaseEnd = new Date(phaseStart.getTime() + workMinutes * 60 * 1000);
    }
    if (phaseStart >= endTime) {
      break;
    }
  }

  schedule.phaseStart = phaseStart;
  schedule.phaseEnd = phaseEnd;
  schedule.phaseType = phaseType;

  const remaining = phaseEnd - now;
  if (phaseType === "work") {
    phaseLabel.textContent = "专注工作中";
    hintEl.textContent = "保持专注，时间到会提示休息。";
  } else {
    phaseLabel.textContent = "休息眼睛中";
    hintEl.textContent = "请放松眼睛，准备下一段工作。";
  }
  countdownEl.textContent = formatDuration(remaining);
};

startButton.addEventListener("click", () => {
  resetTimer();
  schedule = createSchedule();
  runTick();
  timerId = setInterval(runTick, 1000);
});

resetButton.addEventListener("click", () => {
  resetTimer();
  setIdleState();
});

pauseButton.addEventListener("click", () => {
  if (!schedule) return;
  if (isPaused) {
    const now = new Date();
    const delta = now - pausedAt;
    schedule.startTime = new Date(schedule.startTime.getTime() + delta);
    schedule.endTime = new Date(schedule.endTime.getTime() + delta);
    if (schedule.phaseStart) {
      schedule.phaseStart = new Date(schedule.phaseStart.getTime() + delta);
    }
    if (schedule.phaseEnd) {
      schedule.phaseEnd = new Date(schedule.phaseEnd.getTime() + delta);
    }
    isPaused = false;
    pausedAt = null;
    pauseButton.textContent = "中断";
    runTick();
    timerId = setInterval(runTick, 1000);
    return;
  }

  isPaused = true;
  pausedAt = new Date();
  pauseButton.textContent = "恢复";
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  phaseLabel.textContent = "已暂停";
  hintEl.textContent = "计时已中断，点击恢复继续。";
});

buildOptions(startHourSelect, 23, 9);
buildOptions(startMinuteSelect, 59, 0);
buildOptions(endHourSelect, 23, 18);
buildOptions(endMinuteSelect, 59, 0);
setIdleState();
