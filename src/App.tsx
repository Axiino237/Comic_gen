import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  BookOpen, 
  Plus, 
  Library, 
  History, 
  Send, 
  Download, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Edit3,
  RefreshCw,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateStoryboard, generateMangaImage, MangaStory } from './services/geminiService';
import { Manga, User, MangaPage } from './types';

const LANGUAGES = ['English', 'Tamil', 'Japanese', 'Hindi', 'Spanish', 'French'];
const THEMES = ['Action/Shonen', 'Romance/Shojo', 'Horror/Seinen', 'Slice of Life', 'Cyberpunk', 'Fantasy'];
const PAGE_COUNTS = Array.from({ length: 20 }, (_, i) => i + 1);
const STYLES = [
  { id: 'bw', name: 'Black & White', icon: 'â–«ï¸' },
  { id: 'color', name: 'Full Color', icon: 'ðŸŽ¨' }
];

export default function App() {
  const [view, setView] = useState<'home' | 'create' | 'viewer' | 'library' | 'sessions' | 'storyboard_editor'>('home');
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState('English');
  const [style, setStyle] = useState<'bw' | 'color'>('bw');
  const [theme, setTheme] = useState('Action/Shonen');
  const [pageCount, setPageCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentManga, setCurrentManga] = useState<Manga | null>(null);
  const [publishedMangas, setPublishedMangas] = useState<Manga[]>([]);
  const [userMangas, setUserMangas] = useState<Manga[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'success' | 'error' | 'info'}[]>([]);

  const addNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    if (view === 'storyboard_editor' && currentManga) {
      const timer = setTimeout(async () => {
        try {
          await fetch('/api/manga/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentManga)
          });
          console.log('Auto-saved draft');
        } catch (e) {
          console.error('Auto-save failed', e);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentManga, view]);

  const handleBackToEditor = () => {
    setView('storyboard_editor');
  };

  useEffect(() => {
    let storedUser = localStorage.getItem('manga_user');
    if (!storedUser) {
      const newUser = { id: crypto.randomUUID(), username: 'User_' + Math.floor(Math.random() * 1000) };
      localStorage.setItem('manga_user', JSON.stringify(newUser));
      storedUser = JSON.stringify(newUser);
    }
    setUser(JSON.parse(storedUser));
    fetchPublished();
  }, []);

  const fetchPublished = async () => {
    try {
      const res = await fetch('/api/mangas/published');
      const data = await res.json();
      setPublishedMangas(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUserSessions = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/mangas/user/${user.id}`);
      const data = await res.json();
      setUserMangas(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerate = async () => {
    if (!prompt || !user) {
      addNotification('Please enter a story prompt first!', 'error');
      return;
    }
    setIsGenerating(true);
    setStatusMessage('Storyboarding your manga...');
    try {
      const storyboard = await generateStoryboard(`${theme} style: ${prompt}`, pageCount, language, style);
      
      const manga: Manga = {
        id: crypto.randomUUID(),
        title: storyboard.title,
        prompt,
        language,
        style,
        page_count: pageCount,
        author_id: user.id,
        is_published: false,
        created_at: new Date().toISOString(),
        pages: storyboard.pages
      };

      setCurrentManga(manga);
      setView('storyboard_editor');
      addNotification('Storyboard generated successfully!', 'success');
    } catch (error) {
      console.error(error);
      addNotification('Failed to generate storyboard. Check your API key or connection.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartInking = async () => {
    if (!currentManga) return;
    setIsGenerating(true);
    setView('viewer');
    setCurrentPageIndex(0);
    
    try {
      const manga = { ...currentManga };
      for (let i = 0; i < manga.pages.length; i++) {
        const page = manga.pages[i];
        for (let j = 0; j < page.panels.length; j++) {
          const panel = page.panels[j];
          setStatusMessage(`Inking Page ${i + 1}, Panel ${j + 1}...`);
          try {
            const imageData = await generateMangaImage(panel.scene_description, style);
            panel.image_data = imageData;
            setCurrentManga({ ...manga });
            
            await fetch('/api/manga/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(manga)
            });
          } catch (e) {
            console.error(`Failed to generate panel ${j + 1} for page ${i + 1}`, e);
          }
        }
      }
      setStatusMessage('Manga generation complete!');
      addNotification('Manga generation complete! Your masterpiece is ready.', 'success');
      fetchUserSessions();
    } catch (error) {
      console.error(error);
      addNotification('Critical error during inking. Please check your connection.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const updatePanelDescription = (pageId: string, panelId: string, description: string) => {
    if (!currentManga) return;
    const newManga = { ...currentManga };
    const page = newManga.pages.find(p => p.id === pageId);
    if (page) {
      const panel = page.panels.find(p => p.id === panelId);
      if (panel) {
        panel.scene_description = description;
      }
    }
    setCurrentManga(newManga);
  };

  const updateDialogueText = (pageId: string, panelId: string, dialogueId: string, text: string) => {
    if (!currentManga) return;
    const newManga = { ...currentManga };
    const page = newManga.pages.find(p => p.id === pageId);
    if (page) {
      const panel = page.panels.find(p => p.id === panelId);
      if (panel) {
        const dialogue = panel.dialogues.find(d => d.id === dialogueId);
        if (dialogue) {
          dialogue.text = text;
        }
      }
    }
    setCurrentManga(newManga);
  };

  const handleRegeneratePanel = async (pageId: string, panelId: string) => {
    if (!currentManga || isGenerating) return;
    setIsGenerating(true);
    setStatusMessage('Regenerating panel art...');
    try {
      const manga = { ...currentManga };
      const page = manga.pages.find(p => p.id === pageId);
      if (!page) return;
      const panel = page.panels.find(p => p.id === panelId);
      if (!panel) return;

      const imageData = await generateMangaImage(panel.scene_description, style);
      panel.image_data = imageData;
      
      setCurrentManga({ ...manga });
      await fetch('/api/manga/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manga)
      });
      addNotification('Panel updated!', 'success');
    } catch (error) {
      console.error(error);
      addNotification('Failed to regenerate panel.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };
  const handleSaveDraft = async () => {
    if (!currentManga) return;
    setIsGenerating(true);
    setStatusMessage('Saving draft...');
    try {
      await fetch('/api/manga/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentManga)
      });
      addNotification('Draft saved successfully!', 'success');
      fetchUserSessions();
    } catch (e) {
      console.error(e);
      addNotification('Failed to save draft.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!currentManga) return;
    try {
      await fetch('/api/manga/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentManga.id })
      });
      setCurrentManga({ ...currentManga, is_published: true });
      fetchPublished();
      addNotification('Manga published to the global library!', 'success');
    } catch (e) {
      console.error(e);
      addNotification('Failed to publish manga.', 'error');
    }
  };

  const handleDownload = () => {
    if (!currentManga || !currentManga.is_published) {
      setStatusMessage("You must publish the manga before downloading!");
      setTimeout(() => setStatusMessage(""), 3000);
      return;
    }
    const link = document.createElement('a');
    link.href = currentManga.pages[currentPageIndex].panels[0]?.image_data || '';
    link.download = `${currentManga.title}_page_${currentPageIndex + 1}.png`;
    link.click();
  };

  const loadManga = async (id: string) => {
    try {
      const res = await fetch(`/api/manga/${id}`);
      const data = await res.json();
      setCurrentManga(data);
      setView('viewer');
      setCurrentPageIndex(0);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F5F4] text-[#0A0A0A] font-sans selection:bg-[#FF4E00] selection:text-white noise">
      {/* Notifications */}
      <div className="fixed top-24 right-8 z-[100] flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl border-2 shadow-2xl min-w-[300px] ${
                n.type === 'success' ? 'bg-white border-green-500 text-green-700' :
                n.type === 'error' ? 'bg-white border-red-500 text-red-700' :
                'bg-white border-[#0A0A0A] text-[#0A0A0A]'
              }`}
            >
              {n.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : 
               n.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
               <Loader2 className="w-5 h-5 animate-spin" />}
              <span className="text-[10px] font-black uppercase tracking-widest flex-1">{n.message}</span>
              <button onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}>
                <X className="w-4 h-4 opacity-40 hover:opacity-100" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="border-b-2 border-[#0A0A0A] p-6 flex justify-between items-center sticky top-0 bg-[#F5F5F4]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
          <div className="bg-[#0A0A0A] text-white p-2 rounded-lg group-hover:rotate-12 transition-transform">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black display uppercase tracking-tighter">Manga.AI</h1>
        </div>
        <div className="hidden md:flex gap-8 text-xs font-bold uppercase tracking-[0.2em]">
          <button onClick={() => setView('create')} className={`hover:text-[#FF4E00] transition-colors ${view === 'create' ? 'text-[#FF4E00]' : ''}`}>Create</button>
          <button onClick={() => setView('library')} className={`hover:text-[#FF4E00] transition-colors ${view === 'library' ? 'text-[#FF4E00]' : ''}`}>Library</button>
          <button onClick={() => { setView('sessions'); fetchUserSessions(); }} className={`hover:text-[#FF4E00] transition-colors ${view === 'sessions' ? 'text-[#FF4E00]' : ''}`}>My Studio</button>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase opacity-40">Artist Profile</span>
            <span className="text-xs font-bold">{user?.username}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF4E00] to-orange-300 border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]"></div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-32"
            >
              {/* Hero Section - Split Screen Style */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-4 border-[#0A0A0A] rounded-[40px] overflow-hidden bg-white shadow-[20px_20px_0px_#0A0A0A]">
                <div className="lg:col-span-7 p-8 md:p-16 flex flex-col justify-center space-y-12 border-b-4 lg:border-b-0 lg:border-r-4 border-[#0A0A0A]">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0A0A0A] text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
                      <span className="w-2 h-2 bg-[#FF4E00] rounded-full animate-pulse"></span>
                      v2.0 Creative Engine
                    </div>
                    <h2 className="text-7xl md:text-[120px] font-black display uppercase leading-[0.8] tracking-tighter">
                      Manga <br />
                      <span className="text-[#FF4E00] italic">Evolution</span>
                    </h2>
                    <p className="text-2xl serif italic opacity-80 max-w-xl leading-snug">
                      The world's first AI-native manga studio. Professional storyboarding, 
                      cinematic framing, and automated dialogue integration in one seamless workflow.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-6">
                    <button 
                      onClick={() => setView('create')}
                      className="group relative bg-[#FF4E00] text-white px-10 py-5 rounded-2xl text-sm font-black uppercase tracking-widest overflow-hidden transition-all hover:pr-14"
                    >
                      <span className="relative z-10">Start Project</span>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                    <button 
                      onClick={() => setView('library')}
                      className="px-10 py-5 rounded-2xl text-sm font-black uppercase tracking-widest border-2 border-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-all"
                    >
                      Browse Archive
                    </button>
                  </div>

                  <div className="pt-12 border-t border-gray-100 flex gap-12">
                    <div>
                      <div className="text-4xl font-black display">50K+</div>
                      <div className="text-[10px] font-black uppercase opacity-40 tracking-widest">Panels Generated</div>
                    </div>
                    <div>
                      <div className="text-4xl font-black display">12K</div>
                      <div className="text-[10px] font-black uppercase opacity-40 tracking-widest">Active Artists</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 relative bg-[#0A0A0A] min-h-[500px] overflow-hidden group">
                  <img 
                    src="https://picsum.photos/seed/manga-hero/1200/1600" 
                    className="w-full h-full object-cover grayscale opacity-60 group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
                    alt="Manga Art"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent"></div>
                  <div className="absolute bottom-12 left-12 right-12">
                    <div className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl text-white space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Currently Trending</div>
                      <div className="text-2xl font-black display uppercase italic">"Neon Shadows: Tokyo"</div>
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        1.2k Readers Online
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Marquee Section */}
              <div className="relative py-12 border-y-4 border-[#0A0A0A] overflow-hidden bg-white -mx-6 md:-mx-12">
                <div className="flex whitespace-nowrap animate-marquee">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex items-center gap-12 mx-6">
                      <span className="text-6xl font-black display uppercase tracking-tighter">AI Storyboarding</span>
                      <Plus className="w-8 h-8 text-[#FF4E00]" />
                      <span className="text-6xl font-black display uppercase tracking-tighter text-transparent border-text">Cinematic Framing</span>
                      <Plus className="w-8 h-8 text-[#FF4E00]" />
                      <span className="text-6xl font-black display uppercase tracking-tighter">Dynamic Dialogue</span>
                      <Plus className="w-8 h-8 text-[#FF4E00]" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Features - Bento Grid Style */}
              <section className="space-y-12">
                <div className="text-center space-y-4">
                  <h3 className="text-5xl md:text-7xl font-black display uppercase tracking-tighter">The <span className="text-[#FF4E00]">Engine</span> Room</h3>
                  <p className="serif italic text-xl opacity-60">Built for creators who demand professional results.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[600px]">
                  <div className="md:col-span-8 bg-white border-4 border-[#0A0A0A] rounded-[40px] p-12 flex flex-col justify-between shadow-xl group hover:shadow-2xl transition-all">
                    <div className="space-y-6">
                      <div className="w-16 h-16 bg-[#FF4E00] rounded-2xl flex items-center justify-center text-white">
                        <Send className="w-8 h-8" />
                      </div>
                      <h4 className="text-4xl font-black display uppercase">Automated Storyboarding</h4>
                      <p className="text-xl serif italic opacity-60 max-w-xl">
                        Input a single sentence and watch as our AI constructs a multi-page storyboard 
                        complete with scene descriptions, camera angles, and character dialogue.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      {['Pacing Control', 'Scene Logic', 'Visual Flow'].map(t => (
                        <span key={t} className="px-4 py-2 bg-[#F5F5F4] border-2 border-[#0A0A0A] rounded-xl text-[10px] font-black uppercase tracking-widest">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-4 bg-[#FF4E00] border-4 border-[#0A0A0A] rounded-[40px] p-12 text-white flex flex-col justify-center space-y-8 shadow-xl">
                    <div className="text-8xl font-black display leading-none tracking-tighter">20</div>
                    <div className="space-y-2">
                      <h4 className="text-2xl font-black display uppercase">Page Capacity</h4>
                      <p className="text-sm font-medium opacity-80">Generate full-length chapters in minutes, not months.</p>
                    </div>
                  </div>
                  <div className="md:col-span-4 bg-[#0A0A0A] border-4 border-[#0A0A0A] rounded-[40px] p-12 text-white flex flex-col justify-between shadow-xl">
                    <History className="w-12 h-12 text-[#FF4E00]" />
                    <div className="space-y-2">
                      <h4 className="text-2xl font-black display uppercase">Session Sync</h4>
                      <p className="text-sm font-medium opacity-60">Your creative sessions are automatically saved to your private studio.</p>
                    </div>
                  </div>
                  <div className="md:col-span-8 bg-white border-4 border-[#0A0A0A] rounded-[40px] p-12 flex items-center gap-12 shadow-xl overflow-hidden relative">
                    <div className="relative z-10 space-y-4">
                      <h4 className="text-4xl font-black display uppercase">Global Reach</h4>
                      <p className="text-lg serif italic opacity-60">Create in English, Japanese, Tamil, and more. Connect with a global audience.</p>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 pointer-events-none">
                      <div className="text-[200px] font-black display uppercase leading-none rotate-12">Manga</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="bg-[#0A0A0A] rounded-[60px] p-12 md:p-24 text-center space-y-12 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="grid grid-cols-6 gap-4 h-full">
                    {[...Array(24)].map((_, i) => (
                      <div key={i} className="border border-white/20 rounded-lg"></div>
                    ))}
                  </div>
                </div>
                <div className="relative z-10 space-y-6">
                  <h3 className="text-6xl md:text-8xl font-black display uppercase text-white leading-none tracking-tighter">
                    Ready to <br />
                    <span className="text-[#FF4E00]">Publish?</span>
                  </h3>
                  <p className="text-xl serif italic text-white/60 max-w-2xl mx-auto">
                    Join thousands of creators and start building your manga empire today. 
                    No drawing skills required. Just your imagination.
                  </p>
                  <button 
                    onClick={() => setView('create')}
                    className="bg-white text-[#0A0A0A] px-12 py-6 rounded-3xl text-lg font-black uppercase tracking-[0.2em] hover:bg-[#FF4E00] hover:text-white transition-all shadow-[0px_10px_40px_rgba(255,78,0,0.3)]"
                  >
                    Launch Studio
                  </button>
                </div>
              </section>
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-4 space-y-8">
                  <div className="space-y-4">
                    <h2 className="text-6xl font-black display uppercase leading-none">Creative <br /> <span className="text-[#FF4E00]">Terminal</span></h2>
                    <p className="serif italic opacity-60 text-lg">Initialize your narrative parameters and let the AI architect your vision.</p>
                  </div>
                  
                  <div className="p-8 bg-[#0A0A0A] text-white rounded-[40px] space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <BookOpen className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-8 h-8 bg-[#FF4E00] rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">System Status</span>
                    </div>
                    <div className="space-y-4 relative z-10">
                      <div className="flex justify-between text-[10px] font-bold uppercase opacity-40">
                        <span>Engine Load</span>
                        <span>Optimal</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF4E00] w-[70%]"></div>
                      </div>
                      <p className="text-xs opacity-70 leading-relaxed serif italic">
                        "The best manga starts with a strong emotional core. Focus on the 'Why' of your story."
                      </p>
                    </div>

                    <div className="pt-6 border-t border-white/10 space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-40">
                        <span>Neural Capacity</span>
                        <span>v3.1 Pro</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[8px] font-black uppercase">
                          <span>Context Window</span>
                          <span>2,000,000 Tokens</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="w-[0.5%] h-full bg-[#FF4E00]"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 border-2 border-[#0A0A0A] rounded-3xl text-center">
                      <div className="text-2xl font-black display">20</div>
                      <div className="text-[8px] font-black uppercase opacity-40">Max Pages</div>
                    </div>
                    <div className="p-6 border-2 border-[#0A0A0A] rounded-3xl text-center">
                      <div className="text-2xl font-black display">6</div>
                      <div className="text-[8px] font-black uppercase opacity-40">Languages</div>
                    </div>
                  </div>
                </div>
                
                <div className="lg:col-span-8 bg-white border-4 border-[#0A0A0A] p-10 rounded-[50px] shadow-[20px_20px_0px_#0A0A0A] relative">
                  <div className="absolute -top-4 -right-4 bg-[#FF4E00] text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                    Project Alpha
                  </div>
                  
                  <div className="space-y-10">
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF4E00]">Narrative Input</label>
                        <span className="text-[8px] font-bold opacity-30 uppercase">{prompt.length} / 1000</span>
                      </div>
                      <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="A samurai in a neon-lit Tokyo discovers a hidden digital world..."
                        className="w-full h-48 p-8 bg-[#F5F5F4] border-2 border-[#0A0A0A] rounded-[32px] focus:ring-8 ring-[#FF4E00]/10 outline-none resize-none font-medium text-lg placeholder:opacity-20 transition-all"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF4E00]">Narrative Theme</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {THEMES.map(t => (
                          <button
                            key={t}
                            onClick={() => setTheme(t)}
                            className={`p-4 border-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === t ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white shadow-lg' : 'border-gray-100 hover:border-[#0A0A0A] bg-white'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF4E00]">Visual Aesthetic</label>
                        <div className="grid grid-cols-2 gap-3">
                          {STYLES.map(s => (
                            <button
                              key={s.id}
                              onClick={() => setStyle(s.id as 'bw' | 'color')}
                              className={`p-5 border-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-3 ${style === s.id ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white shadow-lg' : 'border-gray-100 hover:border-[#0A0A0A] bg-white'}`}
                            >
                              <span className="text-2xl">{s.icon}</span>
                              {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF4E00]">Localization</label>
                        <div className="relative">
                          <select 
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full p-5 bg-[#F5F5F4] border-2 border-[#0A0A0A] rounded-2xl outline-none font-black text-xs uppercase tracking-widest appearance-none cursor-pointer"
                          >
                            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF4E00]">Chapter Length</label>
                        <span className="text-xs font-black">{pageCount} Pages</span>
                      </div>
                      <input 
                        type="range"
                        min="1"
                        max="20"
                        value={pageCount}
                        onChange={(e) => setPageCount(Number(e.target.value))}
                        className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#FF4E00]"
                      />
                      <div className="flex justify-between text-[8px] font-black uppercase opacity-30">
                        <span>One-Shot</span>
                        <span>Full Chapter</span>
                      </div>
                    </div>

                    <button 
                      disabled={isGenerating || !prompt}
                      onClick={handleGenerate}
                      className="group relative w-full bg-[#FF4E00] text-white py-6 rounded-3xl font-black uppercase tracking-[0.3em] text-sm overflow-hidden transition-all disabled:opacity-50 shadow-[0px_10px_30px_rgba(255,78,0,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div className="relative z-10 flex items-center justify-center gap-4">
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            <span>Initialize Generation</span>
                          </>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'storyboard_editor' && currentManga && (
            <motion.div
              key="storyboard_editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-6xl mx-auto space-y-12 pb-32"
            >
              <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b-8 border-[#0A0A0A] pb-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-1 bg-[#FF4E00]"></div>
                    <span className="text-xs font-black uppercase tracking-[0.5em] text-[#FF4E00]">Phase 02: Editorial</span>
                  </div>
                  <h2 className="text-7xl font-black uppercase leading-[0.85] tracking-tighter">
                    Storyboard <br />
                    <span className="text-outline-black text-transparent">Review</span>
                  </h2>
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={() => setView('create')}
                    className="px-8 py-5 rounded-2xl border-4 border-[#0A0A0A] font-black uppercase tracking-widest text-xs hover:bg-[#F5F5F4] transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleStartInking}
                    disabled={isGenerating}
                    className="bg-[#0A0A0A] text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#FF4E00] transition-all shadow-xl flex items-center gap-4 group disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                    Start Inking
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                <div className="lg:col-span-8 space-y-8 lg:space-y-12">
                  {currentManga.pages.map((page, pIdx) => (
                    <div key={page.id} className="group relative">
                      <div className="absolute -left-12 top-0 hidden xl:flex flex-col items-center gap-4">
                        <div className="w-8 h-8 rounded-full border-2 border-[#0A0A0A] flex items-center justify-center text-[10px] font-black">
                          {pIdx + 1}
                        </div>
                        <div className="w-0.5 h-full bg-[#0A0A0A]/10 group-last:hidden"></div>
                      </div>
                      
                      <div className="bg-white border-4 border-[#0A0A0A] rounded-[30px] lg:rounded-[40px] overflow-hidden shadow-[6px_6px_0px_#0A0A0A] lg:shadow-[10px_10px_0px_#0A0A0A]">
                        <div className="bg-[#0A0A0A] text-white px-6 lg:px-8 py-4 flex justify-between items-center">
                          <div className="flex items-center gap-3 lg:gap-4">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                              Page {pIdx + 1}
                            </span>
                            {pIdx === 0 && <span className="bg-[#FF4E00] text-[8px] px-2 py-0.5 rounded font-black uppercase">Title</span>}
                            {pIdx === currentManga.pages.length - 1 && <span className="bg-[#FF4E00] text-[8px] px-2 py-0.5 rounded font-black uppercase">End</span>}
                          </div>
                          <div className="text-[10px] font-black opacity-40 uppercase tracking-widest">
                            {page.panels.length} Panels
                          </div>
                        </div>
                        
                        <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
                          {page.panels.map((panel, panIdx) => (
                            <div key={panel.id} className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 p-4 lg:p-6 bg-[#F5F5F4] rounded-2xl lg:rounded-3xl border-2 border-transparent hover:border-[#0A0A0A] transition-all">
                              <div className="md:col-span-4 space-y-4">
                                <div className="flex items-center justify-between md:justify-start gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 bg-[#0A0A0A] text-white rounded flex items-center justify-center text-[10px] font-black">
                                      {panIdx + 1}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Composition</span>
                                  </div>
                                  <span className="md:hidden text-[8px] font-black uppercase px-2 py-1 bg-white border border-[#0A0A0A] rounded">{panel.layout_hint}</span>
                                </div>
                                <div className="hidden md:flex aspect-[3/4] bg-white border-2 border-[#0A0A0A] rounded-xl items-center justify-center p-4 text-center">
                                  <span className="text-[10px] font-black uppercase opacity-20 leading-tight">
                                    Layout Hint:<br/>
                                    <span className="text-[#0A0A0A] opacity-100">{panel.layout_hint}</span>
                                  </span>
                                </div>
                              </div>
                              
                              <div className="md:col-span-8 space-y-4 lg:space-y-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Scene Description</label>
                                  <textarea
                                    value={panel.scene_description}
                                    onChange={(e) => updatePanelDescription(page.id, panel.id, e.target.value)}
                                    className="w-full bg-white border-2 border-[#0A0A0A] rounded-xl lg:rounded-2xl p-4 lg:p-5 text-sm font-bold focus:ring-4 focus:ring-[#FF4E00]/10 outline-none transition-all min-h-[100px] lg:min-h-[140px] resize-none leading-relaxed"
                                  />
                                </div>
                                
                                <div className="space-y-3">
                                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Dialogue Script</label>
                                  <div className="space-y-2">
                                    {panel.dialogues.map((d) => (
                                      <div key={d.id} className="flex gap-3 items-center group/input">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF4E00] group-focus-within/input:scale-150 transition-transform"></div>
                                        <input
                                          type="text"
                                          value={d.text}
                                          onChange={(e) => updateDialogueText(page.id, panel.id, d.id, e.target.value)}
                                          className="flex-1 bg-white border-2 border-[#0A0A0A] rounded-lg lg:rounded-xl px-4 lg:px-5 py-2 lg:py-3 text-xs font-black uppercase tracking-tight focus:ring-4 focus:ring-[#FF4E00]/10 outline-none transition-all"
                                        />
                                      </div>
                                    ))}
                                    {panel.dialogues.length === 0 && (
                                      <div className="text-[10px] italic opacity-30 font-bold">No dialogue in this panel.</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-4 space-y-8">
                  <div className="sticky top-8 space-y-6">
                    <div className="bg-[#0A0A0A] text-white p-8 rounded-[40px] shadow-2xl space-y-6">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF4E00]">Project Status</span>
                        <h3 className="text-3xl font-black uppercase leading-none">{currentManga.title}</h3>
                      </div>
                      
                      <div className="space-y-4 pt-6 border-t border-white/10">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase opacity-40">Total Pages</span>
                          <span className="text-xl font-black">{currentManga.pages.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase opacity-40">Total Panels</span>
                          <span className="text-xl font-black">
                            {currentManga.pages.reduce((acc, p) => acc + p.panels.length, 0)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleSaveDraft}
                        disabled={isGenerating}
                        className="w-full bg-white border-2 border-[#0A0A0A] text-[#0A0A0A] py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-gray-50 transition-all flex items-center justify-center gap-4"
                      >
                        <Library className="w-4 h-4" />
                        Save Draft
                      </button>

                      <button
                        onClick={handleStartInking}
                        disabled={isGenerating}
                        className="w-full bg-[#FF4E00] text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0px_10px_30px_rgba(255,78,0,0.3)] flex items-center justify-center gap-4"
                      >
                        {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                        Finalize & Ink
                      </button>
                      
                      <p className="text-[9px] font-bold opacity-40 text-center leading-relaxed">
                        By clicking finalize, you confirm the storyboard is ready. The AI will then generate high-quality manga art for each panel.
                      </p>
                    </div>

                    <div className="p-8 bg-white border-4 border-[#0A0A0A] rounded-[40px] space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="w-5 h-5 text-[#FF4E00]" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Editor's Note</span>
                      </div>
                      <p className="text-xs font-bold leading-relaxed opacity-60">
                        You can refine the scene descriptions to change the camera angle, character expressions, or background details. The more specific you are, the better the final art will be.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'viewer' && currentManga && (
            <motion.div 
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 xl:grid-cols-12 gap-12"
            >
              <div className="xl:col-span-8 space-y-12">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-[#0A0A0A] rounded-[60px] blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative aspect-[3/4] bg-white border-4 border-[#0A0A0A] rounded-[50px] overflow-hidden shadow-2xl p-6">
                    <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
                      {currentManga.pages[currentPageIndex]?.panels.map((panel, idx) => (
                        <div 
                          key={panel.id}
                          className={`relative overflow-hidden border-2 border-[#0A0A0A] rounded-3xl group/panel ${
                            panel.layout_hint === 'full' ? 'col-span-2 row-span-2' :
                            panel.layout_hint === 'half-vertical' ? 'col-span-1 row-span-2' :
                            panel.layout_hint === 'half-horizontal' ? 'col-span-2 row-span-1' :
                            'col-span-1 row-span-1'
                          }`}
                        >
                          {panel.image_data ? (
                            <>
                              <img 
                                src={panel.image_data} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover/panel:scale-105" 
                                referrerPolicy="no-referrer" 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/panel:opacity-100 transition-opacity flex items-end justify-end p-4">
                                <button
                                  onClick={() => handleRegeneratePanel(currentManga.pages[currentPageIndex].id, panel.id)}
                                  className="bg-white/90 backdrop-blur-md text-[#0A0A0A] p-3 rounded-xl border-2 border-[#0A0A0A] hover:bg-[#FF4E00] hover:text-white transition-all shadow-xl"
                                  title="Regenerate Art"
                                >
                                  <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                </button>
                              </div>
                              {panel.dialogues.map(d => (
                                <div 
                                  key={d.id}
                                  style={{
                                    position: 'absolute',
                                    left: `${d.x}%`,
                                    top: `${d.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                  }}
                                  className="z-10"
                                >
                                  <motion.div 
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: 'spring', damping: 15 }}
                                    className="bg-white border-2 border-[#0A0A0A] rounded-[24px] px-5 py-3 text-center shadow-xl relative min-w-[80px] max-w-[220px] flex items-center justify-center"
                                  >
                                    <span className="text-[11px] font-black uppercase tracking-tight leading-tight text-[#0A0A0A]">{d.text}</span>
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-[#0A0A0A]"></div>
                                    <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white"></div>
                                  </motion.div>
                                </div>
                              ))}
                            </>
                          ) : (
                            <div className="w-full h-full bg-[#F5F5F4] flex flex-col items-center justify-center gap-3">
                              <Loader2 className="w-6 h-6 animate-spin text-[#FF4E00]" />
                              <span className="text-[8px] font-black uppercase opacity-30">Inking Panel {idx + 1}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="absolute bottom-12 right-12 text-[10px] font-black opacity-20 select-none pointer-events-none uppercase tracking-[0.5em] rotate-90 origin-bottom-right">
                      Manga.AI Studio | {currentManga.author_id.slice(0, 8)} | Page {currentPageIndex + 1}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white border-4 border-[#0A0A0A] p-6 rounded-[32px] shadow-xl">
                  <button 
                    disabled={currentPageIndex === 0}
                    onClick={() => setCurrentPageIndex(p => p - 1)}
                    className="group flex items-center gap-4 px-6 py-4 hover:bg-[#F5F5F4] rounded-2xl disabled:opacity-20 transition-all"
                  >
                    <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Previous</span>
                  </button>
                  <div className="flex flex-col items-center">
                    <div className="flex gap-1 mb-2">
                      {currentManga.pages.map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-1 rounded-full transition-all ${i === currentPageIndex ? 'w-8 bg-[#FF4E00]' : 'w-2 bg-gray-200'}`}
                        ></div>
                      ))}
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">
                      {currentPageIndex + 1} <span className="opacity-30">/</span> {currentManga.page_count}
                    </span>
                  </div>
                  <button 
                    disabled={currentPageIndex === currentManga.page_count - 1}
                    onClick={() => setCurrentPageIndex(p => p + 1)}
                    className="group flex items-center gap-4 px-6 py-4 hover:bg-[#F5F5F4] rounded-2xl disabled:opacity-20 transition-all"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Next</span>
                    <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              <div className="xl:col-span-4 space-y-8">
                <div className="bg-white border-4 border-[#0A0A0A] p-10 rounded-[50px] shadow-xl space-y-8">
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleBackToEditor}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-[#0A0A0A] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#F5F5F4] transition-all shadow-[4px_4px_0px_#0A0A0A]"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit Storyboard
                      </button>
                      <button 
                        onClick={() => setView('home')}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#0A0A0A] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#FF4E00] transition-all shadow-[4px_4px_0px_#FF4E00]"
                      >
                        <Library className="w-4 h-4" />
                        My Studio
                      </button>
                    </div>
                    <div className="h-0.5 bg-[#0A0A0A]/10"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="inline-block px-3 py-1 bg-[#0A0A0A] text-white text-[8px] font-black uppercase tracking-widest rounded">
                      Series Title
                    </div>
                    <h4 className="text-4xl font-black display uppercase italic leading-none">{currentManga.title}</h4>
                    <p className="text-base serif italic opacity-60 leading-relaxed">{currentManga.prompt}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[#F5F5F4] border-2 border-[#0A0A0A] rounded-2xl text-center">
                      <div className="text-[8px] font-black uppercase opacity-40 mb-1">Aesthetic</div>
                      <div className="text-xs font-black uppercase tracking-widest">{currentManga.style === 'bw' ? 'Noir' : 'Vivid'}</div>
                    </div>
                    <div className="p-4 bg-[#F5F5F4] border-2 border-[#0A0A0A] rounded-2xl text-center">
                      <div className="text-[8px] font-black uppercase opacity-40 mb-1">Region</div>
                      <div className="text-xs font-black uppercase tracking-widest">{currentManga.language}</div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t-2 border-[#0A0A0A]">
                    {!currentManga.is_published ? (
                      <button 
                        onClick={handlePublish}
                        className="w-full bg-[#0A0A0A] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-[#FF4E00] transition-colors shadow-lg"
                      >
                        <Library className="w-4 h-4" />
                        Publish to Library
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 text-green-600 font-black uppercase tracking-widest text-[10px] justify-center py-5 border-4 border-green-50 rounded-2xl bg-green-50/50">
                        <CheckCircle2 className="w-5 h-5" />
                        Live in Global Library
                      </div>
                    )}
                    
                    {currentManga.author_id === user?.id && (
                      <button 
                        onClick={handleDownload}
                        className="w-full border-4 border-[#0A0A0A] py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-[#0A0A0A] hover:text-white transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Export High-Res
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-[#FF4E00] text-white p-10 rounded-[50px] shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Plus className="w-48 h-48" />
                  </div>
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <h5 className="text-[10px] font-black uppercase tracking-[0.3em]">Artist Notes</h5>
                    </div>
                    <p className="text-lg serif italic leading-relaxed font-medium">
                      "{currentManga.pages[currentPageIndex]?.panels[0]?.scene_description}"
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-16"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 border-b-4 border-[#0A0A0A] pb-12">
                <div className="space-y-6">
                  <h2 className="text-8xl font-black display uppercase leading-none tracking-tighter">The <br /> <span className="text-[#FF4E00]">Archive</span></h2>
                  <p className="serif italic opacity-60 text-2xl max-w-xl">A curated collection of AI-generated narratives from around the globe.</p>
                </div>
                <div className="w-full md:w-80 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Community Spotlight</div>
                  <div className="bg-white border-4 border-[#0A0A0A] p-6 rounded-3xl flex items-center gap-6 group cursor-pointer hover:bg-[#0A0A0A] hover:text-white transition-all shadow-lg">
                    <div className="w-16 h-16 bg-[#FF4E00] rounded-2xl flex items-center justify-center text-white group-hover:rotate-12 transition-transform">
                      <Plus className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-sm font-black uppercase">Masterclass</div>
                      <div className="text-[10px] opacity-50 font-bold">Advanced Prompting</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                {publishedMangas.map(m => (
                  <motion.div 
                    key={m.id} 
                    whileHover={{ y: -12, scale: 1.02 }}
                    onClick={() => loadManga(m.id)}
                    className="bg-white border-4 border-[#0A0A0A] rounded-[40px] overflow-hidden cursor-pointer shadow-xl hover:shadow-[20px_20px_0px_rgba(0,0,0,0.1)] transition-all group"
                  >
                    <div className="aspect-[3/4] bg-[#F5F5F4] relative overflow-hidden border-b-4 border-[#0A0A0A]">
                      {m.cover_image ? (
                        <img 
                          src={m.cover_image} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-5 group-hover:scale-150 transition-transform duration-1000">
                          <BookOpen className="w-48 h-48" />
                        </div>
                      )}
                      <div className="absolute top-6 right-6 px-4 py-1.5 bg-white border-2 border-[#0A0A0A] rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                        {m.style === 'bw' ? 'Noir' : 'Vivid'}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <div className="p-8 space-y-6">
                      <h4 className="text-2xl font-black display uppercase italic truncate group-hover:text-[#FF4E00] transition-colors">{m.title}</h4>
                      <div className="flex justify-between items-center pt-6 border-t-2 border-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF4E00] to-orange-300 border-2 border-[#0A0A0A]"></div>
                          <span className="text-[10px] font-black uppercase opacity-40 tracking-widest">@{m.author_id.slice(0, 8)}</span>
                        </div>
                        <span className="text-[8px] font-black uppercase px-3 py-1.5 bg-[#F5F5F4] border border-[#0A0A0A] rounded-lg">{m.language}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'sessions' && (
            <motion.div 
              key="sessions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-16"
            >
              <div className="flex justify-between items-end border-b-4 border-[#0A0A0A] pb-12">
                <div className="space-y-6">
                  <h2 className="text-8xl font-black display uppercase leading-none tracking-tighter">My <br /> <span className="text-[#FF4E00]">Studio</span></h2>
                  <p className="serif italic opacity-60 text-2xl max-w-xl">Your private workspace for ongoing narratives and creative experiments.</p>
                </div>
                <button 
                  onClick={() => setView('create')}
                  className="hidden md:flex items-center gap-4 bg-[#0A0A0A] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#FF4E00] transition-colors shadow-xl"
                >
                  <Plus className="w-5 h-5" />
                  New Project
                </button>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {userMangas.length === 0 ? (
                  <div className="text-center py-40 border-8 border-dashed border-gray-100 rounded-[60px] bg-white/50">
                    <History className="w-32 h-32 mx-auto mb-8 opacity-5" />
                    <p className="font-black uppercase tracking-[0.6em] text-sm opacity-20">Studio Inactive</p>
                    <button 
                      onClick={() => setView('create')}
                      className="mt-10 bg-[#0A0A0A] text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#FF4E00] transition-all shadow-xl"
                    >
                      Initialize First Series
                    </button>
                  </div>
                ) : (
                  userMangas.map(m => (
                    <motion.div 
                      key={m.id}
                      whileHover={{ x: 20, backgroundColor: '#0A0A0A', color: '#FFFFFF' }}
                      onClick={() => loadManga(m.id)}
                      className="bg-white border-4 border-[#0A0A0A] p-10 rounded-[40px] flex flex-col md:flex-row justify-between items-start md:items-center gap-8 cursor-pointer transition-all group shadow-xl hover:shadow-[0px_20px_60px_rgba(0,0,0,0.1)]"
                    >
                      <div className="w-24 h-32 bg-[#F5F5F4] border-2 border-[#0A0A0A] rounded-xl overflow-hidden shrink-0 hidden md:block">
                        {m.cover_image ? (
                          <img src={m.cover_image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-10">
                            <BookOpen className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-4">
                          <h4 className="text-4xl font-black display uppercase italic leading-none">{m.title}</h4>
                          <span className="text-[10px] font-black uppercase px-3 py-1 bg-[#F5F5F4] text-[#0A0A0A] rounded-full border border-[#0A0A0A] group-hover:bg-[#FF4E00] group-hover:text-white transition-colors">{m.style === 'bw' ? 'Noir' : 'Vivid'}</span>
                        </div>
                        <p className="text-lg serif italic opacity-50 truncate max-w-2xl group-hover:opacity-80 transition-opacity">{m.prompt}</p>
                      </div>
                      <div className="flex items-center gap-12 w-full md:w-auto justify-between md:justify-end border-t-2 md:border-t-0 md:border-l-2 border-gray-100 group-hover:border-white/10 pt-8 md:pt-0 md:pl-12">
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase opacity-40 tracking-widest group-hover:opacity-60">Created</div>
                          <div className="text-sm font-black">{new Date(m.created_at).toLocaleDateString()}</div>
                        </div>
                        <div className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${m.is_published ? 'bg-green-50 text-green-700 group-hover:bg-green-600 group-hover:text-white' : 'bg-yellow-50 text-yellow-700 group-hover:bg-yellow-600 group-hover:text-white'}`}>
                          {m.is_published ? 'Live' : 'Draft'}
                        </div>
                        <div className="w-12 h-12 rounded-full border-2 border-[#0A0A0A] group-hover:border-white flex items-center justify-center transition-colors">
                          <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Status Bar */}
      {isGenerating && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#0A0A0A] text-white px-8 py-4 rounded-full flex items-center gap-4 shadow-2xl border-2 border-[#FF4E00] z-[100]"
        >
          <Loader2 className="w-4 h-4 animate-spin text-[#FF4E00]" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">{statusMessage}</span>
        </motion.div>
      )}

      {/* Global Footer */}
      <footer className="border-t-2 border-[#0A0A0A] p-12 mt-24">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="bg-[#0A0A0A] text-white p-1.5 rounded-md">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-lg font-black display uppercase tracking-tighter">Manga.AI</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">
            Â© 2026 AI Studio Build | Professional Creative Suite
          </div>
          <div className="flex gap-6">
            {['Twitter', 'Discord', 'Github'].map(s => (
              <span key={s} className="text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-[#FF4E00]">{s}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
    </ErrorBoundary>
  );
}
