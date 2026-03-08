import React, { useState, useEffect, useRef } from 'react';
import { 
  Hash, Shield, Trash2, AlertTriangle, UserX, 
  LogOut, Send, MessageSquare, Gamepad2, BookOpen, 
  Home, Bell, CheckCircle2, MoreVertical, Flag, ShieldAlert,
  Image as ImageIcon, Upload, ChevronRight, Settings, Sparkles,
  Search, BrainCircuit, Lightbulb, ListChecks
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, deleteDoc, updateDoc, serverTimestamp 
} from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'class8-hub-app';

// --- GEMINI API INTEGRATION ---
const apiKey = ""; // Provided by environment

const callGemini = async (prompt, systemInstruction = "You are a helpful assistant for 8th-grade students.") => {
  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
      });
      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
    } catch (error) {
      if (i === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

// --- CONSTANTS ---
const CHANNELS = [
  { id: 'home', name: 'home', icon: Home, desc: 'Welcome to the Hub' },
  { id: 'classwork', name: 'classwork', icon: BookOpen, desc: 'Assignments & Notes' },
  { id: 'study_doubts', name: 'study-doubts', icon: MessageSquare, desc: 'Get help from peers' },
  { id: 'memes', name: 'memes', icon: Bell, desc: 'Funny stuff only' },
  { id: 'gamer_page', name: 'gamer-page', icon: Gamepad2, desc: 'Lobby for gamers' },
];

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.log("Audio play blocked");
  }
};

const generateColor = (str) => {
  if (!str) return '#6366f1';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// --- ENHANCED AVATAR COMPONENT ---
const Avatar = ({ src, name, size = 10, ring = false }) => {
  const sizeClass = `w-${size} h-${size}`;
  const ringClass = ring ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900' : '';
  
  return (
    <div className={`relative flex-shrink-0 ${sizeClass}`}>
      {src ? (
        <img src={src} alt={name} className={`${sizeClass} rounded-2xl object-cover border border-white/10 ${ringClass} shadow-lg transition-transform hover:scale-105`} />
      ) : (
        <div className={`${sizeClass} rounded-2xl flex items-center justify-center text-white font-bold text-sm border border-white/10 ${ringClass} shadow-lg transition-transform hover:scale-105`} 
             style={{ background: `linear-gradient(135deg, ${generateColor(name)}, #4f46e5)` }}>
          {name?.charAt(0)?.toUpperCase() || '?'}
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token).catch(console.error);
      } else {
        await signInAnonymously(auth).catch(console.error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.isBanned) {
            setIsBanned(true);
            setCurrentUserData(null);
          } else {
            setCurrentUserData(data);
            await updateDoc(userRef, { isOnline: true });
          }
        }
      } else {
        setCurrentUserData(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (user && currentUserData) {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
        await updateDoc(userRef, { isOnline: false });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, currentUserData]);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsub = onSnapshot(q, (snap) => {
      const usersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(usersList);
      const me = usersList.find(u => u.id === user.uid);
      if (me && me.isBanned && !isBanned) {
        setIsBanned(true);
        setCurrentUserData(null);
      } else if (me) {
        setCurrentUserData(me);
      }
    });
    return () => unsub();
  }, [user, isBanned]);

  if (authLoading) return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center text-white space-y-4">
      <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      <p className="text-indigo-400 font-medium tracking-widest animate-pulse">ESTABLISHING SECURE CONNECTION</p>
    </div>
  );

  if (isBanned) return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center text-white p-6 text-center">
      <div className="relative mb-8">
        <ShieldAlert className="w-32 h-32 text-red-500 relative z-10" />
        <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20"></div>
      </div>
      <h1 className="text-5xl font-black mb-4 tracking-tighter">ACCESS REVOKED</h1>
      <p className="text-gray-400 max-w-md text-xl leading-relaxed">
        Your account has been permanently locked for violating Class 8 Hub protocols.
      </p>
    </div>
  );

  if (!user || !currentUserData) {
    return <LoginScreen setUserData={setCurrentUserData} user={user} />;
  }

  return <MainChatApp user={user} userData={currentUserData} allUsers={allUsers} />;
}

