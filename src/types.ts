export interface Dialogue {
  id: string;
  text: string;
  x: number; // 0-100 relative to panel
  y: number; // 0-100 relative to panel
  width: number;
  height: number;
}

export interface Panel {
  id: string;
  image_data?: string;
  dialogues: Dialogue[];
  scene_description: string;
  layout_hint: 'full' | 'half-vertical' | 'half-horizontal' | 'quarter';
}

export interface MangaPage {
  id: string;
  page_number: number;
  panels: Panel[];
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface Manga {
  id: string;
  title: string;
  prompt: string;
  language: string;
  style: 'bw' | 'color';
  page_count: number;
  author_id: string;
  is_published: boolean;
  created_at: string;
  pages: MangaPage[];
  cover_image?: string;
}

export interface User {
  id: string;
  username: string;
}
