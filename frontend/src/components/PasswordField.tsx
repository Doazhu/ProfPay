import { useState } from 'react';
import { EyeClosedIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { IconButton, TextField, Tooltip } from '@radix-ui/themes';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  invalid?: boolean;
  id?: string;
  /** Размер поля Radix — на странице входа поля крупнее, чем в формах. */
  size?: '1' | '2' | '3';
}

/**
 * Поле пароля с показом содержимого.
 *
 * Кнопка-глаз лежит внутри поля через TextField.Slot. Раньше она рисовалась
 * отдельной кнопкой рядом и наполовину свисала за границу поля — при этом
 * ещё и перекрывала правый край текста.
 */
export default function PasswordField({
  value, onChange, placeholder, autoComplete, autoFocus, required, invalid, id, size,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField.Root
      id={id}
      size={size}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      required={required}
      color={invalid ? 'red' : undefined}
    >
      <TextField.Slot side="right">
        <Tooltip content={visible ? 'Скрыть' : 'Показать'}>
          <IconButton
            type="button"
            size="1"
            variant="ghost"
            color="gray"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
            // Кнопка внутри поля не должна забирать фокус при переходе табом:
            // иначе с клавиатуры между полями приходится жать Tab дважды.
            tabIndex={-1}
          >
            {visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
          </IconButton>
        </Tooltip>
      </TextField.Slot>
    </TextField.Root>
  );
}
