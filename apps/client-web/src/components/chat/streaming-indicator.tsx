export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 ml-9">
      <div className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-bl-sm bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse [animation-delay:0ms] [animation-duration:1.4s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse [animation-delay:200ms] [animation-duration:1.4s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse [animation-delay:400ms] [animation-duration:1.4s]" />
      </div>
      <span className="text-[11px] text-[var(--text-muted)] italic">Thinking...</span>
    </div>
  );
}
