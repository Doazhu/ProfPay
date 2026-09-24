import { Fragment, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Cross2Icon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { IconButton, Kbd, Spinner, TextField } from '@radix-ui/themes';

// Пауза в наборе, после которой уходит запрос. На каждую букву запрос
// не шлётся: ответы приходили вразнобой, и в таблице оставался результат
// по «Ив», хотя в поле уже было «Иванов».
const DELAY_MS = 300;

interface SearchFieldProps {
  /** Запрос из адреса страницы. */
  value: string;
  /** Вызывается после паузы в наборе, по Enter и при очистке. */
  onSearch: (value: string) => void;
  placeholder?: string;
  busy?: boolean;
  style?: CSSProperties;
}

/**
 * Поле поиска над списком.
 *
 * Держит набираемый текст у себя и отдаёт наружу только после паузы.
 * Раньше поле было привязано к адресу напрямую: каждая буква становилась
 * записью в истории браузера, и «Назад» перебирал «Ивано», «Иван», «Ива»…
 */
export default function SearchField({
  value, onSearch, placeholder = 'ФИО, группа, кафедра', busy, style,
}: SearchFieldProps) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Что уже отдано наружу. Сравнение идёт по обрезанному тексту: пробел
  // в конце — это начало следующего слова, и отнимать его у человека нельзя.
  const sent = useRef(value);

  // Адрес поменялся не отсюда — «Назад» в браузере, пункт меню, «Сбросить».
  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setText(value);
    }
  }, [value]);

  const submit = (next: string) => {
    const query = next.trim();
    if (query === sent.current) return;
    sent.current = query;
    onSearch(query);
  };

  useEffect(() => {
    const timer = setTimeout(() => submit(text), DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  // «/» — к поиску из любого места страницы. По коду клавиши, а не по символу:
  // в русской раскладке та же клавиша печатает точку.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Slash' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(
        'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"], [role="menu"]',
      )) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const clear = () => {
    setText('');
    submit('');
    inputRef.current?.focus();
  };

  return (
    <TextField.Root
      ref={inputRef}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') submit(text);
        if (event.key === 'Escape' && text) {
          event.preventDefault();
          clear();
        }
      }}
      placeholder={placeholder}
      aria-label="Поиск"
      enterKeyHint="search"
      autoComplete="off"
      spellCheck={false}
      maxLength={100}
      style={style}
    >
      <TextField.Slot>
        {busy ? <Spinner size="1" /> : <MagnifyingGlassIcon />}
      </TextField.Slot>
      <TextField.Slot>
        {text ? (
          <IconButton size="1" variant="ghost" color="gray" onClick={clear} aria-label="Очистить поиск">
            <Cross2Icon />
          </IconButton>
        ) : (
          <Kbd size="1" className="hidden md:inline-flex">/</Kbd>
        )}
      </TextField.Slot>
    </TextField.Root>
  );
}

// Та же раскладка, что на сервере (repositories._LAYOUT): «bdfyjd» → «иванов».
const LATIN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const CYRILLIC = 'йцукенгшщзхъфывапролджэячсмитьбюе';

const fold = (text: string) => text.toLowerCase().replace(/ё/g, 'е');

/**
 * Слова запроса для подсветки — так же, как их режет сервер.
 * Одиночные буквы не подсвечиваются: это инициалы, и подсветка каждой «и»
 * в таблице только рябит.
 */
export function searchWords(query: string): string[] {
  const folded = fold(query);
  const variants = [folded];
  if (/[a-z]/.test(folded) && !/[а-я]/.test(folded)) {
    variants.push([...folded].map((ch) => {
      const index = LATIN.indexOf(ch);
      return index >= 0 ? CYRILLIC[index] : ch;
    }).join(''));
  }
  return variants.flatMap((variant) => variant.split(/[\s,.]+/)).filter((word) => word.length >= 2);
}

/** Текст с подсвеченными совпадениями. */
export function Highlight({ text, words }: { text: string; words: string[] }) {
  const folded = fold(text);
  // Перевод в нижний регистр почти всегда сохраняет длину, но не для всех
  // букв на свете. Если сдвинулось — лучше без подсветки, чем мимо букв.
  if (!words.length || folded.length !== text.length) return <>{text}</>;

  const hit = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    for (let at = folded.indexOf(word); at !== -1; at = folded.indexOf(word, at + 1)) {
      hit.fill(true, at, at + word.length);
    }
  }

  const parts: ReactNode[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i += 1) {
    if (i < text.length && hit[i] === hit[start]) continue;
    const chunk = text.slice(start, i);
    parts.push(hit[start]
      ? <mark key={start} className="search-hit">{chunk}</mark>
      : <Fragment key={start}>{chunk}</Fragment>);
    start = i;
  }
  return <>{parts}</>;
}
