const STORAGE_KEY_CLOCK_MODE = 'minimalTvClock.clockMode';
const CLOCK_MODES = {
    DIGITAL: 'digital',
    ANALOG: 'analog',
};

const timeElement = document.getElementById('time');
const dateElement = document.getElementById('date');
const weekdayElement = document.getElementById('weekday');
const monthTitleElement = document.getElementById('monthTitle');
const calendarElement = document.getElementById('calendar');
const displayElement = document.getElementById('display');
const hourHandElement = document.getElementById('hourHand');
const minuteHandElement = document.getElementById('minuteHand');
const analogLabelElement = document.getElementById('analogLabel');

let renderedCalendarKey = '';
let minuteTimerId;
let clockMode = loadClockMode();
let renderedTimeText = '';

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

function applyClockMode(mode) {
    clockMode = mode;
    displayElement.classList.toggle('is-digital', mode === CLOCK_MODES.DIGITAL);
    displayElement.classList.toggle('is-analog', mode === CLOCK_MODES.ANALOG);
    displayElement.setAttribute('data-clock-mode', mode);
    timeElement.setAttribute('aria-hidden', String(mode !== CLOCK_MODES.DIGITAL));
    analogLabelElement.setAttribute('aria-hidden', String(mode !== CLOCK_MODES.ANALOG));
    saveClockMode(mode);
}

function toggleClockMode() {
    const nextMode = clockMode === CLOCK_MODES.DIGITAL ? CLOCK_MODES.ANALOG : CLOCK_MODES.DIGITAL;
    applyClockMode(nextMode);
}

function updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    renderDigitalTime(`${pad(hours)}:${pad(minutes)}`);
    dateElement.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    weekdayElement.textContent = new Intl.DateTimeFormat('ja-JP', { weekday: 'long' }).format(now);
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
}

function updateAnalogClock(hours, minutes) {
    const hourDegrees = ((hours % 12) * 30) + (minutes * 0.5);
    const minuteDegrees = minutes * 6;
    hourHandElement.style.transform = `translateX(-50%) rotate(${hourDegrees}deg)`;
    minuteHandElement.style.transform = `translateX(-50%) rotate(${minuteDegrees}deg)`;
    analogLabelElement.textContent = `${hours}時${pad(minutes)}分`;
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

    monthTitleElement.textContent = `${year}年 ${month + 1}月`;
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

function createCalendarCell(label, isEmpty) {
    const cell = document.createElement('span');
    cell.className = isEmpty ? 'calendar-day is-empty' : 'calendar-day';
    cell.textContent = label;
    if (isEmpty) {
        cell.setAttribute('aria-hidden', 'true');
    }
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

function handleClockModeKey(event) {
    const isDecisionKey = event.key === 'Enter'
        || event.key === 'NumpadEnter'
        || event.code === 'Enter'
        || event.code === 'NumpadEnter'
        || event.keyCode === 13
        || event.keyCode === 23;

    if (!isDecisionKey) {
        return;
    }

    event.preventDefault();
    toggleClockMode();
}

applyClockMode(clockMode);
updateClock();
scheduleNextMinuteTick();
nudgeDisplay();
window.setInterval(nudgeDisplay, 6 * 60 * 1000);
document.addEventListener('keydown', handleClockModeKey);
