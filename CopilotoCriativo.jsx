import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { Book, Feather, User, Bot, FileText, Send, PlusCircle, BrainCircuit, Sparkles } from 'lucide-react';

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDsRXLZVJbSEuKpkoG1R5ICKYy_ZTmzh_E",
  authDomain: "capitulo-vivo1.firebaseapp.com",
  projectId: "capitulo-vivo1",
  storageBucket: "capitulo-vivo1.firebasestorage.app",
  messagingSenderId: "73431586184",
  appId: "1:73431586184:web:d79856d29bde803d60563d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const IconWithTooltip = ({ icon, text }) => (
  <div className="relative flex items-center group">
    {icon}
    <div className="absolute left-full ml-4 w-auto p-2 min-w-max rounded-md shadow-md text-white bg-gray-900 text-xs font-bold transition-all duration-100 scale-0 origin-left group-hover:scale-100">
      {text}
    </div>
  </div>
);

const Toast = ({ message, onDone }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDone(), 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed top-5 right-5 bg-green-600 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-down">
      {message}
    </div>
  );
};

export default function CopilotoCriativo() {
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [chapterContent, setChapterContent] = useState('');
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const appId = 'copiloto-criativo-standalone';
  const chatEndRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Error signing in anonymously:", error);
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !userId) return;
    const chaptersPath = `/artifacts/${appId}/users/${userId}/chapters`;
    const q = query(collection(db, chaptersPath));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chaptersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      chaptersData.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setChapters(chaptersData);
    }, (error) => console.error("Erro ao carregar capítulos:", error));

    return () => unsubscribe();
  }, [isAuthReady, userId, appId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedChapter) {
      setChapterContent(selectedChapter.content || '');
      setMessages([{ sender: 'ai', text: `Pronto para trabalhar no capítulo "${selectedChapter.title}"! O que vamos criar hoje?` }]);
    } else {
      setChapterContent('');
      setMessages([]);
    }
  }, [selectedChapter]);

  const showToast = (message) => {
    setToastMessage(message);
  };

  const callGeminiAPI = async (userPrompt, contextPrompt) => {
    const storyContext = chapters
      .filter(c => c.id !== selectedChapter?.id)
      .map((c, i) => `--- CONTEÚDO DO CAPÍTULO ${i + 1}: "${c.title}" ---\n${c.content}\n\n`)
      .join('');

    const currentChapterText = `--- CONTEÚDO DO CAPÍTULO ATUAL (EM EDIÇÃO): "${selectedChapter?.title}" ---\n${chapterContent}\n\n`;

    const fullPrompt = `Você é o "Copiloto Criativo", um assistente de escrita especialista para autores de ficção.
    CONTEXTO DA HISTÓRIA ATÉ AGORA:\n${storyContext}
    ${currentChapterText}
    INSTRUÇÃO DO AUTOR: "${userPrompt}"
    ${contextPrompt || ''}
    Responda em português de forma útil, criativa e concisa.`;

    const chatHistory = [{ role: "user", parts: [{ text: fullPrompt }] }];
    const payload = { contents: chatHistory };

    const apiKey = ""; // chave Gemini deve ser configurada na Vercel
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const result = await response.json();
      return result.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error("Erro ao chamar a API Gemini:", error);
      return `Ocorreu um erro: ${error.message}.`;
    }
  };

  const handleSelectChapter = (chapter) => setSelectedChapter(chapter);

  const handleAddNewChapter = async () => {
    const newChapterTitle = `Capítulo ${chapters.length + 1}: Sem Título`;
    const chaptersPath = `/artifacts/${appId}/users/${userId}/chapters`;
    try {
      await addDoc(collection(db, chaptersPath), { title: newChapterTitle, content: '', createdAt: serverTimestamp() });
    } catch (error) {
      console.error("Erro ao adicionar novo capítulo:", error);
    }
  };

  const handleSaveChapter = async () => {
    if (!selectedChapter || !userId) return;
    const chapterPath = `/artifacts/${appId}/users/${userId}/chapters/${selectedChapter.id}`;
    try {
      await setDoc(doc(db, chapterPath), { content: chapterContent }, { merge: true });
      showToast('Capítulo salvo com sucesso!');
    } catch (error) {
      showToast('Falha ao salvar o capítulo.');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoadingAI || isGeneratingOutline) return;
    const newMessages = [...messages, { sender: 'user', text: userInput }];
    setMessages(newMessages);
    const currentInput = userInput;
    setUserInput('');
    setIsLoadingAI(true);

    const aiResponse = await callGeminiAPI(currentInput, "Responda à instrução do autor de forma conversacional.");
    setMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
    setIsLoadingAI(false);
  };

  const handleSuggestOutline = async () => {
    if (!selectedChapter || isLoadingAI || isGeneratingOutline) return;
    setIsGeneratingOutline(true);
    showToast("✨ A IA está a criar um roteiro...");

    const prompt = "Gere um roteiro ou uma estrutura de tópicos (bullet points) para o capítulo atual.";
    const outline = await callGeminiAPI(prompt, "Apresente a resposta como um roteiro bem estruturado ou lista de tópicos.");

    setChapterContent(prev => prev + `\\n\\n---\\n✨ ROTEIRO SUGERIDO PELA IA ✨\\n---\\n\\n${outline}\\n`);
    setIsGeneratingOutline(false);
    showToast("Roteiro adicionado ao final do seu texto!");
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <BrainCircuit className="animate-pulse h-12 w-12 text-indigo-400" />
        <p className="ml-4 text-xl">A iniciar o Copiloto Criativo...</p>
      </div>
    );
  }

  return (
    <div>
      {/* ... Aqui dentro fica o restante do seu JSX igualzinho ... */}
    </div>
  );
}
