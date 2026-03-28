import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layout, 
  Palette, 
  Code, 
  LogOut, 
  User as UserIcon, 
  Trophy, 
  ChevronRight, 
  CheckCircle2, 
  XCircle,
  ArrowLeft,
  Loader2,
  Sun,
  Moon,
  Languages,
  Terminal,
  Coffee,
  Database
} from 'lucide-react';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc
} from 'firebase/firestore';
import { QUIZ_DATA, QuizTheme, Question } from './QuizData';
import { cn } from './lib/utils';

// --- Translations ---

const TRANSLATIONS = {
  en: {
    tagline: "Master Web Dev with",
    taglineHighlight: "Interactive Quizzes",
    description: "Test your skills in HTML, CSS, and JavaScript. Track your progress, compete with others, and become a frontend expert.",
    getStarted: "Get Started Now",
    chooseTheme: "Choose a Theme",
    recentScores: "Your Recent Scores",
    startQuiz: "Start Quiz",
    question: "Question",
    of: "of",
    quizCompleted: "Quiz Completed!",
    greatJob: "Great job on finishing the",
    quiz: "quiz.",
    finalScore: "Your Final Score",
    perfect: "Perfect Score!",
    wellDone: "Well Done!",
    backDashboard: "Back to Dashboard",
    tryAgain: "Try Again",
    scoreLabel: "Score",
    anonymous: "Anonymous"
  },
  fr: {
    tagline: "Maîtrisez le Web avec des",
    taglineHighlight: "Quiz Interactifs",
    description: "Testez vos compétences en HTML, CSS et JavaScript. Suivez vos progrès, comparez vos scores et devenez un expert frontend.",
    getStarted: "Commencer Maintenant",
    chooseTheme: "Choisissez un Thème",
    recentScores: "Vos Scores Récents",
    startQuiz: "Démarrer le Quiz",
    question: "Question",
    of: "sur",
    quizCompleted: "Quiz Terminé !",
    greatJob: "Bravo d'avoir terminé le quiz",
    quiz: "",
    finalScore: "Votre Score Final",
    perfect: "Score Parfait !",
    wellDone: "Bien Joué !",
    backDashboard: "Retour au Tableau de Bord",
    tryAgain: "Réessayer",
    scoreLabel: "Score",
    anonymous: "Anonyme"
  }
};

// --- Components ---

const FoxLogo = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    className={cn("w-12 h-12", className)}
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M50 10L20 40L30 85L50 95L70 85L80 40L50 10Z" 
      fill="#F97316" 
      stroke="#1E3A8A" 
      strokeWidth="2"
    />
    <path d="M20 40L50 60L80 40" stroke="#1E3A8A" strokeWidth="2" />
    <circle cx="35" cy="45" r="3" fill="#1E3A8A" />
    <circle cx="65" cy="45" r="3" fill="#1E3A8A" />
    <path d="M45 75L50 80L55 75" stroke="#1E3A8A" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  disabled,
  loading
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md dark:bg-blue-700 dark:hover:bg-blue-800',
    secondary: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md dark:bg-orange-600 dark:hover:bg-orange-700',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950',
    ghost: 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "px-6 py-2.5 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

// --- App Logic ---

