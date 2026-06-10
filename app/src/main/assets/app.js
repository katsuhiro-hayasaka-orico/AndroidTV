const STORAGE_KEY_CLOCK_MODE = 'minimalTvClock.clockMode';
const STORAGE_KEY_FONT_PRESET = 'minimalTvClock.fontPreset';
const CLOCK_MODES = {
    DIGITAL: 'digital',
    ANALOG: 'analog',
};
const FONT_PRESETS = [
    { id: 'readable', label: 'Readable' },
    { id: 'soft', label: 'Soft' },
    { id: 'handwritten', label: 'Handwritten' },
    { id: 'design', label: 'Design' },
];
// Visual alarm: keeps the existing gradient/intensity-only notification.
const VISUAL_ALARM = {
    enabled: true,
    hour: 17,
    minute: 0,
    leadMinutes: 30,
    fadeOutMinutes: 10,
};

// Sound chime: local, short, modest-volume audio for office use.
// For temporary development checks, add a one-minute-ahead entry here and remove it before release.
const SOUND_CHIME = {
    enabled: true,
    audioSource: 'audio/chime.mp3',
    volume: 0.32,
    toastDurationMs: 2500,
    times: [
        { hour: 9, minute: 20, label: '09:20' },
        { hour: 11, minute: 30, label: '11:30' },
        { hour: 12, minute: 30, label: '12:30' },
        { hour: 17, minute: 45, label: '17:45' },
    ],
};
const VISUAL_ALARM_UPDATE_INTERVAL_MS = 30 * 1000;
const MINUTE_IN_MS = 60 * 1000;
const DAY_IN_MS = 24 * 60 * MINUTE_IN_MS;
const TIME_FIT_MIN_SCALE = 0.8;

const timeElement = document.getElementById('time');
const monthTitleElement = document.getElementById('monthTitle');
const calendarElement = document.getElementById('calendar');
const displayElement = document.getElementById('display');
const analogClockElement = document.querySelector('.analog-clock');
const hourHandElement = document.getElementById('hourHand');
const minuteHandElement = document.getElementById('minuteHand');
const analogLabelElement = document.getElementById('analogLabel');
const fontToastElement = document.getElementById('fontToast');
const chimeToastElement = document.getElementById('chimeToast');
const chimeAudioElement = document.getElementById('chimeAudio');

let renderedCalendarKey = '';
let minuteTimerId;
let visualAlarmTimerId;
let clockMode = loadClockMode();
let fontPreset = loadFontPreset();
let renderedTimeText = '';
let fontToastTimerId;
let chimeToastTimerId;
let fallbackAudioContext;
let fitDigitalTimeFrameId;
let lastClockToggleAt = Number.NEGATIVE_INFINITY;
let lastPlayedChimeKey = '';

function pad(value) {
    return String(value).padStart(2, '0');
}

function loadClockMode() {
    try {
        const storedMode = window.localStorage.getItem(STORAGE_KEY_CLOCK_MODE);
        if (storedMode === CLOCK_MODES.ANALOG || storedMode === CLOCK_MODES.DIGITAL) {
            return storedMode;
        }
    } catch (error) {
        // localStorage が利用できない環境でも時計表示は継続する。
    }
    return CLOCK_MODES.DIGITAL;
}

function saveClockMode(mode) {
    try {
        window.localStorage.setItem(STORAGE_KEY_CLOCK_MODE, mode);
    } catch (error) {
        // 保存できない場合も一時的な切り替えは維持する。
    }
}

function isFontPresetId(presetId) {
    return FONT_PRESETS.some((preset) => preset.id === presetId);
}

function getFontPresetLabel(presetId) {
    const preset = FONT_PRESETS.find((item) => item.id === presetId);
    return preset ? preset.label : FONT_PRESETS[0].label;
}

function loadFontPreset() {
    try {
        const storedPreset = window.localStorage.getItem(STORAGE_KEY_FONT_PRESET);
        if (isFontPresetId(storedPreset)) {
            return storedPreset;
        }
    } catch (error) {
        // localStorage が利用できない環境でも既定プリセットで表示する。
    }
    return FONT_PRESETS[0].id;
}

