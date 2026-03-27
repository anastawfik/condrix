import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const MAX_LENGTH = 4000;

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  };

  const charCount = value.length;
  const isNearLimit = charCount > MAX_LENGTH * 0.9;

  return (
    <div className="p-3 border-t border-border bg-secondary">
      <div className="flex items-end gap-2 rounded-xl bg-background border border-border px-3 py-2 shadow-[0_-2px_12px_rgba(0,0,0,0.25)] focus-within:border-primary transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= MAX_LENGTH) {
              setValue(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Message..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none py-1.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          size="icon"
          className="p-2 rounded-lg shrink-0 transition-all duration-150 hover:scale-105 hover:shadow-[0_0_8px_rgba(0,120,212,0.4)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
        >
          <Send size={16} />
        </Button>
      </div>
      <div className="flex items-center justify-between mt-1.5 px-1">
        <span className="text-[10px] text-muted-foreground">
          <kbd className="px-1 py-0.5 rounded bg-secondary text-muted-foreground font-mono text-[9px]">
            Enter
          </kbd>{' '}
          to send
          <span className="mx-1.5 text-border">&middot;</span>
          <kbd className="px-1 py-0.5 rounded bg-secondary text-muted-foreground font-mono text-[9px]">
            Shift+Enter
          </kbd>{' '}
          new line
        </span>
        {charCount > 0 && (
          <span
            className={`text-[10px] tabular-nums ${isNearLimit ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {charCount}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  );
}
