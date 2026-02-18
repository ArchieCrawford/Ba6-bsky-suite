import React, { useState, useEffect, useRef, useMemo } from 'react';
import htm from 'htm';
import { supabase, authApi, dbApi } from './api.js';
import { 
  Plus, 
  Send, 
  Users, 
  LogOut, 
  Menu, 
  X, 
  MessageSquare,
  UserPlus,
  Info,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

const html = htm.bind(React.createElement);

// --- Components ---

const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const { error: signInError } = await authApi.signIn(email, password);
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await authApi.signUp(email, password, name);
        if (signUpError) throw signUpError;
        alert('Check your email for confirmation!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return html`
    <div className="min-h-screen flex items-center justify-center bg-indigo-600 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
             <${MessageSquare} size=${32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">BA6 Groups</h1>
          <p className="text-gray-500 mt-2">${isLogin ? 'Welcome back!' : 'Create your account'}</p>
        </div>

        <form onSubmit=${handleSubmit} className="space-y-4">
          ${!isLogin && html`
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input 
                type="text" required 
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                value=${name} onChange=${(e) => setName(e.target.value)}
              />
            </div>
          `}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" required 
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
              value=${email} onChange=${(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" required 
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
              value=${password} onChange=${(e) => setPassword(e.target.value)}
            />
          </div>
          ${error && html`<p className="text-red-500 text-sm">${error}</p>`}
          <button 
            disabled=${loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
          >
            ${loading && html`<${Loader2} className="animate-spin" size=${18} />`}
            ${isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button onClick=${() => setIsLogin(!isLogin)} className="text-indigo-600 hover:underline">
            ${isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  `;
};

const Message = ({ msg, isMine, showHeader, reactions = {}, onToggleReaction, currentUserId }) => {
  const profile = msg.profiles;
  const time = format(new Date(msg.created_at), 'h:mm a');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
  const msgReactions = reactions[msg.id] || {};

  return html`
    <div className=${`flex ${isMine ? 'justify-end' : 'justify-start'} ${showHeader ? 'mt-4' : 'mt-1'}`}>
      ${!isMine && html`
        <div className="w-8 mr-2 flex-shrink-0">
          ${showHeader && html`
            <img src=${profile?.avatar_url} className="w-8 h-8 rounded-full bg-gray-200" alt="" />
          `}
        </div>
      `}
      <div className=${`max-w-[80%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        ${!isMine && showHeader && html`
          <span className="text-xs font-semibold text-gray-500 mb-1 ml-1">${profile?.display_name || 'User'}</span>
        `}
        <div className="relative group">
          <div className=${`px-4 py-2 rounded-2xl text-sm shadow-sm relative ${
            isMine ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border rounded-tl-none'
          }`}>
            ${msg.body}
            <div className=${`absolute bottom-0 ${isMine ? 'right-full mr-2' : 'left-full ml-2'} opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}>
               <span className="text-[10px] text-gray-400">${time}</span>
            </div>
          </div>

          <!-- Reaction Button -->
          <button 
            onClick=${() => setShowEmojiPicker(!showEmojiPicker)}
            className=${`absolute -bottom-2 ${isMine ? '-left-6' : '-right-6'} bg-white border rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-sm z-10 hover:scale-110`}
          >
            <${Plus} size=${12} className="text-gray-400" />
          </button>

          <!-- Emoji Picker Popover -->
          ${showEmojiPicker && html`
            <div className=${`absolute bottom-6 ${isMine ? 'left-0' : 'right-0'} bg-white border rounded-full px-2 py-1 shadow-xl flex gap-1 z-20 animate-in fade-in zoom-in-95`}>
              ${emojis.map(e => html`
                <button 
                  key=${e}
                  onClick=${() => {
                    onToggleReaction(msg.id, e);
                    setShowEmojiPicker(false);
                  }}
                  className="hover:scale-125 transition px-1"
                >
                  ${e}
                </button>
              `)}
            </div>
          `}

          <!-- Display Reactions -->
          ${Object.keys(msgReactions).length > 0 && html`
            <div className=${`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              ${Object.entries(msgReactions).map(([emoji, userIds]) => html`
                <button 
                  key=${emoji}
                  onClick=${() => onToggleReaction(msg.id, emoji)}
                  className=${`px-1.5 py-0.5 rounded-full text-[10px] border transition flex items-center gap-1 ${
                    userIds.includes(currentUserId) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span>${emoji}</span>
                  <span>${userIds.length}</span>
                </button>
              `)}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
};

const DateSeparator = ({ date }) => {
  const dateObj = new Date(date);
  let label = format(dateObj, 'MMMM d, yyyy');
  if (isToday(dateObj)) label = 'Today';
  else if (isYesterday(dateObj)) label = 'Yesterday';

  return html`
    <div className="flex items-center my-6">
      <div className="flex-1 h-px bg-gray-200"></div>
      <span className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">${label}</span>
      <div className="flex-1 h-px bg-gray-200"></div>
    </div>
  `;
};

// --- Main App ---

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState({});
  const [members, setMembers] = useState([]);
  const [errorState, setErrorState] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Form states
  const [newGroupName, setNewGroupName] = useState('');
  const [messageInput, setMessageInput] = useState('');
  
  // Profile Form States
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  
  const msgEndRef = useRef(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const fetchProfile = async (uId) => {
      try {
        const { data: profile, error } = await dbApi.getProfile(uId);
        if (error) {
           setErrorState(error);
           return;
        }
        setUserProfile(profile);
        setEditDisplayName(profile?.display_name || '');
        setEditAvatarUrl(profile?.avatar_url || '');
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setErrorState(err.message);
      }
    };

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) fetchProfile(currentSession.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = authApi.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) fetchProfile(currentSession.user.id);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      const updated = await dbApi.updateProfile(editDisplayName, editAvatarUrl);
      setUserProfile(updated);
      setShowProfileModal(false);
    } catch (err) {
      alert('Failed to update profile: ' + err.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  useEffect(() => {
    if (session) {
      dbApi.getGroups()
        .then(({ data, error }) => {
          if (error) {
            setErrorState(error);
          } else {
            setGroups(data);
          }
        })
        .catch(err => {
          console.error(err);
          setErrorState(err.message);
        });
    }
  }, [session]);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/join/') && session) {
      const code = path.split('/')[2];
      dbApi.joinGroupByCode(code).then(id => {
        window.history.replaceState({}, '', '/app');
        setActiveGroupId(id);
        dbApi.getGroups().then(setGroups);
      }).catch(err => alert(err.message));
    }
  }, [session]);

  useEffect(() => {
    if (activeGroupId && session) {
      dbApi.getMessages(activeGroupId).then(({ data }) => setMessages(data || []));
      dbApi.getGroupMembers(activeGroupId).then(({ data }) => setMembers(data || []));
      
      const fetchReactions = () => {
        dbApi.getReactions(activeGroupId).then(({ data }) => {
          const reactionMap = {};
          (data || []).forEach(r => {
            if (!reactionMap[r.message_id]) reactionMap[r.message_id] = {};
            if (!reactionMap[r.message_id][r.emoji]) reactionMap[r.message_id][r.emoji] = [];
            reactionMap[r.message_id][r.emoji].push(r.user_id);
          });
          setReactions(reactionMap);
        });
      };

      fetchReactions();

      const messageChannel = dbApi.subscribeToMessages(activeGroupId, (newMsg) => {
        setMessages(prev => [...prev, newMsg]);
      });

      const reactionChannel = dbApi.subscribeToReactions(activeGroupId, (payload) => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new;
          setReactions(prev => {
            const next = { ...prev };
            if (!next[r.message_id]) next[r.message_id] = {};
            if (!next[r.message_id][r.emoji]) next[r.message_id][r.emoji] = [];
            if (!next[r.message_id][r.emoji].includes(r.user_id)) {
              next[r.message_id][r.emoji] = [...next[r.message_id][r.emoji], r.user_id];
            }
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          fetchReactions();
        }
      });

      return () => {
        supabase.removeChannel(messageChannel);
        supabase.removeChannel(reactionChannel);
      };
    }
  }, [activeGroupId, session]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeGroup = useMemo(() => groups.find(g => g.id === activeGroupId), [groups, activeGroupId]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const group = await dbApi.createGroup(newGroupName, '');
      setGroups(prev => [group, ...prev]);
      setActiveGroupId(group.id);
      setShowCreateModal(false);
      setNewGroupName('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    const body = messageInput;
    setMessageInput('');
    try {
      await dbApi.sendMessage(activeGroupId, body);
    } catch (err) {
      alert('Failed to send message');
    }
  };

  const handleToggleReaction = async (messageId, emoji) => {
    try {
      await dbApi.toggleReaction(messageId, emoji);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  if (!authApi.isConfigured()) return html`
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
           <${Info} size=${32} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Supabase Configuration Required</h1>
        <p className="text-gray-500 text-sm mb-6">
          To use BA6 Groups, you must provide your Supabase credentials via environment variables.
        </p>
        <div className="bg-gray-50 p-4 rounded-xl text-left text-xs font-mono text-gray-600 mb-6">
          SUPABASE_URL<br/>
          SUPABASE_ANON_KEY
        </div>
        <p className="text-xs text-gray-400 italic">
          Please check the README.md for setup instructions.
        </p>
      </div>
    </div>
  `;

  if (loading) return html`
    <div className="h-screen flex items-center justify-center bg-white">
      <${Loader2} className="animate-spin text-indigo-600" size=${48} />
    </div>
  `;

  if (errorState && errorState.includes('not found')) return html`
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
           <${X} size=${32} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Migrations Required</h1>
        <p className="text-gray-500 text-sm mb-6">
          The database table "groups" was not found. Have you run the SQL migrations in your Supabase dashboard?
        </p>
        <div className="bg-gray-50 p-4 rounded-xl text-left text-xs font-mono text-gray-600 mb-6 overflow-x-auto whitespace-pre">
          ${errorState}
        </div>
        <button 
          onClick=${() => window.location.reload()}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition"
        >
          I've run them, let me in!
        </button>
      </div>
    </div>
  `;

  if (!session) return html`<${AuthScreen} onLogin=${setSession} />`;

  return html`
    <div className="flex h-screen bg-white overflow-hidden">
      <aside className=${`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 fixed lg:static z-30 w-72 h-full bg-gray-50 border-r transition-transform duration-300 flex flex-col
      `}>
        <div className="p-4 border-b flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center">
              <${MessageSquare} size=${18} />
            </div>
            <span className="font-bold text-gray-900 tracking-tight">BA6 Groups</span>
          </div>
          <button onClick=${() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-gray-400">
            <${X} size=${20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <button 
            onClick=${() => setShowCreateModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition font-medium text-sm mb-4"
          >
            <div className="p-1 bg-indigo-100 rounded-md"><${Plus} size=${16} /></div>
            New Group
          </button>

          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">My Groups</div>
          ${groups.map(g => html`
            <button 
              key=${g.id}
              onClick=${() => {
                setActiveGroupId(g.id);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className=${`w-full flex items-center gap-3 p-3 rounded-xl transition ${
                activeGroupId === g.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-gray-700 hover:bg-gray-200/50'
              }`}
            >
              <div className=${`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                activeGroupId === g.id ? 'bg-white/20' : 'bg-gray-200 text-gray-500'
              }`}>
                ${g.name.charAt(0)}
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="font-semibold truncate text-sm">${g.name}</div>
              </div>
              <${ChevronRight} size=${14} className=${activeGroupId === g.id ? 'opacity-100' : 'opacity-0'} />
            </button>
          `)}
        </div>

        <div className="p-4 border-t bg-white flex items-center justify-between">
           <button 
              onClick=${() => setShowProfileModal(true)}
              className="flex items-center gap-2 min-w-0 hover:bg-gray-100 p-1 rounded-lg transition text-left"
            >
              <img src=${userProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`} className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-100" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 truncate">${userProfile?.display_name || 'User'}</div>
                <div className="text-[10px] text-gray-400 truncate">${session.user.email}</div>
              </div>
           </button>
           <button onClick=${() => authApi.signOut()} className="p-2 text-gray-400 hover:text-red-500 transition">
              <${LogOut} size=${18} />
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0">
        ${activeGroupId ? html`
          <header className="h-16 border-b flex items-center justify-between px-4 lg:px-6 bg-white shrink-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick=${() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-gray-500">
                <${Menu} size=${20} />
              </button>
              <div className="min-w-0">
                <h2 className="font-bold text-gray-900 truncate">${activeGroup?.name}</h2>
                <button 
                  onClick=${() => setShowMembers(true)}
                  className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider hover:underline flex items-center gap-1"
                >
                  <${Users} size=${10} /> ${members.length} members
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick=${() => setShowInviteModal(true)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <${UserPlus} size=${14} /> Invite
              </button>
              <button 
                onClick=${() => setShowMembers(!showMembers)}
                className="p-2 text-gray-400 hover:text-indigo-600"
              >
                <${Info} size=${20} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-1 bg-gray-50/50">
            ${messages.map((m, idx) => {
              const prev = messages[idx-1];
              const showDate = !prev || format(new Date(prev.created_at), 'yyyy-MM-dd') !== format(new Date(m.created_at), 'yyyy-MM-dd');
              const showHeader = !prev || prev.user_id !== m.user_id || showDate;
              
              return html`
                <${React.Fragment} key=${m.id}>
                  ${showDate && html`<${DateSeparator} date=${m.created_at} />`}
                  <${Message} 
                    msg=${m} 
                    isMine=${m.user_id === session.user.id} 
                    showHeader=${showHeader} 
                    reactions=${reactions}
                    onToggleReaction=${handleToggleReaction}
                    currentUserId=${session.user.id}
                  />
                <//>
              `;
            })}
            <div ref=${msgEndRef} />
          </div>

          <footer className="p-4 bg-white border-t shrink-0">
            <form onSubmit=${handleSendMessage} className="max-w-5xl mx-auto flex items-end gap-2">
              <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-2 border border-transparent focus-within:border-indigo-200 focus-within:bg-white transition-all shadow-inner">
                <textarea 
                  rows="1"
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent border-none outline-none py-1.5 text-sm resize-none max-h-32"
                  value=${messageInput}
                  onChange=${(e) => setMessageInput(e.target.value)}
                  onKeyDown=${(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
              </div>
              <button 
                disabled=${!messageInput.trim()}
                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition shadow-lg active:scale-95 flex-shrink-0"
              >
                <${Send} size=${20} />
              </button>
            </form>
          </footer>
        ` : html`
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
             <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <${MessageSquare} size=${48} className="text-gray-300" />
             </div>
             <h3 className="text-xl font-bold text-gray-900 mb-2">Select a group</h3>
             <p className="text-gray-500 max-w-xs">Pick a group from the sidebar to start chatting or create a new one to invite friends.</p>
          </div>
        `}
      </main>

      ${showCreateModal && html`
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Create New Group</h3>
            <form onSubmit=${handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                <input 
                  autoFocus required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value=${newGroupName} onChange=${(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Project Alpha"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick=${() => setShowCreateModal(false)} className="flex-1 py-2 rounded-lg font-medium text-gray-500 hover:bg-gray-100 transition">Cancel</button>
                <button className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition">Create</button>
              </div>
            </form>
          </div>
        </div>
      `}

      ${showInviteModal && activeGroup && html`
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <${UserPlus} size=${32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Invite to ${activeGroup.name}</h3>
            <p className="text-sm text-gray-500 mb-6">Share this code or link with your friends to let them join this group.</p>
            
            <div className="space-y-4">
               <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Join Code</span>
                  <div className="bg-gray-100 py-3 rounded-xl font-mono text-2xl font-bold tracking-widest text-indigo-600 border-2 border-dashed border-indigo-100">
                    ${activeGroup.invite_code}
                  </div>
               </div>
               <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Invite Link</span>
                  <input 
                    readOnly
                    className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-xs text-gray-500 text-center"
                    value=${`${window.location.origin}/join/${activeGroup.invite_code}`}
                    onClick=${(e) => e.target.select()}
                  />
               </div>
            </div>

            <button onClick=${() => setShowInviteModal(false)} className="mt-8 w-full bg-gray-900 text-white py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition">
              Close
            </button>
          </div>
        </div>
      `}

      ${showProfileModal && html`
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Profile</h3>
              <button onClick=${() => setShowProfileModal(false)} className="p-1 text-gray-400 hover:text-gray-600 transition"><${X} size=${24} /></button>
            </div>
            <form onSubmit=${handleUpdateProfile} className="space-y-4">
              <div className="flex justify-center mb-4">
                <img src=${editAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`} className="w-20 h-20 rounded-full border-2 border-indigo-100 bg-indigo-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Display Name</label>
                <input 
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value=${editDisplayName} onChange=${(e) => setEditDisplayName(e.target.value)}
                  placeholder="Your Name"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Avatar URL</label>
                <input 
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value=${editAvatarUrl} onChange=${(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                />
                <p className="text-[10px] text-gray-400 mt-1">Leave blank to use a generated avatar.</p>
              </div>
              <div className="pt-4 flex gap-2">
                <button type="button" onClick=${() => setShowProfileModal(false)} className="flex-1 py-2 rounded-lg font-medium text-gray-500 hover:bg-gray-100 transition">Cancel</button>
                <button 
                  disabled=${updatingProfile}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg"
                >
                  ${updatingProfile && html`<${Loader2} className="animate-spin" size=${18} />`}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      `}

      ${showMembers && activeGroupId && html`
        <aside className="fixed inset-y-0 right-0 z-40 w-80 bg-white border-l shadow-2xl lg:shadow-none flex flex-col">
           <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Group Members</h3>
              <button onClick=${() => setShowMembers(false)} className="p-1 text-gray-400 hover:text-gray-600"><${X} size=${20}/></button>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                 ${members.map(m => html`
                    <div key=${m.user_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 group">
                       <img src=${m.profiles?.avatar_url} className="w-10 h-10 rounded-full border border-gray-100" />
                       <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">${m.profiles?.display_name || 'User'}</div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${m.role}</div>
                       </div>
                    </div>
                 `)}
              </div>
           </div>
        </aside>
      `}
    </div>
  `;
}