function saveFontPreset(presetId) {
    try {
        window.localStorage.setItem(STORAGE_KEY_FONT_PRESET, presetId);
    } catch (error) {
        // 保存できない場合も一時的な切り替えは維持する。
    }
}

function applyFontPreset(presetId, shouldAnnounce = false) {
    const nextPreset = isFontPresetId(presetId) ? presetId : FONT_PRESETS[0].id;
    fontPreset = nextPreset;
    displayElement.setAttribute('data-font-preset', nextPreset);
    saveFontPreset(nextPreset);

    scheduleFitDigitalTime();

    if (shouldAnnounce) {
        showFontToast(nextPreset);
    }
}

function cycleFontPreset(direction) {
    const currentIndex = FONT_PRESETS.findIndex((preset) => preset.id === fontPreset);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + FONT_PRESETS.length) % FONT_PRESETS.length;
    applyFontPreset(FONT_PRESETS[nextIndex].id, true);
}

function showFontToast(presetId) {
    window.clearTimeout(fontToastTimerId);
    fontToastElement.textContent = `Font: ${getFontPresetLabel(presetId)}`;
    fontToastElement.classList.add('is-visible');
    fontToastElement.setAttribute('aria-hidden', 'false');

    fontToastTimerId = window.setTimeout(() => {
        fontToastElement.classList.remove('is-visible');
        fontToastElement.setAttribute('aria-hidden', 'true');
    }, 2000);
}

function normalizeClockMode(mode) {
    return mode === CLOCK_MODES.ANALOG ? CLOCK_MODES.ANALOG : CLOCK_MODES.DIGITAL;
}

function applyClockMode(mode) {
    const nextMode = normalizeClockMode(mode);
    const isDigitalMode = nextMode === CLOCK_MODES.DIGITAL;

    clockMode = nextMode;
    displayElement.classList.remove('is-digital', 'is-analog');
    displayElement.classList.add(isDigitalMode ? 'is-digital' : 'is-analog');
    displayElement.setAttribute('data-clock-mode', nextMode);

    timeElement.hidden = !isDigitalMode;
    timeElement.setAttribute('aria-hidden', String(!isDigitalMode));

    if (analogClockElement) {
        analogClockElement.hidden = isDigitalMode;
        analogClockElement.setAttribute('aria-hidden', String(isDigitalMode));
    }
    analogLabelElement.setAttribute('aria-hidden', String(isDigitalMode));

    if (isDigitalMode) {
        scheduleFitDigitalTime();
    }

    saveClockMode(nextMode);
}

function getMonotonicNow() {
    return window.performance ? window.performance.now() : Date.now();
}

function toggleClockMode() {
    const now = getMonotonicNow();
    if (now - lastClockToggleAt < 250) {
        return;
    }

    lastClockToggleAt = now;
    const nextMode = clockMode === CLOCK_MODES.DIGITAL ? CLOCK_MODES.ANALOG : CLOCK_MODES.DIGITAL;
    applyClockMode(nextMode);
}

function updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    updateVisualAlarm(now);
    updateSoundChime(now);
    renderDigitalTime(`${pad(hours)}:${pad(minutes)}`);
    updateAnalogClock(hours, minutes);

    const calendarKey = `${now.getFullYear()}-${now.getMonth()}`;
    if (calendarKey !== renderedCalendarKey) {
        renderCalendar(now);
        renderedCalendarKey = calendarKey;
    } else {
        highlightToday(now);
    }
}

function renderDigitalTime(timeText) {
    if (timeText === renderedTimeText) {
        return;
    }

    const timeCharacters = Array.from(timeText, (character) => {
        const span = document.createElement('span');
        span.classList.add('time-char');
        span.textContent = character;

        if (character === ':') {
            span.classList.add('colon');
        } else {
            span.classList.add('digit', `digit-${character}`);
        }

        return span;
    });

    timeElement.replaceChildren(...timeCharacters);
    timeElement.setAttribute('aria-label', timeText);
    renderedTimeText = timeText;
    scheduleFitDigitalTime();
}

