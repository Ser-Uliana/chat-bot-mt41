'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/* ============================== ТИПИ ============================== */

interface Student { id: string; name: string }
/** Ключ: `${YYYY-MM-DD}|${studentId}|${pair}` */
type AbsenceMap = Record<string, true>;
interface DayInfo { iso: string; label: string; weekday: string; pairs: number[] }
interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
  auth_date: number;
  hash: string;
  [key: string]: string | number | undefined;
}

/* ============================== КОНФІГ ============================== */

const colors = {
  khaki: '#B6AA9A',
  chineseWhite: '#E6E6DA',
  lavenderGray: '#C2C5CE',
  electricBlue: '#566777',
  chocolate: '#520100',
} as const;

const GROUP_NAME = 'МТ-41';
const STORAGE_KEY = 'mt41-attendance-v2';
const SESSION_KEY = 'mt41-editor-session';
const SESSION_TTL_MS = 60 * 60 * 1000; // доступ до редагування на 1 годину
const PAIRS_BY_WEEKDAY = [4, 4, 4, 4, 3]; // Пн–Пт
const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? '';

const STAFF: [string, string][] = [
  ['Староста', 'Серібна Уляна Тарасівна'],
  ['Куратор групи', 'Підкуймуха Тетяна Ігорівна'],
  ['Завідувач відділення', 'Полець Марія-Вікторія Ярославівна'],
];

/* ============================== ДАНІ ============================== */

const studentNames = [
  'Баран Наталія Андріївна',
  'Бойко Владислав Романович',
  'Гладкий Андрій Олегович',
  'Гнида Владислав Олегович',
  'Грачов Степан Сергійович',
  'Грень Святослав Михайлович',
  'Гриньків Соломія Іванівна',
  'Домчак Любомир Тарасович',
  'Євсєєв Владислав Андрійович',
  'Єднак Деніс',
  'Зелений Василь Васильович',
  'Качмарик Андрій Олегович',
  'Коваль Олег Володимирович',
  'Курбаленко Юрій Русланович',
  'Кутний Данило Андрійович',
  'Кушнір Ростислав Андрійович',
  'Мартинець Олег Володимирович',
  'Маслійович Станіслав Тарасович',
  'Піган Артур Ярославович',
  'Ревура Роман Романович',
  'Сас Олег Андрійович',
  'Сербіна Уляна Тарасівна',
  'Столяр Олег Володимирович',
  'Тиліпський Роман Євгенович',
  'Тонкопій Андрій Віталійович',
  'Черновол Марія Романівна',
  'Щелконогова Катерина Євгенівна',
];
const students: Student[] = studentNames.map((name, i) => ({ id: `s${i + 1}`, name }));

const D1 = '2026-11-09'; // Понеділок
const D2 = '2026-11-10'; // Вівторок
// studentId -> { дата: [пари] } (з документа за 09.11 і 10.11)
const seedRaw: Record<string, Record<string, number[]>> = {
  s2: { [D1]: [1] },
  s3: { [D1]: [2] },
  s4: { [D1]: [1, 2], [D2]: [1] },
  s5: { [D1]: [1, 2], [D2]: [1, 2] },
  s6: { [D2]: [1] },
  s8: { [D1]: [1, 2], [D2]: [1, 2] },
  s9: { [D1]: [1, 2], [D2]: [1, 2] },
  s10: { [D1]: [1, 2], [D2]: [1] },
  s12: { [D2]: [1] },
  s13: { [D1]: [2], [D2]: [1, 2] },
  s14: { [D1]: [1, 2] },
  s15: { [D1]: [2], [D2]: [1, 2] },
  s17: { [D2]: [1] },
  s18: { [D1]: [1, 2], [D2]: [1, 2] },
  s19: { [D1]: [1, 2], [D2]: [1, 2] },
  s21: { [D2]: [1] },
  s23: { [D2]: [1, 2] },
  s24: { [D1]: [1, 2], [D2]: [1, 2] },
  s25: { [D1]: [1, 2], [D2]: [1, 2] },
  s26: { [D1]: [1, 2], [D2]: [1] },
};

/* ============================== УТИЛІТИ ============================== */

const absenceKey = (iso: string, studentId: string, pair: number) => `${iso}|${studentId}|${pair}`;

