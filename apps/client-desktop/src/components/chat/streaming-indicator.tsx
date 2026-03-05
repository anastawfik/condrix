export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-[var(--text-muted)] ml-2">Thinking...</span>
    </div>
  );
}