type Screen = 'landing' | 'dashboard' | 'quiz' | 'results';
type Language = 'en' | 'fr';
type Theme = 'light' | 'dark';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('landing');
  const [selectedTheme, setSelectedTheme] = useState<QuizTheme | null>(null);
  const [randomizedQuestions, setRandomizedQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [userScores, setUserScores] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New state for Language and Theme
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');

  const t = TRANSLATIONS[language];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setScreen('dashboard');
        const userRef = doc(db, 'users', u.uid);
        setDoc(userRef, {
          uid: u.uid,
          displayName: u.displayName || t.anonymous,
          email: u.email,
          createdAt: serverTimestamp()
        }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
      } else {
        setScreen('landing');
      }
    });
    return () => unsubscribe();
  }, [language]);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'scores'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const scores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUserScores(scores);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'scores'));
      return () => unsubscribe();
    }
  }, [user]);

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const startQuiz = (theme: QuizTheme) => {
    // Randomize questions and pick a subset of 10
    const shuffled = [...theme.questions].sort(() => Math.random() - 0.5);
    const subset = shuffled.slice(0, 10);
    setRandomizedQuestions(subset);
    setSelectedTheme(theme);
    setCurrentQuestionIndex(0);
    setScore(0);
    setScreen('quiz');
  };

  const submitQuiz = async (finalScore: number) => {
    if (!user || !selectedTheme) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'scores'), {
        userId: user.uid,
        theme: selectedTheme.title.en, // Store canonical title
        score: finalScore,
        total: randomizedQuestions.length,
        timestamp: serverTimestamp()
      });
      setScreen('results');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'scores');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onAnswerClick = (idx: number) => {
    const isCorrect = idx === randomizedQuestions[currentQuestionIndex].correctAnswer;
    const newScore = isCorrect ? score + 1 : score;
    
    if (currentQuestionIndex + 1 < randomizedQuestions.length) {
      setScore(newScore);
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      submitQuiz(newScore);
    }
  };

  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'fr' : 'en');
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans selection:bg-orange-200 transition-colors duration-300">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setScreen(user ? 'dashboard' : 'landing')}
          >
            <FoxLogo className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight text-blue-900 dark:text-blue-400">KESIDEA</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" onClick={toggleLanguage} className="p-2 sm:px-3">
              <Languages className="w-5 h-5" />
              <span className="hidden sm:inline text-xs uppercase font-bold">{language}</span>
            </Button>
            
            <Button variant="ghost" onClick={toggleTheme} className="p-2">
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>

            {user && (
              <>
                <div className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
                  <UserIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">{user.displayName}</span>
                </div>
                <Button variant="ghost" onClick={handleLogout} className="p-2">
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {screen === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center py-12 sm:py-20"
            >
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-orange-400 blur-3xl opacity-20 rounded-full" />
                <FoxLogo className="w-32 h-32 relative" />
              </div>
              <h1 className="text-4xl sm:text-6xl font-black text-blue-900 dark:text-blue-400 mb-6 leading-tight">
                {t.tagline} <br />
                <span className="text-orange-500">{t.taglineHighlight}</span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mb-10">
                {t.description}
              </p>
              <Button onClick={handleLogin} variant="secondary" className="text-lg px-10 py-4 rounded-2xl">
                {t.getStarted}
              </Button>
            </motion.div>
          )}

          {screen === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              <section>
                <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-400 mb-6 flex items-center gap-2">
                  <Trophy className="text-orange-500" />
                  {t.chooseTheme}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {QUIZ_DATA.map((theme) => (
                    <motion.div
                      key={theme.id}
                      whileHover={{ y: -5 }}
                      className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-all cursor-pointer group"
                      onClick={() => startQuiz(theme)}
                    >
                      <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                        {theme.icon === 'layout' && <Layout className="w-7 h-7 text-blue-600 group-hover:text-white" />}
                        {theme.icon === 'palette' && <Palette className="w-7 h-7 text-blue-600 group-hover:text-white" />}
                        {theme.icon === 'code' && <Code className="w-7 h-7 text-blue-600 group-hover:text-white" />}
                        {theme.icon === 'terminal' && <Terminal className="w-7 h-7 text-blue-600 group-hover:text-white" />}
                        {theme.icon === 'coffee' && <Coffee className="w-7 h-7 text-blue-600 group-hover:text-white" />}
                        {theme.icon === 'database' && <Database className="w-7 h-7 text-blue-600 group-hover:text-white" />}
                      </div>
                      <h3 className="text-xl font-bold mb-2">{theme.title[language]}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{theme.description[language]}</p>
                      <div className="flex items-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                        {t.startQuiz} <ChevronRight className="w-4 h-4 ml-1" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>

              {userScores.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-400 mb-6">{t.recentScores}</h2>
                  <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {userScores.slice(0, 5).map((s) => (
                        <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              s.theme === 'HTML' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' :
                              s.theme === 'CSS' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                              s.theme === 'JavaScript' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30' :
                              s.theme === 'Python' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                              s.theme === 'Java' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                              'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30'
                            )}>
                              {s.theme === 'HTML' && <Layout className="w-5 h-5" />}
                              {s.theme === 'CSS' && <Palette className="w-5 h-5" />}
                              {s.theme === 'JavaScript' && <Code className="w-5 h-5" />}
                              {s.theme === 'Python' && <Terminal className="w-5 h-5" />}
                              {s.theme === 'Java' && <Coffee className="w-5 h-5" />}
                              {s.theme === 'MySQL' && <Database className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-bold">{s.theme}</p>
                              <p className="text-xs text-gray-400">
                                {s.timestamp?.toDate().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-blue-900 dark:text-blue-400">{s.score}/{s.total}</p>
                            <p className="text-xs text-gray-400">{t.scoreLabel}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {screen === 'quiz' && selectedTheme && (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-2xl mx-auto"
            >
              <div className="mb-8 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setScreen('dashboard')} className="px-2">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="text-center">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">{selectedTheme.title[language]}</p>
                  <p className="text-gray-400 text-xs">{t.question} {currentQuestionIndex + 1} {t.of} {randomizedQuestions.length}</p>
                </div>
                <div className="w-10" />
              </div>

              <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-800 mb-8">
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full mb-8 overflow-hidden">
                  <motion.div 
                    className="bg-orange-500 h-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentQuestionIndex + 1) / randomizedQuestions.length) * 100}%` }}
                  />
                </div>

                <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-8 leading-snug">
                  {randomizedQuestions[currentQuestionIndex].text[language]}
                </h2>

                <div className="space-y-4">
                  {randomizedQuestions[currentQuestionIndex].options[language].map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => onAnswerClick(idx)}
                      className="w-full text-left p-5 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-blue-600 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-900 dark:group-hover:text-blue-400">{option}</span>
                      <div className="w-6 h-6 rounded-full border-2 border-gray-200 dark:border-gray-700 group-hover:border-blue-600 dark:group-hover:border-blue-400 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'results' && selectedTheme && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto text-center py-12"
            >
              <div className="mb-8 relative inline-block">
                <div className="absolute inset-0 bg-blue-400 blur-3xl opacity-20" />
                <div className="relative bg-white dark:bg-gray-900 w-24 h-24 rounded-3xl shadow-lg flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-12 h-12 text-orange-500" />
                </div>
              </div>
              
              <h2 className="text-3xl font-black text-blue-900 dark:text-blue-400 mb-2">{t.quizCompleted}</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">{t.greatJob} {selectedTheme.title[language]} {t.quiz}</p>
              
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-lg border border-gray-100 dark:border-gray-800 mb-10">
                <p className="text-sm text-gray-400 uppercase font-bold tracking-widest mb-2">{t.finalScore}</p>
                <div className="text-6xl font-black text-blue-900 dark:text-blue-100 mb-4">
                  {score}<span className="text-gray-300 dark:text-gray-700 text-4xl">/{randomizedQuestions.length}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-green-600 font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  {score === randomizedQuestions.length ? t.perfect : t.wellDone}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <Button onClick={() => setScreen('dashboard')} className="w-full py-4 rounded-2xl">
                  {t.backDashboard}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => startQuiz(selectedTheme)} 
                  className="w-full py-4 rounded-2xl"
                >
                  {t.tryAgain}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 text-center text-gray-400 text-sm">
        <p>&copy; 2026 KESIDEA. All rights reserved.</p>
      </footer>
    </div>
  );
}
