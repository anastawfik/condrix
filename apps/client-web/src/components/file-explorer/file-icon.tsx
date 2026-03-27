import {
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  Image,
  Settings,
} from 'lucide-react';

const ICON_MAP: Record<string, typeof File> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
  css: FileType,
  scss: FileType,
  html: FileCode,
  svg: Image,
  png: Image,
  jpg: Image,
  yaml: Settings,
  yml: Settings,
  toml: Settings,
};

interface FileIconProps {
  name: string;
  type: 'file' | 'directory';
  expanded?: boolean;
  size?: number;
}

export function FileIcon({ name, type, expanded, size = 14 }: FileIconProps) {
  if (type === 'directory') {
    const Icon = expanded ? FolderOpen : Folder;
    return <Icon size={size} className="text-[var(--accent-yellow)] shrink-0" />;
  }

  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const Icon = ICON_MAP[ext] ?? File;
  return <Icon size={size} className="text-[var(--text-secondary)] shrink-0" />;
}
