"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

/* ───────────── Дані розкладу МТ-41 ───────────── */

type Lesson = { subject: string; teacher: string; room: string };
type Split = { split: [Lesson | null, Lesson | null] }; // [непарний тиждень, парний тиждень]
type Slot = Lesson | Split | null; // null = вільно

const L = (subject: string, teacher: string, room: string): Lesson => ({ subject, teacher, room });

const NAS = "Основи національного спротиву";
const OOP = "Об’єктно орієнтоване програмування";
const PAZ = "ПАЗ Internet речей";
const ZAH = "Захист інформації Internet речей";
const WEB = "Програмування в Internet";
const SYS = "Системне програмування";

const SCHEDULE: Slot[][] = [
  // Понеділок
  [
    L(NAS, "Салига А.О.", "309л"),
    L("Фізичне виховання", "Васильков Б.І.", "кфв"),
    L(OOP, "Корольков Ю.А.", "306"),
    { split: [L(PAZ, "Сидорів М.С.", "303л"), null] },
    null,
  ],
  // Вівторок
  [
    L(OOP, "Корольков Ю.А.", "306"),
    L(NAS, "Салига А.О.", "ЧЗ"),
    L("Мережі електронних комунікацій", "Полець М.В.Я.", "207л"),
    L("Мережі операційні системи", "Мамедов Р.Т.", "201л"),
    null,
  ],
  // Середа
  [
    null,
    L(PAZ, "Сидорів М.С.", "309л"),
    L(ZAH, "Чичкевич О.Б.", "301л А"),
    L("Економіка галузі", "Петрик Г.П.", "401"),
    null,
  ],
  // Четвер
  [
    L(WEB, "Тупичак І.В.", "202л"),
    L(ZAH, "Чичкевич О.Б.", "309л"),
    L("Мультипроцесорні технології", "Пелещак Б.М.", "203л"),
    L(SYS, "к.т.н. Кужій Л.І.", "415"),
    null,
  ],
  // П’ятниця (3 пари)
  [
    L(WEB, "Тупичак І.В.", "202л"),
    L(PAZ, "Сидорів М.С.", "309л"),
    { split: [L(SYS, "Кужій Л.І.", "415"), null] },
  ],
];

const TIMES: [string, string][] = [
  ["8:30", "9:50"],
  ["10:00", "11:20"],
  ["12:00", "13:20"],
  ["13:30", "14:50"],
  ["15:00", "16:20"],
];

const DAYS = ["Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця"];
const MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

/* ───────────── Номер тижня ─────────────
   Тиждень 1 починається 1 вересня, далі номер росте щовівторка.
   Непарний тиждень → верхні пари, парний → нижні. */

const DAY_MS = 86_400_000;
const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

function weekNo(d: Date): number {
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  const dow = new Date(Date.UTC(y, 8, 1)).getUTCDay();
  const toTuesday = ((2 - dow + 7) % 7) || 7; // перший вівторок після 1 вересня
  const firstTuesday = Date.UTC(y, 8, 1 + toTuesday);
  const x = utc(d);
  return x < firstTuesday ? 1 : 2 + Math.floor((x - firstTuesday) / (7 * DAY_MS));
}

const isOdd = (w: number) => w % 2 === 1;
const parityName = (w: number) => (isOdd(w) ? "непарний" : "парний");
const sideName = (w: number) => (isOdd(w) ? "верхні" : "нижні");
const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const plural = (n: number) => (n === 1 ? "пара" : n >= 2 && n <= 4 ? "пари" : "пар");
const isSplit = (s: Slot): s is Split => !!s && "split" in s;

/* ───────────── Tailwind: палітра та спільні класи ─────────────
   Блакитна версія: небесно-блакитний фон #DCE7F2, світло-блакитні плашки #BFD3E8,
   синій акцент #3E6A9E. Khaki #B6AA9A з палітри лишився тільки для пар, що залежать від тижня.

   Кольори задані один раз як CSS-змінні на кореневому елементі.
   Темна тема вмикається через dark: (за налаштуванням системи).
   Якщо у проєкті darkMode: "class", просто додай клас dark на <html>. */

const ROOT_VARS =
  "[--bg:#DCE7F2] [--surface:#F2F7FC] [--ink:#26394F] [--muted:#4F6682] " +
  "[--line:rgba(94,129,170,0.35)] [--accent:#3E6A9E] [--accent-soft:#BFD3E8] [--on-accent:#F2F7FC] " +
  "[--swap-soft:rgba(182,170,154,0.32)] [--swap:#6F6352] " +
  "dark:[--bg:#1F2D3F] dark:[--surface:#2A3B52] dark:[--ink:#E3EDF7] dark:[--muted:#A9C0DA] " +
  "dark:[--line:rgba(169,192,218,0.22)] dark:[--accent:#8DB4E0] dark:[--accent-soft:#3A5578] dark:[--on-accent:#1F2D3F] " +
  "dark:[--swap-soft:rgba(182,170,154,0.2)] dark:[--swap:#B6AA9A]";

