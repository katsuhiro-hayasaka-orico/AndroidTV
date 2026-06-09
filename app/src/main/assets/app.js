const timeElement = document.getElementById('time');
const dateElement = document.getElementById('date');
const weekdayElement = document.getElementById('weekday');
const monthTitleElement = document.getElementById('monthTitle');
const calendarElement = document.getElementById('calendar');
const displayElement = document.getElementById('display');

let renderedCalendarKey = '';
let minuteTimerId;

function pad(value) {
    return String(value).padStart(2, '0');
}

function updateClock() {
    const now = new Date();
    timeElement.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    dateElement.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    weekdayElement.textContent = new Intl.DateTimeFormat('ja-JP', { weekday: 'long' }).format(now);

    const calendarKey = `${now.getFullYear()}-${now.getMonth()}`;
    if (calendarKey !== renderedCalendarKey) {
        renderCalendar(now);
        renderedCalendarKey = calendarKey;
    } else {
        highlightToday(now);
    }
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

updateClock();
scheduleNextMinuteTick();
nudgeDisplay();
window.setInterval(nudgeDisplay, 6 * 60 * 1000);