function fitDigitalTime() {
    const parentElement = timeElement.parentElement;
    if (!parentElement) {
        return;
    }

    timeElement.style.setProperty('--time-fit-scale', '1');
    const availableWidth = parentElement.clientWidth;
    const requiredWidth = timeElement.scrollWidth;
    if (availableWidth <= 0 || requiredWidth <= 0) {
        return;
    }

    const nextScale = Math.max(TIME_FIT_MIN_SCALE, Math.min(1, availableWidth / requiredWidth));
    timeElement.style.setProperty('--time-fit-scale', nextScale.toFixed(3));
}

function scheduleFitDigitalTime() {
    window.cancelAnimationFrame(fitDigitalTimeFrameId);
    fitDigitalTimeFrameId = window.requestAnimationFrame(() => {
        fitDigitalTime();
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(fitDigitalTime);
        }
    });
}

function updateAnalogClock(hours, minutes) {
    const hourDegrees = ((hours % 12) * 30) + (minutes * 0.5);
    const minuteDegrees = minutes * 6;
    hourHandElement.style.transform = `translateX(-50%) rotate(${hourDegrees}deg)`;
    minuteHandElement.style.transform = `translateX(-50%) rotate(${minuteDegrees}deg)`;
    analogLabelElement.textContent = `${hours}時${pad(minutes)}分`;
}