// Шрифти підключи окремо (див. пояснення): Manrope для тексту, IBM Plex Mono для часу й аудиторій.
const BODY = "font-['Manrope',system-ui,-apple-system,'Segoe_UI',sans-serif]";
const MONO = "font-['IBM_Plex_Mono',ui-monospace,Menlo,Consolas,monospace]";

/* ───────────── Компоненти ───────────── */

function SlotView({ slot, index, week }: { slot: Slot; index: number; week: number }) {
  const [from, to] = TIMES[index];
  const swap = isSplit(slot);

  const meta = (right: ReactNode) => (
    <div className={`flex items-center gap-2 ${MONO} text-xs tabular-nums text-[color:var(--muted)]`}>
      <span
        className={`inline-grid h-[18px] w-[18px] place-items-center rounded border text-[11px] text-[color:var(--ink)] ${
          swap ? "border-[color:var(--swap)]" : "border-[color:var(--line)]"
        }`}
      >
        {index + 1}
      </span>
      <time>
        {from}–{to}
      </time>
      {right}
    </div>
  );

  const room = (value: string) => (
    <span
      className={`ml-auto whitespace-nowrap rounded-[5px] px-[7px] py-px text-[13px] font-medium text-[color:var(--ink)] ${
        swap ? "bg-[color:var(--surface)]" : "bg-[color:var(--accent-soft)]"
      }`}
    >
      {value}
    </span>
  );

  const free = <span className={`ml-auto ${BODY}`}>вільно</span>;
  const slotBase = "flex min-w-0 flex-col gap-[3px] border-t border-[color:var(--line)] px-3";

  if (isSplit(slot)) {
    const active = slot.split[isOdd(week) ? 0 : 1];
    const other = slot.split[isOdd(week) ? 1 : 0];
    return (
      <article className={`${slotBase} bg-[color:var(--swap-soft)] pb-[11px] pt-2.5`}>
        {meta(active ? room(active.room) : free)}
        <span className={`${MONO} text-[11px] font-medium uppercase tracking-[0.05em] text-[color:var(--swap)]`}>
          {parityName(week)} тиждень
        </span>
        {active && (
          <>
            <h3 className="mt-0.5 text-[15px] font-semibold text-pretty [overflow-wrap:anywhere]">{active.subject}</h3>
            <p className="text-[13px] text-[color:var(--muted)]">{active.teacher}</p>
          </>
        )}
        <p className="mt-0.5 text-xs text-[color:var(--swap)]">
          {isOdd(week) ? "Парний" : "Непарний"} тиждень: {other ? other.subject : "вільно"}
        </p>
      </article>
    );
  }

  if (!slot) {
    return <div className={`${slotBase} py-2`}>{meta(free)}</div>;
  }

  return (
    <article className={`${slotBase} pb-[11px] pt-2.5`}>
      {meta(room(slot.room))}
      <h3 className="mt-0.5 text-[15px] font-semibold text-pretty [overflow-wrap:anywhere]">{slot.subject}</h3>
      <p className="text-[13px] text-[color:var(--muted)]">{slot.teacher}</p>
    </article>
  );
}

/* Поточну дату беремо лише в браузері після монтування: так Next.js не прагне
   рахувати new Date() під час prerender і немає розбіжності між сервером і клієнтом. */
export default function MT41Schedule() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) {
    return (
      <div className={`min-h-full bg-[color:var(--bg)] px-4 pb-8 pt-5 text-[color:var(--ink)] ${BODY} ${ROOT_VARS}`}>
        <div className="mx-auto max-w-[640px] lg:max-w-[1180px]">
          <h1 className="text-[28px] font-bold tracking-[-0.01em]">Розклад МТ-41</h1>
        </div>
      </div>
    );
  }
  return <ScheduleView now={now} />;
}

