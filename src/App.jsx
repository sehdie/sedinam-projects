import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Coffee,
  Copy,
  LogOut,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Send,
  SkipForward,
  Sparkles,
  Users,
  Wifi,
  X,
} from "lucide-react";

const initialProfile = {
  name: localStorage.getItem("study-hall-name") || "",
  roomId: localStorage.getItem("study-hall-room") || "quiet-club",
};

const timerModes = [
  { id: "focus", label: "Focus", icon: BookOpen },
  { id: "shortBreak", label: "Short break", icon: Coffee },
  { id: "longBreak", label: "Long break", icon: Sparkles },
];

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatMessageTime(timestamp) {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

export default function App() {
  const [profile, setProfile] = useState(initialProfile);
  const [room, setRoom] = useState(null);
  const [socketStatus, setSocketStatus] = useState("offline");
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const socketRef = useRef(null);
  const messageEndRef = useRef(null);
  const currentMember = room?.members.find((member) => member.id === socketRef.current?.id);
  const timer = room?.timer;
  const activeMode = timerModes.find((mode) => mode.id === timer?.mode) || timerModes[0];
  const otherMembers = room?.members.filter((member) => member.id !== currentMember?.id) || [];

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [room?.messages?.length]);

  useEffect(() => () => socketRef.current?.disconnect(), []);

  function joinRoom(event, roomOverride) {
    event?.preventDefault();
    const name = profile.name.trim();
    const roomId = (roomOverride || profile.roomId).trim().toLowerCase();
    if (!name || !/^[a-z0-9_-]{2,32}$/.test(roomId)) {
      setFormError("Add your name and a room code with 2–32 letters, numbers, dashes or underscores.");
      return;
    }

    setFormError("");
    setRoom(null);
    localStorage.setItem("study-hall-name", name);
    localStorage.setItem("study-hall-room", roomId);
    socketRef.current?.disconnect();

    const socket = io({ autoConnect: false });
    socketRef.current = socket;
    socket.on("connect", () => {
      setSocketStatus("online");
      socket.emit("room:join", { name, roomId });
    });
    socket.on("disconnect", () => setSocketStatus("offline"));
    socket.on("connect_error", () => {
      setSocketStatus("offline");
      setFormError("Could not reach the room server. Check that it is running and try again.");
    });
    socket.on("room:error", (message) => setFormError(message));
    socket.on("room:state", (state) => {
      setRoom(state);
      setFormError("");
    });
    socket.on("room:presence", (members) => {
      setRoom((current) => current ? { ...current, members } : current);
    });
    socket.on("room:message", (message) => {
      setRoom((current) => current ? { ...current, messages: [...current.messages, message].slice(-80) } : current);
    });
    socket.on("room:timer", (updatedTimer) => {
      setRoom((current) => current ? { ...current, timer: updatedTimer } : current);
    });
    socket.connect();
  }

  function leaveRoom() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setRoom(null);
    setSocketStatus("offline");
    setDraft("");
  }

  function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit("room:message", text);
    setDraft("");
  }

  function sendTimerCommand(action, mode) {
    socketRef.current?.emit("timer:command", { action, mode });
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setFormError("Clipboard access is unavailable in this browser.");
    }
  }

  if (!room) {
    return (
      <main className="entry-page">
        <header className="entry-topbar">
          <a className="brand" href="#home" aria-label="Study Hall home">
            <span className="brand-mark"><BookOpen size={17} strokeWidth={2.4} /></span>
            <span>study<span className="brand-light">hall</span></span>
          </a>
          <span className="entry-note"><span className="status-dot" /> your people are one room away</span>
        </header>

        <section className="entry-layout" id="home">
          <div className="entry-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> SHARED FOCUS, BETTER FLOW</div>
            <h1>Make room<br />for <span>good work.</span></h1>
            <p className="entry-description">A little company goes a long way. Find your people, settle in, and make the next 25 minutes count.</p>
            <div className="entry-visual" role="img" aria-label="A calm, sunlit desk prepared for a study session">
              <div className="window-light" />
              <div className="desk-lamp"><span /></div>
              <div className="desk-book"><span /><span /><span /></div>
              <div className="desk-cup"><span /></div>
              <div className="visual-caption"><span>01 / FIND YOUR FOCUS</span><span>EST. RIGHT NOW</span></div>
            </div>
            <div className="entry-footnote"><Sparkles size={14} /> Open seats, gentle accountability, zero pressure.</div>
          </div>

          <div className="join-panel">
            <div className="join-panel-top">
              <span className="panel-kicker">YOUR STUDY ROOM</span>
              <span className="live-indicator"><span /> LIVE</span>
            </div>
            <h2>Pull up a chair.</h2>
            <p className="join-subtitle">Join a room that's already going, or start a new one with a name of your own.</p>
            <form className="join-form" onSubmit={joinRoom}>
              <label htmlFor="display-name">YOUR NAME</label>
              <input
                id="display-name"
                autoComplete="nickname"
                maxLength={24}
                placeholder="What should we call you?"
                value={profile.name}
                onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
              />
              <label htmlFor="room-code">ROOM CODE</label>
              <div className="room-input-wrap"><Users size={16} /><input
                id="room-code"
                autoComplete="off"
                maxLength={32}
                placeholder="e.g. quiet-club"
                value={profile.roomId}
                onChange={(event) => setProfile((current) => ({ ...current, roomId: event.target.value }))}
              /></div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <button className="join-button" type="submit">
                <span>Enter the room</span><ArrowRight size={18} />
              </button>
            </form>
            <div className="join-divider"><span /> OR DROP INTO <span /></div>
            <button className="quick-join" type="button" onClick={() => {
              setProfile((current) => ({ ...current, roomId: "quiet-club" }));
              if (profile.name.trim()) joinRoom(null, "quiet-club");
              else document.getElementById("display-name")?.focus();
            }}>
              <span className="quick-room-icon"><BookOpen size={16} /></span>
              <span className="quick-room-label"><strong>quiet-club</strong><small>Open room · anyone can join</small></span>
              <ArrowDownRight size={17} />
            </button>
            <div className="join-privacy"><Wifi size={14} /> Your name is only visible to people in your room.</div>
          </div>
        </section>
        <footer className="entry-footer"><span>STUDY HALL · 2026</span><span>SHOW UP. SETTLE IN. GET THERE.</span></footer>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="#room" aria-label="Study Hall">
          <span className="brand-mark"><BookOpen size={17} strokeWidth={2.4} /></span>
          <span>study<span className="brand-light">hall</span></span>
        </a>
        <div className="header-room">
          <span className="room-label">YOU'RE IN</span>
          <span className="room-name">{room.roomId}</span>
          <span className="live-indicator"><span /> LIVE</span>
        </div>
        <div className="header-actions">
          <span className={`connection-pill ${socketStatus}`}><span /> {socketStatus === "online" ? "Connected" : "Reconnecting"}</span>
          <button className="icon-button" type="button" title="Room details" aria-label="Room details" onClick={() => setShowDetails(true)}><CircleHelp size={18} /></button>
          <button className="leave-button" type="button" onClick={leaveRoom}><LogOut size={16} /><span>Leave</span></button>
        </div>
      </header>

      <div className="room-layout" id="room">
        <aside className="people-panel">
          <div className="section-heading">
            <div><span className="section-overline">THE ROOM</span><h2>Study crew <span className="count-badge">{room.members.length}</span></h2></div>
            <Users className="heading-icon" size={19} />
          </div>
          <div className="room-code-card">
            <div><span className="room-label">ROOM CODE</span><strong>{room.roomId}</strong></div>
            <button className="small-icon-button" type="button" onClick={copyRoomCode} title="Copy room code" aria-label="Copy room code">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div className="members-list-heading"><span>HERE RIGHT NOW</span><span className="presence-count"><i /> {room.members.length} online</span></div>
          <div className="members-list">
            {room.members.map((member, index) => (
              <div className="member-row" key={member.id} style={{ "--member-color": member.color, "--member-delay": `${index * 60}ms` }}>
                <span className="member-avatar">{member.name.slice(0, 1).toUpperCase()}</span>
                <span className="member-name">{member.name}{member.id === currentMember?.id && <span className="you-tag">YOU</span>}</span>
                <span className="member-online" aria-label="Online" />
              </div>
            ))}
          </div>
          <div className="people-footer">
            <div className="people-footer-icon"><Sparkles size={16} /></div>
            <p><strong>Showing up is the work.</strong><br />Glad you're here, {currentMember?.name || profile.name}.</p>
          </div>
          <div className="room-rules"><span>ROOM VIBE</span><p>Mic off, minds on.<br />Be kind. Take breaks.</p></div>
        </aside>

        <section className="focus-panel" aria-label="Shared Pomodoro timer">
          <div className="focus-topline"><span className="section-overline">A LITTLE FOCUS GOES A LONG WAY</span><span className="session-count"><span className="session-pips">{[0, 1, 2, 3].map((index) => <i key={index} className={index < timer.completedSessions % 4 ? "completed" : ""} />)}</span> {timer.completedSessions} {timer.completedSessions === 1 ? "session" : "sessions"}</span></div>
          <div className="timer-card">
            <div className={`timer-orbit ${timer.status === "running" ? "is-running" : ""}`}>
              <svg className="timer-ring" viewBox="0 0 320 320" aria-hidden="true">
                <circle className="timer-ring-track" cx="160" cy="160" r="148" />
                <circle className="timer-ring-progress" cx="160" cy="160" r="148" style={{ strokeDashoffset: 930 * (1 - timer.remaining / { focus: 1500, shortBreak: 300, longBreak: 900 }[timer.mode]) }} />
              </svg>
              <div className="timer-center">
                <span className="timer-mode-label"><activeMode.icon size={15} /> {activeMode.label.toUpperCase()}</span>
                <span className="timer-digits" aria-live="off">{formatTime(timer.remaining)}</span>
                <span className={`timer-status ${timer.status}`}><i /> {timer.status === "running" ? "IN THE ZONE" : timer.status === "paused" ? "PAUSED" : "READY WHEN YOU ARE"}</span>
              </div>
              <div className="timer-spark timer-spark-one" /><div className="timer-spark timer-spark-two" />
            </div>
            <div className="timer-controls">
              <button className="timer-reset icon-button" type="button" title="Reset timer" aria-label="Reset timer" onClick={() => sendTimerCommand("reset")}><RotateCcw size={17} /></button>
              <button className="timer-main-control" type="button" onClick={() => sendTimerCommand(timer.status === "running" ? "pause" : "start")}>
                {timer.status === "running" ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                <span>{timer.status === "running" ? "Pause session" : timer.status === "paused" ? "Keep going" : "Start session"}</span>
              </button>
              <button className="timer-skip icon-button" type="button" title="Skip to next session" aria-label="Skip to next session" onClick={() => sendTimerCommand("skip")}><SkipForward size={17} /></button>
            </div>
            <div className="timer-modes" role="group" aria-label="Timer mode">
              {timerModes.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" className={timer.mode === id ? "selected" : ""} aria-pressed={timer.mode === id} disabled={timer.status === "running"} onClick={() => sendTimerCommand("select", id)}>
                  <Icon size={15} /><span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="focus-quote"><span className="quote-mark">“</span><p>One thing at a time.<br /><strong>You've got this.</strong></p><span className="quote-attribution">A NOTE TO YOURSELF</span></div>
          <div className="focus-bottom"><span><Clock3 size={14} /> 25 MIN FOCUS · 5 MIN BREAK</span><span>SHARED WITH {otherMembers.length} {otherMembers.length === 1 ? "OTHER" : "OTHERS"}</span></div>
        </section>

        <aside className="chat-panel" aria-label="Room chat">
          <div className="chat-header">
            <div><span className="section-overline">SAY HELLO</span><h2>Room chat <span className="chat-live"><i /> LIVE</span></h2></div>
          </div>
          <div className="chat-subhead"><MessageCircle size={14} /><span>A small hello can make a big difference.</span></div>
          <div className="messages-list" aria-live="polite" aria-relevant="additions text">
            {room.messages.length === 0 ? (
              <div className="empty-chat"><div className="empty-chat-icon"><MessageCircle size={19} /></div><strong>It's nice and quiet in here.</strong><p>Be the first to say hello.</p><span>NO PRESSURE, JUST PEOPLE</span></div>
            ) : room.messages.map((message) => (
              <article className={`message ${message.senderId === currentMember?.id ? "own-message" : ""}`} key={message.id}>
                <div className="message-avatar" style={{ "--member-color": message.color }}>{message.name.slice(0, 1).toUpperCase()}</div>
                <div className="message-content">
                  <div className="message-meta"><strong>{message.name}{message.senderId === currentMember?.id && <span className="you-tag">YOU</span>}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{formatMessageTime(message.createdAt)}</time></div>
                  <p>{message.text}</p>
                </div>
              </article>
            ))}
            <div ref={messageEndRef} />
          </div>
          <form className="message-form" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="message-input">Write a message</label>
            <textarea id="message-input" maxLength={500} rows={1} placeholder="Send a little encouragement..." value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(event);
              }
            }} />
            <div className="message-form-footer"><span>{draft.length}/500</span><button type="submit" disabled={!draft.trim()} title="Send message" aria-label="Send message"><Send size={16} /></button></div>
          </form>
          <div className="chat-footnote"><span>BE KIND, KEEP IT LIGHT</span><span>↵ SEND · SHIFT + ↵ NEW LINE</span></div>
        </aside>
      </div>

      {showDetails && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDetails(false); }}>
        <section className="details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title">
          <button className="modal-close icon-button" type="button" aria-label="Close" onClick={() => setShowDetails(false)}><X size={18} /></button>
          <span className="section-overline">A GOOD PLACE TO LAND</span><h2 id="details-title">A few room notes.</h2>
          <div className="detail-row"><span className="detail-icon"><Users size={17} /></span><div><strong>Study together, wherever</strong><p>Everyone in this room shares the same timer and can see who's here.</p></div></div>
          <div className="detail-row"><span className="detail-icon"><MessageCircle size={17} /></span><div><strong>Keep chat kind</strong><p>Messages are visible to everyone currently in the room and clear when it empties.</p></div></div>
          <div className="detail-row"><span className="detail-icon"><Clock3 size={17} /></span><div><strong>Take a break when you need one</strong><p>Timer controls are shared, so give the room a heads-up before changing the session.</p></div></div>
          <button className="modal-done" type="button" onClick={() => setShowDetails(false)}>Sounds good <Check size={16} /></button>
        </section>
      </div>}
      <footer className="app-footer"><span>STUDY HALL · A LITTLE BETTER, TOGETHER</span><button type="button" onClick={() => setShowDetails(true)}>ROOM NOTES <ChevronDown size={13} /></button></footer>
    </main>
  );
}