function createChimeKey(now, chimeTime) {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${chimeTime.label}`;
}

function findMatchingChimeTime(now) {
    if (!SOUND_CHIME.enabled) {
        return null;
    }

    const hours = now.getHours();
    const minutes = now.getMinutes();
    return SOUND_CHIME.times.find((chimeTime) => chimeTime.hour === hours && chimeTime.minute === minutes) || null;
}

function updateSoundChime(now) {
    const chimeTime = findMatchingChimeTime(now);
    if (!chimeTime) {
        return;
    }

    const chimeKey = createChimeKey(now, chimeTime);
    if (chimeKey === lastPlayedChimeKey) {
        return;
    }

    lastPlayedChimeKey = chimeKey;
    playChime(chimeTime.label);
}

function initializeChimeAudio() {
    if (!chimeAudioElement) {
        return;
    }

    chimeAudioElement.volume = SOUND_CHIME.volume;
    if (!chimeAudioElement.getAttribute('src')) {
        chimeAudioElement.setAttribute('src', SOUND_CHIME.audioSource);
    }
}

function playChime(label) {
    if (!SOUND_CHIME.enabled) {
        return;
    }

    showChimeToast(label);

    if (!chimeAudioElement) {
        playFallbackChime(label);
        return;
    }

    try {
        chimeAudioElement.pause();
        chimeAudioElement.currentTime = 0;
        chimeAudioElement.volume = SOUND_CHIME.volume;

        const playPromise = chimeAudioElement.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((error) => {
                console.warn(`Local chime audio failed (${label}). Falling back to generated chime.`, error);
                playFallbackChime(label);
            });
        }
    } catch (error) {
        console.warn(`Local chime audio could not start (${label}). Falling back to generated chime.`, error);
        playFallbackChime(label);
    }
}

function showChimeToast(label) {
    if (!chimeToastElement) {
        return;
    }

    window.clearTimeout(chimeToastTimerId);
    chimeToastElement.textContent = `Chime ${label}`;
    chimeToastElement.classList.add('is-visible');
    chimeToastElement.setAttribute('aria-hidden', 'false');

    chimeToastTimerId = window.setTimeout(() => {
        chimeToastElement.classList.remove('is-visible');
        chimeToastElement.setAttribute('aria-hidden', 'true');
    }, SOUND_CHIME.toastDurationMs);
}

function getFallbackAudioContext() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
        return null;
    }

    if (!fallbackAudioContext) {
        fallbackAudioContext = new AudioContextConstructor();
    }

    if (fallbackAudioContext.state === 'suspended' && fallbackAudioContext.resume) {
        fallbackAudioContext.resume().catch((error) => {
            console.warn('Generated chime audio context could not resume.', error);
        });
    }

    return fallbackAudioContext;
}

function scheduleFallbackTone(audioContext, destination, frequency, startTime, duration) {
    const oscillator = audioContext.createOscillator();
    const overtone = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const overtoneGain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(frequency * 2, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(SOUND_CHIME.volume * 0.38, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    overtoneGain.gain.setValueAtTime(0.0001, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(SOUND_CHIME.volume * 0.07, startTime + 0.02);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.72);

    oscillator.connect(gain).connect(destination);
    overtone.connect(overtoneGain).connect(destination);

    oscillator.start(startTime);
    overtone.start(startTime);
    oscillator.stop(startTime + duration + 0.04);
    overtone.stop(startTime + duration + 0.04);
}

function playFallbackChime(label) {
    try {
        const audioContext = getFallbackAudioContext();
        if (!audioContext) {
            console.warn(`Generated chime unavailable (${label}): Web Audio API is not supported.`);
            return;
        }

        const masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(1, audioContext.currentTime);
        masterGain.connect(audioContext.destination);

        const startTime = audioContext.currentTime + 0.04;
        const melody = [659.25, 523.25, 587.33, 392.0];
        melody.forEach((frequency, index) => {
            scheduleFallbackTone(audioContext, masterGain, frequency, startTime + (index * 0.34), 0.28);
        });

        window.setTimeout(() => {
            try {
                masterGain.disconnect();
            } catch (error) {
                // 接続解除に失敗しても時計表示には影響させない。
            }
        }, 1800);
    } catch (error) {
        console.warn(`Generated chime failed (${label}).`, error);
    }
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function smoothStep(value) {
    const clampedValue = clamp(value, 0, 1);
    return clampedValue * clampedValue * (3 - (2 * clampedValue));
}

function createVisualAlarmTargetDate(referenceDate, dayOffset) {
    const targetDate = new Date(referenceDate);
    targetDate.setHours(VISUAL_ALARM.hour, VISUAL_ALARM.minute, 0, 0);
    targetDate.setTime(targetDate.getTime() + (dayOffset * DAY_IN_MS));
    return targetDate;
}

function getVisualAlarmState(now) {
    if (!VISUAL_ALARM.enabled) {
        return { intensity: 0, phase: 'idle' };
    }

    const leadDuration = Math.max(0, VISUAL_ALARM.leadMinutes) * MINUTE_IN_MS;
    const fadeOutDuration = Math.max(0, VISUAL_ALARM.fadeOutMinutes) * MINUTE_IN_MS;
    const activeHoldDuration = VISUAL_ALARM_UPDATE_INTERVAL_MS;

    for (let dayOffset = -1; dayOffset <= 1; dayOffset += 1) {
        const targetDate = createVisualAlarmTargetDate(now, dayOffset);
        const targetTime = targetDate.getTime();
        const nowTime = now.getTime();
        const approachStart = targetTime - leadDuration;
        const cooldownEnd = targetTime + fadeOutDuration;

        if (leadDuration > 0 && nowTime >= approachStart && nowTime < targetTime) {
            return {
                intensity: smoothStep((nowTime - approachStart) / leadDuration),
                phase: 'approaching',
            };
        }

        if (nowTime >= targetTime && nowTime < targetTime + activeHoldDuration) {
            return { intensity: 1, phase: 'active' };
        }

        if (fadeOutDuration > 0 && nowTime >= targetTime + activeHoldDuration && nowTime <= cooldownEnd) {
            return {
                intensity: 1 - smoothStep((nowTime - targetTime) / fadeOutDuration),
                phase: 'cooldown',
            };
        }
    }

    return { intensity: 0, phase: 'idle' };
}

function updateVisualAlarm(now) {
    const { intensity, phase } = getVisualAlarmState(now);
    const safeIntensity = clamp(intensity, 0, 1);
    document.documentElement.style.setProperty('--alarm-intensity', safeIntensity.toFixed(3));
    displayElement.setAttribute('data-alarm-phase', phase);
}

function scheduleVisualAlarmUpdates() {
    window.clearInterval(visualAlarmTimerId);
    visualAlarmTimerId = window.setInterval(() => {
        updateVisualAlarm(new Date());
    }, VISUAL_ALARM_UPDATE_INTERVAL_MS);
}

function scheduleNextMinuteTick() {
    window.clearTimeout(minuteTimerId);
    const now = new Date();
    const millisecondsUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    minuteTimerId = window.setTimeout(() => {
        updateClock();
        scheduleNextMinuteTick();
    }, millisecondsUntilNextMinute);
}

function renderCalendar(referenceDate) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    renderMonthTitle(year, month + 1);
    calendarElement.textContent = '';

    for (let i = 0; i < firstDay.getDay(); i += 1) {
        calendarElement.appendChild(createCalendarCell('', true));
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
        const cell = createCalendarCell(day, false);
        cell.dataset.day = String(day);
        calendarElement.appendChild(cell);
    }

    highlightToday(referenceDate);
}

function createMonthTitlePart(className, text) {
    const part = document.createElement('span');
    part.className = className;
    part.textContent = text;
    return part;
}

function renderMonthTitle(year, displayMonth) {
    monthTitleElement.replaceChildren(
        createMonthTitlePart('calendar-title-number', String(year)),
        createMonthTitlePart('calendar-title-unit', '年'),
        createMonthTitlePart('calendar-title-spacer', ' '),
        createMonthTitlePart('calendar-title-number', String(displayMonth)),
        createMonthTitlePart('calendar-title-unit', '月')
    );
}

function createCalendarCell(label, isEmpty) {
    const cell = document.createElement('span');
    cell.className = isEmpty ? 'calendar-day is-empty' : 'calendar-day';
    if (isEmpty) {
        cell.setAttribute('aria-hidden', 'true');
        return cell;
    }

    const number = document.createElement('span');
    number.className = 'calendar-number';
    number.textContent = label;
    cell.appendChild(number);
    return cell;
}

function highlightToday(now) {
    const today = String(now.getDate());
    const cells = calendarElement.querySelectorAll('.calendar-day[data-day]');
    cells.forEach((cell) => {
        const isToday = cell.dataset.day === today;
        cell.classList.toggle('is-today', isToday);
        if (isToday) {
            cell.setAttribute('aria-label', `今日 ${today}日`);
        } else {
            cell.removeAttribute('aria-label');
        }
    });
}

function nudgeDisplay() {
    const maxOffset = 14;
    const x = Math.round((Math.random() * 2 - 1) * maxOffset);
    const y = Math.round((Math.random() * 2 - 1) * maxOffset);
    displayElement.style.transform = `translate(${x}px, ${y}px)`;
}

window.toggleClockModeFromAndroid = toggleClockMode;
window.cycleFontPresetFromAndroid = cycleFontPreset;
window.playTestChime = () => playChime('test');

function handleClockModeKey(event) {
    const isDecisionKey = event.key === 'Enter'
        || event.key === 'NumpadEnter'
        || event.code === 'Enter'
        || event.code === 'NumpadEnter'
        || event.keyCode === 13
        || event.keyCode === 23;
    const isNextFontKey = event.key === 'ArrowRight'
        || event.code === 'ArrowRight'
        || event.keyCode === 39
        || event.keyCode === 22;
    const isPreviousFontKey = event.key === 'ArrowLeft'
        || event.code === 'ArrowLeft'
        || event.keyCode === 37
        || event.keyCode === 21;

    if (isDecisionKey) {
        event.preventDefault();
        if (event.repeat) {
            return;
        }
        toggleClockMode();
        return;
    }

    if (isNextFontKey || isPreviousFontKey) {
        event.preventDefault();
        cycleFontPreset(isNextFontKey ? 1 : -1);
    }
}

initializeChimeAudio();
applyFontPreset(fontPreset);
applyClockMode(clockMode);
updateClock();
scheduleNextMinuteTick();
scheduleVisualAlarmUpdates();
nudgeDisplay();
window.setInterval(nudgeDisplay, 6 * 60 * 1000);
window.addEventListener('resize', scheduleFitDigitalTime);
document.addEventListener('keydown', handleClockModeKey);