function ScheduleView({ now }: { now: Date }) {
  const [offset, setOffset] = useState(0); // зсув у тижнях

  // Понеділок календарного тижня (у суботу й неділю показуємо наступний)
  const monday = useMemo(() => {
    const dow = (now.getDay() + 6) % 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + (dow >= 5 ? 7 : 0) + offset * 7);
  }, [now, offset]);

  const dates = useMemo(
    () => Array.from({ length: 8 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)),
    [monday],
  );

  const mainWeek = weekNo(dates[1]); // тиждень починається у вівторок
  const mondayWeek = weekNo(dates[0]);

  const stepBtn =
    "min-h-10 min-w-10 cursor-pointer rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3.5 font-semibold text-[color:var(--ink)] " +
    "hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]";

  return (
    <div
      className={`min-h-full bg-[color:var(--bg)] px-4 pb-8 pt-5 text-[15px] leading-[1.4] text-[color:var(--ink)] ${BODY} ${ROOT_VARS}`}
    >
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 lg:max-w-[1180px]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] font-bold tracking-[-0.01em] text-balance">Розклад МТ-41</h1>
          <div className="flex gap-1.5" role="group" aria-label="Перемикання тижнів">
            <button type="button" className={stepBtn} aria-label="Попередній тиждень" onClick={() => setOffset((o) => o - 1)}>
              ‹
            </button>
            <button type="button" className={stepBtn} onClick={() => setOffset(0)}>
              Сьогодні
            </button>
            <button type="button" className={stepBtn} aria-label="Наступний тиждень" onClick={() => setOffset((o) => o + 1)}>
              ›
            </button>
          </div>
        </header>

        <section
          className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3.5"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2.5">
            <span className="text-[22px] font-bold">Тиждень {mainWeek}</span>
            <span
              className={`rounded-md bg-[color:var(--accent-soft)] px-2 py-[3px] ${MONO} text-xs font-medium uppercase tracking-[0.04em] text-[color:var(--ink)]`}
            >
              {parityName(mainWeek)} · {sideName(mainWeek)} пари
            </span>
            <span className="ml-auto text-sm text-[color:var(--muted)]">
              {fmt(dates[1])} – {fmt(dates[7])}
            </span>
          </div>
          {mondayWeek !== mainWeek && (
            <p className="text-[13px] text-[color:var(--muted)]">
              Понеділок, {fmt(dates[0])}, ще входить у тиждень {mondayWeek} ({parityName(mondayWeek)}, {sideName(mondayWeek)} пари).
            </p>
          )}
        </section>

        <main className="grid grid-cols-1 items-start gap-3 lg:grid-cols-5">
          {SCHEDULE.map((slots, i) => {
            const date = dates[i];
            const w = weekNo(date);
            const isToday = utc(date) === utc(now);
            const isPast = utc(date) < utc(now);

            const lessons = slots
              .map((s, idx) => ({ s: isSplit(s) ? s.split[isOdd(w) ? 0 : 1] : s, idx }))
              .filter((x) => x.s);
            const first = lessons.length ? TIMES[lessons[0].idx][0] : "";
            const last = lessons.length ? TIMES[lessons[lessons.length - 1].idx][1] : "";

            return (
              <section
                key={DAYS[i]}
                className={`min-w-0 overflow-hidden rounded-xl border bg-[color:var(--surface)] ${
                  isToday ? "border-[color:var(--accent)] ring-2 ring-[color:var(--accent)]" : "border-[color:var(--line)]"
                } ${isPast ? "opacity-60" : ""}`}
              >
                <header className="flex flex-col gap-0.5 px-3 pb-2.5 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[17px] font-bold">{DAYS[i]}</h2>
                    {isToday && (
                      <span
                        className={`rounded-[5px] bg-[color:var(--accent)] px-[7px] py-0.5 ${MONO} text-[11px] font-medium uppercase tracking-[0.06em] text-[color:var(--on-accent)]`}
                      >
                        сьогодні
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[color:var(--muted)]">{fmt(date)}</p>
                  <p className="text-[13px] text-[color:var(--muted)]">
                    <span className={`${MONO} tabular-nums`}>
                      {first}–{last}
                    </span>{" "}
                    · {lessons.length} {plural(lessons.length)}
                  </p>
                </header>
                {slots.map((slot, idx) => (
                  <SlotView key={idx} slot={slot} index={idx} week={w} />
                ))}
              </section>
            );
          })}
        </main>

        <footer className="flex flex-col gap-1 text-[13px] text-[color:var(--muted)]">
          <p>
            <span className="mr-1.5 inline-block h-3 w-3 rounded-[3px] border border-[color:var(--swap)] bg-[color:var(--swap-soft)] align-[-1px]" />
            Пара змінюється залежно від тижня: у непарний тиждень діє верхня половина клітинки, у парний нижня.
          </p>
          <p>Тиждень змінюється щовівторка, відлік від 1 вересня. Понеділок ще належить до попереднього тижня.</p>
        </footer>
      </div>
    </div>
  );
}