const seedAbsences: AbsenceMap = Object.entries(seedRaw).reduce<AbsenceMap>((acc, [id, days]) => {
  for (const [iso, pairs] of Object.entries(days)) for (const p of pairs) acc[absenceKey(iso, id, p)] = true;
  return acc;
}, {});

const countForStudent = (map: AbsenceMap, studentId: string, isoDates: string[]) =>
  Object.keys(map).filter((k) => {
    const [iso, id] = k.split('|');
    return id === studentId && isoDates.includes(iso);
  }).length;

const latestDate = (map: AbsenceMap): string | null => {
  const dates = Object.keys(map).map((k) => k.split('|')[0]).sort();
  return dates.length ? dates[dates.length - 1] : null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
};
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

function buildWeek(monday: Date): DayInfo[] {
  const fmt = new Intl.DateTimeFormat('uk-UA', { weekday: 'long' });
  return PAIRS_BY_WEEKDAY.map((count, i) => {
    const date = addDays(monday, i);
    const name = fmt.format(date);
    return {
      iso: toIso(date),
      label: `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`,
      weekday: name.charAt(0).toUpperCase() + name.slice(1),
      pairs: Array.from({ length: count }, (_, k) => k + 1),
    };
  });
}

/* Перевірка Telegram — на сервері (src/app/api/auth/telegram) */
async function postAllowed(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    return Boolean((await res.json()).allowed);
  } catch {
    return false;
  }
}
const checkTelegram = (user: TelegramUser) => postAllowed('/api/auth/telegram', user);

const saveSession = () => sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL_MS));
const clearSession = () => sessionStorage.removeItem(SESSION_KEY);
const hasSession = () => Number(sessionStorage.getItem(SESSION_KEY) ?? 0) > Date.now();

/* ============================== ХУКИ ============================== */