// ==========================================
// LOGIN SCREEN COMPONENT (PREMIUM UI)
// ==========================================
function LoginScreen({ setUserData, user }) {
  const [tab, setTab] = useState('student');
  const [phone, setPhone] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [profilePic, setProfilePic] = useState('');
  
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 150;
        let width = img.width, height = img.height;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setProfilePic(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSendSMS = () => {
    if (phone.length < 10) return setError("Enter a valid mobile number.");
    setError(''); setLoading(true);
    setTimeout(() => {
      const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
      setSimulatedOtp(mockOtp); setOtpSent(true); setLoading(false);
      alert(`[SMS]: Class 8 Hub Verification Code: ${mockOtp}`);
    }, 1200);
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    if (!consentChecked) return setError("Consent is required.");
    if (otpCode !== simulatedOtp) return setError("Invalid OTP.");
    if (joinCode !== 'CLASS8_ROCKS') return setError("Invalid Join Code.");
    setError(''); setLoading(true);
    try {
      const u = user || auth.currentUser;
      const userData = {
        name: studentName.trim(),
        role: 'student',
        phone: phone.substring(0, 3) + '****' + phone.substring(7),
        isOnline: true, isBanned: false, warnings: 0, createdAt: Date.now(), photoURL: profilePic
      };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid), userData);
      setUserData(userData);
    } catch (err) { setError(err.message); setLoading(false); }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (adminUser !== 'Admin8' || adminCode !== 'SUPER_ADMIN_2026') return setError("Invalid Admin ID.");
    setError(''); setLoading(true);
    try {
      const u = user || auth.currentUser;
      const userData = { name: 'Admin', role: 'admin', isOnline: true, isBanned: false, photoURL: '' };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid), userData);
      setUserData(userData);
    } catch (err) { setError(err.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>

      <div className="bg-[#1a1c23]/80 backdrop-blur-xl p-10 rounded-3xl shadow-2xl w-full max-w-[440px] border border-white/5 relative z-10 transition-all">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-indigo-600/20 p-4 rounded-2xl mb-4 border border-indigo-500/30">
            <Shield className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">Class 8 Hub</h2>
          <p className="text-gray-400 text-sm mt-1">Exclusive. Secure. Private.</p>
        </div>
        
        <div className="flex mb-8 bg-black/40 rounded-2xl p-1.5 border border-white/5">
          <button 
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${tab === 'student' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-white'}`}
            onClick={() => setTab('student')}
          >
            STUDENT
          </button>
          <button 
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${tab === 'admin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-white'}`}
            onClick={() => setTab('admin')}
          >
            ADMIN
          </button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl mb-6 flex items-center animate-shake">
          <AlertTriangle className="w-4 h-4 mr-2" /> {error}
        </div>}

        {tab === 'student' ? (
          <form onSubmit={handleStudentLogin} className="space-y-5">
            {!otpSent ? (
              <div className="space-y-4">
                <div className="relative group">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1 mb-2 block">Mobile Number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-black/40 text-white rounded-2xl p-4 border border-white/5 focus:border-indigo-500 focus:outline-none transition-all placeholder-gray-600" placeholder="+91 XXX XXX XXXX" required />
                </div>
                <button type="button" onClick={handleSendSMS} disabled={loading} className="w-full bg-white text-black hover:bg-indigo-50 p-4 rounded-2xl font-black text-sm tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center">
                  {loading ? 'SENDING CODE...' : 'VERIFY IDENTITY'}
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <div className="grid grid-cols-1 gap-4">
                  <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value)} className="w-full bg-black/40 text-white rounded-2xl p-4 border border-white/5 focus:border-indigo-500 focus:outline-none transition-all" placeholder="Enter OTP" required />
                  <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full bg-black/40 text-white rounded-2xl p-4 border border-white/5 focus:border-indigo-500 focus:outline-none transition-all" placeholder="Full Legal Name" required />
                  <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="w-full bg-black/40 text-white rounded-2xl p-4 border border-white/5 focus:border-indigo-500 focus:outline-none transition-all" placeholder="Secret Join Code" required />
                </div>
                
                <div className="flex flex-col items-center space-y-3 py-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Avatar Selection</label>
                  <div className="flex items-center space-x-4 w-full bg-black/20 p-3 rounded-2xl border border-white/5">
                    <Avatar src={profilePic} name={studentName || 'S'} size="14" ring={true} />
                    <label className="flex-1 cursor-pointer bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-xs font-bold transition flex items-center justify-center border border-white/10 uppercase tracking-wider">
                      <Upload className="w-4 h-4 mr-2" /> Upload Pic
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                <div className="flex items-start bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                  <input type="checkbox" id="consent" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} className="mt-1 mr-3 accent-indigo-500 h-4 w-4" />
                  <label htmlFor="consent" className="text-[10px] leading-tight text-gray-400 uppercase font-bold">
                    I verify parental consent & adhere to Indian Cyber Laws (IT Act 2000).
                  </label>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white hover:bg-indigo-500 p-4 rounded-2xl font-black text-sm tracking-widest shadow-lg shadow-indigo-600/30 transition-all active:scale-95">
                  {loading ? 'INITIALIZING...' : 'ENTER HUB'}
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-5 animate-fadeIn">
            <input type="text" value={adminUser} onChange={e => setAdminUser(e.target.value)} className="w-full bg-black/40 text-white rounded-2xl p-4 border border-white/5 focus:border-indigo-500 focus:outline-none" placeholder="Admin Identity" required />
            <input type="password" value={adminCode} onChange={e => setAdminCode(e.target.value)} className="w-full bg-black/40 text-white rounded-2xl p-4 border border-white/5 focus:border-indigo-500 focus:outline-none" placeholder="Security Token" required />
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white hover:bg-indigo-500 p-4 rounded-2xl font-black text-sm tracking-widest shadow-xl transition-all">
              {loading ? 'AUTHORIZING...' : 'ADMIN OVERRIDE'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ==========================================
// MAIN CHAT INTERFACE (PREMIUM DISCORD STYLE)
// ==========================================
function MainChatApp({ user, userData, allUsers }) {
  const [currentChannel, setCurrentChannel] = useState(CHANNELS[0].id);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const messagesEndRef = useRef(null);
  const isAdmin = userData.role === 'admin';

  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', `messages_${currentChannel}`);
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      if (msgs.length > messages.length && msgs.length > 0) {
        if (msgs[msgs.length - 1].senderId !== user.uid) playNotificationSound();
      }
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [currentChannel, user.uid]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const txt = newMessage.trim();
    setNewMessage('');
    const msgData = {
      text: txt, senderId: user.uid, senderName: userData.name,
      senderPhoto: userData.photoURL || '', timestamp: Date.now()
    };
    await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', `messages_${currentChannel}`)), msgData);
  };

  const handleAiAction = async (msgText) => {
    setAiLoading(true);
    try {
      let prompt = "";
      let sys = "You are a helpful study buddy for 8th grade students in India.";
      
      if (currentChannel === 'study_doubts') {
        prompt = `Explain this concept simply: "${msgText}"`;
        sys = "You are an expert tutor. Explain concepts clearly using examples suitable for 13-year-olds.";
      } else if (currentChannel === 'memes') {
        prompt = `Explain why this joke/meme text is funny: "${msgText}"`;
        sys = "You are a Gen-Z meme expert. Break down the humor and slang.";
      } else if (currentChannel === 'classwork') {
        prompt = `Turn this assignment description into a step-by-step checklist: "${msgText}"`;
        sys = "You are a productivity coach. Provide a markdown checklist with clear action items.";
      } else {
        prompt = msgText;
      }

      const result = await callGemini(prompt, sys);
      setAiResponse({ text: result, original: msgText });
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!isAdmin) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `messages_${currentChannel}`, msgId));
  };

  const handleWarnUser = async (targetUser) => {
    const currentWarnings = targetUser.warnings || 0;
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUser.id);
    if (currentWarnings >= 2) {
      await updateDoc(userRef, { isBanned: true, warnings: 3 });
    } else {
      await updateDoc(userRef, { warnings: currentWarnings + 1 });
    }
    setContextMenu(null);
  };

  const handleBanUser = async (targetUser) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUser.id), { isBanned: true });
    setContextMenu(null);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-white font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR: NAVIGATION */}
      <div className="w-72 bg-[#121217] flex flex-col border-r border-white/[0.03]">
        <div className="p-6 h-20 flex items-center justify-between border-b border-white/[0.03]">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight">HUB <span className="text-indigo-500">V2</span></span>
          </div>
          <button className="text-gray-500 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          <div className="px-4 mb-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">General Spaces</div>
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => { setCurrentChannel(ch.id); setAiResponse(null); }}
              className={`w-full group flex flex-col px-4 py-3 rounded-2xl transition-all duration-300 ${currentChannel === ch.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/10 scale-[1.02]' : 'text-gray-400 hover:bg-white/[0.03] hover:text-white'}`}
            >
              <div className="flex items-center w-full">
                <ch.icon className={`w-5 h-5 mr-3 transition-transform duration-300 ${currentChannel === ch.id ? 'scale-110' : 'group-hover:rotate-12'}`} />
                <span className="font-bold text-sm tracking-wide">{ch.name}</span>
                {currentChannel === ch.id && <ChevronRight className="ml-auto w-4 h-4 opacity-50" />}
              </div>
              <span className={`text-[10px] mt-0.5 ml-8 font-medium truncate opacity-60 ${currentChannel === ch.id ? 'text-white' : 'text-gray-500'}`}>{ch.desc}</span>
            </button>
          ))}
        </div>

        {/* User Card */}
        <div className="p-4 m-4 bg-white/[0.02] border border-white/[0.05] rounded-3xl flex items-center space-x-3">
          <Avatar src={userData.photoURL} name={userData.name} size="10" ring={true} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black truncate">{userData.name}</p>
            <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span> Active
            </p>
          </div>
          <button onClick={() => signOut(auth)} className="text-gray-500 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-xl transition-all">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CENTER: CHAT AREA */}
      <div className="flex-1 flex flex-col bg-[#16161d] min-w-0 relative">
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-indigo-600/5 to-transparent pointer-events-none"></div>

        {/* Header */}
        <div className="h-20 border-b border-white/[0.03] flex items-center px-8 justify-between relative z-10 backdrop-blur-md bg-[#16161d]/80">
          <div className="flex items-center">
            <div className="bg-gray-800 p-2 rounded-xl mr-4 border border-white/5">
              <Hash className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">{CHANNELS.find(c => c.id === currentChannel)?.name}</h2>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">End-to-End Encryption Active</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isAdmin && <div className="px-3 py-1 bg-red-500/10 text-red-400 text-[10px] font-black rounded-lg border border-red-500/20 tracking-tighter uppercase animate-pulse">Security Override Active</div>}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-2 relative z-10">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40">
              <div className="p-6 bg-white/5 rounded-full mb-6">
                <MessageSquare className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-black mb-1">Silence is Golden</h3>
              <p className="text-sm font-medium">Be the first to leave a mark in #{currentChannel}.</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.senderId === user.uid;
              const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId || (msg.timestamp - messages[index - 1].timestamp > 60000);
              
              return (
                <div key={msg.id} className={`flex ${showHeader ? 'mt-8' : 'mt-1'} ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end group animate-fadeInUp`}>
                  {!isMe && showHeader && <div className="mb-2"><Avatar src={msg.senderPhoto} name={msg.senderName} size="10" /></div>}
                  {!isMe && !showHeader && <div className="w-10"></div>}
                  
                  <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'} ${!isMe && 'ml-3'}`}>
                    {showHeader && !isMe && <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1 ml-1">{msg.senderName}</span>}
                    
                    <div className="relative group/msg">
                      <div className={`px-5 py-3 rounded-3xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-[#22222b] text-gray-200 rounded-bl-none border border-white/[0.05]'}`}>
                        {msg.text}
                      </div>
                      
                      {/* Action Overlays */}
                      <div className={`absolute top-0 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} opacity-0 group-hover/msg:opacity-100 transition-opacity flex space-x-1`}>
                        <button onClick={() => handleAiAction(msg.text)} className="p-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all shadow-lg border border-indigo-500/20">
                          {currentChannel === 'study_doubts' ? <BrainCircuit className="w-4 h-4" title="✨ AI Tutor" /> : 
                           currentChannel === 'memes' ? <Lightbulb className="w-4 h-4" title="✨ Explain Meme" /> :
                           currentChannel === 'classwork' ? <ListChecks className="w-4 h-4" title="✨ Break Down" /> :
                           <Sparkles className="w-4 h-4" title="✨ AI Ask" />}
                        </button>
                        {isAdmin && <button onClick={() => handleDeleteMessage(msg.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-lg"><Trash2 className="w-4 h-4" /></button>}
                        {!isMe && <button className="p-2 bg-white/5 text-gray-400 hover:text-yellow-400 rounded-xl transition-all"><Flag className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {/* AI Response Block */}
          {aiResponse && (
            <div className="mt-8 mx-auto max-w-2xl bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden animate-fadeInUp">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-600 p-2 rounded-xl">
                    <BrainCircuit className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">✨ Gemini Intelligence</span>
                </div>
                <button onClick={() => setAiResponse(null)} className="text-gray-500 hover:text-white text-xs font-bold">CLOSE</button>
              </div>
              <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {aiResponse.text}
              </div>
            </div>
          )}

          {aiLoading && (
            <div className="flex items-center space-x-3 mt-4 text-indigo-400 animate-pulse">
              <BrainCircuit className="w-5 h-5 animate-spin-slow" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Processing with ✨ AI...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-6 bg-[#16161d] relative z-20">
          <form onSubmit={handleSendMessage} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl opacity-20 blur-xl group-focus-within:opacity-40 transition-opacity"></div>
            <div className="relative flex items-center bg-[#1e1e26] rounded-3xl border border-white/5 px-4 py-1.5 focus-within:border-indigo-500/50 transition-all">
              <div className="p-2 bg-white/5 rounded-xl mr-2">
                <Hash className="w-4 h-4 text-gray-500" />
              </div>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Message in #${currentChannel}...`}
                className="flex-1 bg-transparent py-3 text-sm text-white focus:outline-none placeholder-gray-600"
              />
              <button disabled={!newMessage.trim() || aiLoading} className="ml-2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl disabled:opacity-30 disabled:grayscale transition-all shadow-xl shadow-indigo-600/20 active:scale-90">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          <p className="text-[9px] text-center mt-3 font-bold text-gray-600 uppercase tracking-[0.3em]">Class 8 Hub Internal Network - Rules Apply</p>
        </div>
      </div>

      {/* RIGHT SIDEBAR: ROSTER */}
      <div className="w-72 bg-[#121217] border-l border-white/[0.03] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
            MEMBERS <span>{allUsers.filter(u => u.isOnline).length}</span>
          </h3>
          
          <div className="space-y-6">
            <section>
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 px-2">Authority</h4>
              {allUsers.filter(u => u.role === 'admin' && !u.isBanned).map(u => (
                <UserCard key={u.id} user={u} onRightClick={(e) => { e.preventDefault(); if(isAdmin && u.role!=='admin') setContextMenu({x: e.pageX, y: e.pageY, user: u})}} />
              ))}
            </section>

            <section>
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 px-2">Classmates</h4>
              {allUsers.filter(u => u.role === 'student' && !u.isBanned).map(u => (
                <UserCard key={u.id} user={u} onRightClick={(e) => { e.preventDefault(); if(isAdmin) setContextMenu({x: e.pageX, y: e.pageY, user: u})}} />
              ))}
            </section>
          </div>
        </div>
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div className="fixed bg-[#1a1c23] border border-white/10 shadow-2xl rounded-2xl py-2 z-[100] w-56 animate-scaleIn" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="px-4 py-2 border-b border-white/5 mb-1 text-[10px] font-black text-gray-500 uppercase tracking-widest">Administrative Actions</div>
          <button onClick={() => handleWarnUser(contextMenu.user)} className="w-full text-left px-4 py-3 text-sm text-yellow-500 hover:bg-yellow-500/10 flex items-center transition-colors">
            <AlertTriangle className="w-4 h-4 mr-3" /> Warn User ({contextMenu.user.warnings || 0}/3)
          </button>
          <button onClick={() => handleBanUser(contextMenu.user)} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 flex items-center transition-colors">
            <UserX className="w-4 h-4 mr-3" /> Permanent Ban
          </button>
        </div>
      )}

      {/* Global CSS for animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-fadeInUp { animation: fadeInUp 0.4s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}} />
    </div>
  );
}

function UserCard({ user, onRightClick }) {
  return (
    <div 
      onContextMenu={onRightClick}
      className="flex items-center px-3 py-3 rounded-2xl hover:bg-white/[0.03] transition-all group cursor-pointer"
    >
      <div className="relative">
        <Avatar src={user.photoURL} name={user.name} size="10" />
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-4 border-[#121217] rounded-full ${user.isOnline ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-gray-600'}`}></div>
      </div>
      <div className="ml-4 truncate flex-1">
        <p className={`text-sm font-black truncate tracking-tight ${user.role === 'admin' ? 'text-indigo-400' : 'text-gray-200'}`}>{user.name}</p>
        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{user.role}</p>
      </div>
      {user.warnings > 0 && (
        <div className="flex space-x-0.5">
          {[...Array(user.warnings)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm"></div>)}
        </div>
      )}
    </div>
  );
}
