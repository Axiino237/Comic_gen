import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import fs from "fs";

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("manga.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT
  );

  CREATE TABLE IF NOT EXISTS mangas (
    id TEXT PRIMARY KEY,
    title TEXT,
    prompt TEXT,
    language TEXT,
    style TEXT,
    page_count INTEGER,
    author_id TEXT,
    is_published INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add style column if it doesn't exist
try {
  db.prepare("ALTER TABLE mangas ADD COLUMN style TEXT").run();
} catch (e) {
  // Column already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    manga_id TEXT,
    page_number INTEGER,
    FOREIGN KEY(manga_id) REFERENCES mangas(id)
  );

  CREATE TABLE IF NOT EXISTS panels (
    id TEXT PRIMARY KEY,
    page_id TEXT,
    image_data TEXT,
    scene_description TEXT,
    layout_hint TEXT,
    FOREIGN KEY(page_id) REFERENCES pages(id)
  );

  CREATE TABLE IF NOT EXISTS dialogues (
    id TEXT PRIMARY KEY,
    panel_id TEXT,
    text TEXT,
    x INTEGER,
    y INTEGER,
    width INTEGER,
    height INTEGER,
    FOREIGN KEY(panel_id) REFERENCES panels(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/mangas/published", (req, res) => {
    const mangas = db.prepare("SELECT * FROM mangas WHERE is_published = 1 ORDER BY created_at DESC").all();
    const mangasWithCover = mangas.map((m: any) => {
      const firstPage = db.prepare("SELECT id FROM pages WHERE manga_id = ? ORDER BY page_number ASC LIMIT 1").get(m.id) as any;
      if (firstPage) {
        const firstPanel = db.prepare("SELECT image_data FROM panels WHERE page_id = ? ORDER BY id ASC LIMIT 1").get(firstPage.id) as any;
        return { ...m, is_published: !!m.is_published, cover_image: firstPanel?.image_data };
      }
      return { ...m, is_published: !!m.is_published, cover_image: null };
    });
    res.json(mangasWithCover);
  });

  app.get("/api/mangas/user/:userId", (req, res) => {
    const mangas = db.prepare("SELECT * FROM mangas WHERE author_id = ? ORDER BY created_at DESC").all();
    const mangasWithCover = mangas.map((m: any) => {
      const firstPage = db.prepare("SELECT id FROM pages WHERE manga_id = ? ORDER BY page_number ASC LIMIT 1").get(m.id) as any;
      if (firstPage) {
        const firstPanel = db.prepare("SELECT image_data FROM panels WHERE page_id = ? ORDER BY id ASC LIMIT 1").get(firstPage.id) as any;
        return { ...m, is_published: !!m.is_published, cover_image: firstPanel?.image_data };
      }
      return { ...m, is_published: !!m.is_published, cover_image: null };
    });
    res.json(mangasWithCover);
  });

  app.get("/api/manga/:id", (req, res) => {
    const manga = db.prepare("SELECT * FROM mangas WHERE id = ?").get(req.params.id) as any;
    if (!manga) return res.status(404).json({ error: "Manga not found" });
    
    const pages = db.prepare("SELECT * FROM pages WHERE manga_id = ? ORDER BY page_number ASC").all();
    const pagesWithPanels = pages.map(page => {
      const panels = db.prepare("SELECT * FROM panels WHERE page_id = ?").all();
      const panelsWithDialogues = panels.map(panel => {
        const dialogues = db.prepare("SELECT * FROM dialogues WHERE panel_id = ?").all();
        return { ...panel, dialogues };
      });
      return { ...page, panels: panelsWithDialogues };
    });

    res.json({ ...manga, is_published: !!manga.is_published, pages: pagesWithPanels });
  });

  app.post("/api/manga/save", (req, res) => {
    const { id, title, prompt, language, style, page_count, author_id, pages } = req.body;
    
    const insertManga = db.prepare(`
      INSERT OR REPLACE INTO mangas (id, title, prompt, language, style, page_count, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertPage = db.prepare(`
      INSERT OR REPLACE INTO pages (id, manga_id, page_number)
      VALUES (?, ?, ?)
    `);

    const insertPanel = db.prepare(`
      INSERT OR REPLACE INTO panels (id, page_id, image_data, scene_description, layout_hint)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const insertDialogue = db.prepare(`
      INSERT OR REPLACE INTO dialogues (id, panel_id, text, x, y, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertManga.run(id, title, prompt, language, style, page_count, author_id);
      
      for (const page of pages) {
        insertPage.run(page.id, id, page.page_number);
        
        // Clean up old panels and dialogues for this page
        const oldPanels = db.prepare("SELECT id FROM panels WHERE page_id = ?").all();
        for (const p of oldPanels) {
          db.prepare("DELETE FROM dialogues WHERE panel_id = ?").run(p.id);
        }
        db.prepare("DELETE FROM panels WHERE page_id = ?").run(page.id);

        for (const panel of page.panels) {
          insertPanel.run(panel.id, page.id, panel.image_data, panel.scene_description, panel.layout_hint);
          for (const dialogue of panel.dialogues) {
            insertDialogue.run(dialogue.id, panel.id, dialogue.text, dialogue.x, dialogue.y, dialogue.width, dialogue.height);
          }
        }
      }
    });

    transaction();
    res.json({ success: true });
  });

  app.post("/api/manga/publish", (req, res) => {
    const { id } = req.body;
    db.prepare("UPDATE mangas SET is_published = 1 WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
