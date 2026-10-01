import { useCallback, useState } from 'react';

type Props = {
  label: string;
  command: string;
  hint?: string;
};

export function CopyCommand({ label, command, hint }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [command]);

  return (
    <div className="copy-cmd">
      <div className="copy-cmd-head">
        <span className="label">{label}</span>
        <button
          type="button"
          className="copy-btn"
          onClick={copy}
          aria-label={`Copy ${label}`}
          title={copied ? 'Copied' : 'Copy to clipboard'}
        >
          {copied ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
              <path
                d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"
                stroke="currentColor"
                strokeWidth="1.75"
              />
            </svg>
          )}
        </button>
      </div>
      <code className="copy-cmd-text">{command}</code>
      {hint ? <p className="copy-cmd-hint">{hint}</p> : null}
    </div>
  );
}