function useAttendance() {
  const [absences, setAbsences] = useState<AbsenceMap>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as AbsenceMap) : seedAbsences;
    } catch {
      return seedAbsences;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(absences));
  }, [absences]);

  const toggle = useCallback((iso: string, studentId: string, pair: number) => {
    setAbsences((prev) => {
      const key = absenceKey(iso, studentId, pair);
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }, []);

  return { absences, toggle };
}

function useAuth() {
  const [isEditor, setIsEditor] = useState(hasSession);

  const grant = () => {
    saveSession();
    setIsEditor(true);
  };
  const loginWithTelegram = useCallback(async (user: TelegramUser) => {
    const ok = await checkTelegram(user);
    if (ok) grant();
    return ok;
  }, []);
  const logout = useCallback(() => {
    clearSession();
    setIsEditor(false);
  }, []);

  return { isEditor, loginWithTelegram, logout };
}

/* ============================== КОМПОНЕНТИ ============================== */

function GlobalStyles() {
  return (
    <style>{`
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; background: ${colors.chineseWhite}; color: ${colors.electricBlue}; }
      button { font-family: inherit; }
      button:focus-visible, input:focus-visible { outline: 3px solid ${colors.electricBlue}; outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
    `}</style>
  );
}

/* ---- Клітинка нб ---- */
function AbsenceCell(props: { absent: boolean; editable: boolean; firstOfDay: boolean; label: string; onToggle: () => void }) {
  const { absent, editable, firstOfDay, label, onToggle } = props;
  const tdStyle: CSSProperties = {
    ...cellStyles.td,
    borderLeft: firstOfDay ? `3px solid ${colors.khaki}` : `1px solid ${colors.lavenderGray}`,
    background: absent ? colors.chocolate : 'transparent',
  };
  return (
    <td style={tdStyle}>
      {editable ? (
        <button
          type="button"
          style={{ ...cellStyles.button, color: absent ? colors.chineseWhite : 'transparent' }}
          aria-pressed={absent}
          aria-label={label}
          onClick={onToggle}
        >
          н
        </button>
      ) : (
        <span style={{ ...cellStyles.static, color: colors.chineseWhite }}>{absent ? 'н' : ''}</span>
      )}
    </td>
  );
}
const cellStyles: Record<string, CSSProperties> = {
  td: { width: 40, minWidth: 40, height: 38, padding: 0, textAlign: 'center' },
  button: { width: '100%', height: '100%', minHeight: 38, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: 700 },
  static: { display: 'block', fontSize: 15, fontWeight: 700 },
};

/* ---- Рядок студента ---- */
function StudentRow(props: {
  index: number;
  student: Student;
  days: DayInfo[];
  absences: AbsenceMap;
  editable: boolean;
  onToggle: (iso: string, studentId: string, pair: number) => void;
}) {
  const { index, student, days, absences, editable, onToggle } = props;
  const total = countForStudent(absences, student.id, days.map((d) => d.iso));
  const even = index % 2 === 0;

  return (
    <tr style={{ background: even ? 'transparent' : 'rgba(194, 197, 206, 0.28)' }}>
      <td style={rowStyles.num}>{index + 1}</td>
      <td style={{ ...rowStyles.name, background: even ? colors.chineseWhite : '#DADCD9' }}>{student.name}</td>
      {days.map((day) =>
        day.pairs.map((pair, i) => (
          <AbsenceCell
            key={`${day.iso}-${pair}`}
            absent={Boolean(absences[absenceKey(day.iso, student.id, pair)])}
            editable={editable}
            firstOfDay={i === 0}
            label={`${student.name}, ${day.label}, ${pair} пара`}
            onToggle={() => onToggle(day.iso, student.id, pair)}
          />
        )),
      )}
      <td style={{ ...rowStyles.total, color: total > 0 ? colors.chocolate : colors.khaki }}>{total}</td>
    </tr>
  );
}
const rowStyles: Record<string, CSSProperties> = {
  num: { width: 36, textAlign: 'center', fontSize: 13, color: colors.khaki, fontWeight: 500 },
  name: { position: 'sticky', left: 0, zIndex: 1, minWidth: 250, padding: '0 14px', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', borderRight: `1px solid ${colors.lavenderGray}` },
  total: { width: 64, textAlign: 'center', fontSize: 15, fontWeight: 700, borderLeft: `3px solid ${colors.khaki}` },
};

/* ---- Таблиця ---- */
function AttendanceTable(props: {
  days: DayInfo[];
  absences: AbsenceMap;
  editable: boolean;
  onToggle: (iso: string, studentId: string, pair: number) => void;
}) {
  const { days, absences, editable, onToggle } = props;
  return (
    <div style={tableStyles.wrap}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            <th style={{ ...tableStyles.th, textAlign: 'center' }} rowSpan={2}>№</th>
            <th style={{ ...tableStyles.th, ...tableStyles.nameHead }} rowSpan={2}>Прізвище, ім’я та по батькові</th>
            {days.map((day) => (
              <th key={day.iso} colSpan={day.pairs.length} style={{ ...tableStyles.th, ...tableStyles.dayHead }}>
                <span style={tableStyles.date}>{day.label}</span>
                <span style={tableStyles.weekday}>{day.weekday}</span>
              </th>
            ))}
            <th style={{ ...tableStyles.th, textAlign: 'center', borderLeft: `3px solid ${colors.khaki}` }} rowSpan={2}>Всього</th>
          </tr>
          <tr>
            {days.map((day) =>
              day.pairs.map((pair, i) => (
                <th
                  key={`${day.iso}-${pair}`}
                  style={{ ...tableStyles.pairHead, borderLeft: i === 0 ? `3px solid ${colors.khaki}` : `1px solid ${colors.khaki}` }}
                >
                  {pair}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <StudentRow key={s.id} index={i} student={s} days={days} absences={absences} editable={editable} onToggle={onToggle} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
const tableStyles: Record<string, CSSProperties> = {
  wrap: { overflowX: 'auto', border: `1px solid ${colors.khaki}`, borderRadius: 14, background: colors.chineseWhite },
  table: { borderCollapse: 'collapse', width: '100%' },
  th: { background: colors.electricBlue, color: colors.chineseWhite, fontWeight: 700, fontSize: 14, padding: '8px 10px' },
  nameHead: { position: 'sticky', left: 0, zIndex: 2, textAlign: 'left', minWidth: 250 },
  dayHead: { textAlign: 'center', borderLeft: `3px solid ${colors.khaki}` },
  date: { display: 'block', fontSize: 16 },
  weekday: { display: 'block', fontSize: 12, fontWeight: 400, opacity: 0.85 },
  pairHead: { background: colors.lavenderGray, color: colors.electricBlue, fontSize: 13, fontWeight: 700, padding: '5px 0' },
};

/* ---- Перемикач тижнів ---- */
function WeekNavigator(props: { rangeLabel: string; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  const { rangeLabel, onPrev, onNext, onToday } = props;
  return (
    <div style={weekStyles.wrap}>
      <button type="button" style={weekStyles.btn} onClick={onPrev} aria-label="Попередній тиждень">‹</button>
      <span style={weekStyles.range}>{rangeLabel}</span>
      <button type="button" style={weekStyles.btn} onClick={onNext} aria-label="Наступний тиждень">›</button>
      <button type="button" style={{ ...weekStyles.btn, fontSize: 13 }} onClick={onToday}>Цей тиждень</button>
    </div>
  );
}
const weekStyles: Record<string, CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: 8 },
  range: { minWidth: 150, textAlign: 'center', fontWeight: 700, fontSize: 15 },
  btn: { height: 36, minWidth: 36, padding: '0 10px', border: `1px solid ${colors.electricBlue}`, borderRadius: 10, background: colors.lavenderGray, color: colors.electricBlue, fontSize: 18, fontWeight: 700, cursor: 'pointer' },
};

/* ---- Шапка ---- */
function Header(props: {
  rangeLabel: string;
  isEditor: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onLoginClick: () => void;
  onLogout: () => void;
}) {
  const { rangeLabel, isEditor, onPrev, onNext, onToday, onLoginClick, onLogout } = props;
  return (
    <header style={headerStyles.header}>
      <div>
        <h1 style={headerStyles.title}>Відвідуваність занять, група {GROUP_NAME}</h1>
        <p style={headerStyles.sub}>{isEditor ? 'Режим редагування: натискай на клітинку, щоб поставити або зняти «н»' : 'Лише перегляд'}</p>
      </div>
      <div style={headerStyles.right}>
        <WeekNavigator rangeLabel={rangeLabel} onPrev={onPrev} onNext={onNext} onToday={onToday} />
        {isEditor ? (
          <button type="button" style={{ ...headerStyles.edit, ...headerStyles.editOn }} onClick={onLogout}>Завершити редагування</button>
        ) : (
          <button type="button" style={headerStyles.edit} onClick={onLoginClick}>Редагувати нб</button>
        )}
      </div>
    </header>
  );
}
const headerStyles: Record<string, CSSProperties> = {
  header: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 },
  title: { margin: 0, fontSize: 26, fontWeight: 700, color: colors.electricBlue, letterSpacing: '-0.01em' },
  sub: { margin: '4px 0 0', fontSize: 14, color: colors.khaki, fontWeight: 500 },
  right: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  edit: { height: 36, padding: '0 16px', border: `1px solid ${colors.chocolate}`, borderRadius: 10, background: 'transparent', color: colors.chocolate, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  editOn: { background: colors.chocolate, color: colors.chineseWhite },
};

/* ---- Підписи ---- */
function Staff() {
  return (
    <dl style={staffStyles.list}>
      {STAFF.map(([role, name]) => (
        <div key={role} style={staffStyles.row}>
          <dt style={staffStyles.role}>{role}:</dt>
          <dd style={staffStyles.name}>{name}</dd>
        </div>
      ))}
    </dl>
  );
}
const staffStyles: Record<string, CSSProperties> = {
  list: { margin: '20px 0 0', display: 'grid', gap: 6 },
  row: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  role: { fontWeight: 700, minWidth: 190, color: colors.electricBlue },
  name: { margin: 0, fontWeight: 500, color: colors.electricBlue },
};

/* ---- Telegram Login Widget (потрібен бот і /setdomain у @BotFather) ---- */
function TelegramLoginButton({ onAuth }: { onAuth: (user: TelegramUser) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!TELEGRAM_BOT || !host) return;
    (window as unknown as { onTelegramAuth: (u: TelegramUser) => void }).onTelegramAuth = onAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', TELEGRAM_BOT);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    host.appendChild(script);

    return () => {
      host.innerHTML = '';
    };
  }, [onAuth]);

  if (!TELEGRAM_BOT) return null;
  return <div ref={ref} />;
}

/* Усередині Telegram Mini App повертає initData (підписані дані користувача), поза ним — '' */
function loadTelegramInitData(): Promise<string> {
  type W = { Telegram?: { WebApp?: { initData?: string } } };
  const get = () => (window as unknown as W).Telegram?.WebApp;
  return new Promise((resolve) => {
    if (get()) return resolve(get()?.initData ?? '');
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.async = true;
    s.onload = () => resolve(get()?.initData ?? '');
    s.onerror = () => resolve('');
    document.head.appendChild(s);
    setTimeout(() => resolve(get()?.initData ?? ''), 4000);
  });
}

/* ---- Вікно входу (лише Telegram) ---- */
function LoginModal(props: { onClose: () => void; onTelegram: (user: TelegramUser) => Promise<boolean> }) {
  const { onClose, onTelegram } = props;
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'checking' | 'telegram' | 'widget'>('checking');
  const started = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleTelegram = useCallback(
    async (user: TelegramUser) => {
      const ok = await onTelegram(user);
      if (ok) onClose();
      else setError('Цей Telegram-акаунт не має права редагувати.');
    },
    [onTelegram, onClose],
  );

  // Усередині Telegram входимо автоматично через initData, поза ним показуємо віджет
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadTelegramInitData().then((initData) => {
      if (!initData) {
        setMode('widget');
        return;
      }
      setMode('telegram');
      void handleTelegram({ initData } as unknown as TelegramUser);
    });
  }, [handleTelegram]);

  return (
    <div style={modalStyles.overlay} onClick={onClose} role="presentation">
      <div style={modalStyles.modal} role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="login-title" style={modalStyles.title}>Доступ до редагування</h2>
        {mode === 'widget' && (
          <p style={modalStyles.text}>Увійди через Telegram. Редагувати нб можуть лише дозволені акаунти.</p>
        )}
        {mode !== 'widget' && !error && <p style={modalStyles.text}>Перевіряємо акаунт…</p>}
        {mode === 'widget' &&
          (TELEGRAM_BOT ? (
            <TelegramLoginButton onAuth={handleTelegram} />
          ) : (
            <p role="alert" style={modalStyles.error}>Вхід недоступний: не задано TELEGRAM_BOT.</p>
          ))}
        {error && <p role="alert" style={modalStyles.error}>{error}</p>}
        <button type="button" style={modalStyles.cancel} onClick={onClose}>Скасувати</button>
      </div>
    </div>
  );
  
}
const modalStyles: Record<string, CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(86, 103, 119, 0.55)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 10 },
  modal: { width: '100%', maxWidth: 380, background: colors.chineseWhite, border: `1px solid ${colors.khaki}`, borderRadius: 16, padding: 24 },
  title: { margin: '0 0 8px', fontSize: 20, color: colors.electricBlue },
  text: { margin: '0 0 16px', fontSize: 14, fontWeight: 500, color: colors.electricBlue },
  error: { margin: '12px 0 0', color: colors.chocolate, fontSize: 14, fontWeight: 500 },
  cancel: { marginTop: 14, background: 'none', border: 'none', color: colors.electricBlue, textDecoration: 'underline', cursor: 'pointer', fontSize: 14, padding: 0 },
};

/* ============================== СТОРІНКА ============================== */

function AttendanceView() {
  const { absences, toggle } = useAttendance();
  const { isEditor, loginWithTelegram, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // Стартуємо з тижня останніх записаних нб, інакше — з поточного
  const [monday, setMonday] = useState(() => {
    const last = latestDate(absences);
    return mondayOf(last ? fromIso(last) : new Date());
  });

  const days = useMemo(() => buildWeek(monday), [monday]);
  const rangeLabel = `${days[0].label} – ${days[days.length - 1].label}.${monday.getFullYear()}`;

  const handleToggle = useCallback(
    (iso: string, id: string, pair: number) => {
      if (isEditor) toggle(iso, id, pair);
    },
    [isEditor, toggle],
  );
  const closeLogin = useCallback(() => setShowLogin(false), []);

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 16px 48px' }}>
      <Header
        rangeLabel={rangeLabel}
        isEditor={isEditor}
        onPrev={() => setMonday((m) => addDays(m, -7))}
        onNext={() => setMonday((m) => addDays(m, 7))}
        onToday={() => setMonday(mondayOf(new Date()))}
        onLoginClick={() => setShowLogin(true)}
        onLogout={logout}
      />
      <AttendanceTable days={days} absences={absences} editable={isEditor} onToggle={handleToggle} />
      <Staff />
      {showLogin && <LoginModal onClose={closeLogin} onTelegram={loginWithTelegram} />}
    </main>
  );
}

export default function Page() {
  // Дані в localStorage/sessionStorage, тому рендеримо після монтування (без hydration mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <GlobalStyles />
      {mounted ? <AttendanceView /> : null}
    </>
  );
}