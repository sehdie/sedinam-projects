import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  Cpu,
  Crown,
  DoorOpen,
  Flame,
  Gamepad2,
  Hash,
  Lightbulb,
  LoaderCircle,
  Radio,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

const choiceColors = ["#e87558", "#6b91a2", "#8a9d52", "#d4a947"];
const choiceLetters = ["A", "B", "C", "D"];

function formatCountdown(endsAt, now) {
  if (!endsAt) return "00:00";
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return `00:${String(remaining).padStart(2, "0")}`;
}

function getAvatarColor(value) {
  const palette = ["#e87558", "#6b91a2", "#8a9d52", "#d4a947", "#b57b9f", "#68846e"];
  return palette[[...value].reduce((total, character) => total + character.charCodeAt(0), 0) % palette.length];
}

export default function App() {
  const [name, setName] = useState(localStorage.getItem("quiz-club-name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const socketRef = useRef(null);
  const currentPlayer = room?.players.find((player) => player.id === socketRef.current?.id);
  const isHost = currentPlayer?.isHost;
  const timerRemaining = room?.endsAt ? Math.max(0, Math.ceil((room.endsAt - now) / 1000)) : 0;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => socketRef.current?.disconnect(), []);

  useEffect(() => {
    setSelectedAnswer(null);
  }, [room?.question?.id, room?.phase]);

  function connect(action, payload) {
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Add your name first so the room knows who you are.");
      document.getElementById("player-name")?.focus();
      return;
    }
    localStorage.setItem("quiz-club-name", cleanName);
    setError("");
    setRoom(null);
    socketRef.current?.disconnect();

    const socket = io({ autoConnect: false });
    socketRef.current = socket;
    socket.on("connect", () => {
      setSocketStatus("online");
      socket.emit(action, { ...payload, name: cleanName });
    });
    socket.on("disconnect", () => setSocketStatus("offline"));
    socket.on("connect_error", () => {
      setSocketStatus("offline");
      setError("Can't reach Quiz Club right now. Check that the server is running.");
    });
    socket.on("room:error", (message) => setError(message));
    socket.on("room:state", (state) => {
      setRoom(state);
      setError("");
    });
    socket.connect();
  }

  function createRoom(event) {
    event.preventDefault();
    connect("room:create", {});
  }

  function joinRoom(event) {
    event.preventDefault();
    connect("room:join", { roomCode: joinCode.toUpperCase() });
  }

  function leaveRoom() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setRoom(null);
    setSocketStatus("connecting");
    setJoinCode("");
    setError("");
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard isn't available here. Share the code: " + room.roomCode);
    }
  }

  function submitAnswer(index) {
    if (room.phase !== "question" || currentPlayer?.answered) return;
    setSelectedAnswer(index);
    socketRef.current?.emit("game:answer", index);
  }

  if (!room) {
    return (
      <main className="welcome-page">
        <header className="welcome-nav">
          <a className="quiz-brand" href="#home" aria-label="Quiz Club home">
            <span className="brand-symbol"><Gamepad2 size={19} /></span>
            <span>QUIZ<span className="brand-light">CLUB</span></span>
          </a>
          <span className="nav-kicker"><span className="pulse-dot" /> THE LIVE QUIZ ROOM</span>
          <span className="nav-kicker nav-kicker-right">PLAY SOLO OR BRING THE WHOLE CREW</span>
        </header>

        <section className="welcome-content" id="home">
          <div className="welcome-left">
            <div className="welcome-overline"><span /> YOUR NEXT GOOD STORY STARTS WITH A QUESTION</div>
            <h1>Brains on.<br /><span>Game face.</span></h1>
            <p className="welcome-deck">A fast, friendly quiz night for curious people. Bring your best guess. Bring a friend. See what you know.</p>
            <div className="quiz-poster" aria-hidden="true">
              <div className="poster-sun" />
              <div className="poster-lines poster-lines-one" />
              <div className="poster-lines poster-lines-two" />
              <div className="poster-card poster-card-one"><Sparkles size={19} /><span>ODD<br />FACTS</span></div>
              <div className="poster-card poster-card-two"><Zap size={19} /><span>QUICK<br />THINKING</span></div>
              <div className="poster-stamp">Q<br /><small>01</small></div>
              <div className="poster-caption"><span>TONIGHT'S LINEUP</span><span>8 QUESTIONS · 20 SECONDS EACH</span></div>
            </div>
            <div className="welcome-stats"><span><Users size={15} /> UP TO 12 PLAYERS</span><i /><span><Timer size={15} /> 4 MINUTE ROUND</span><i /><span><Radio size={15} /> LIVE SCORES</span></div>
          </div>

          <section className="entry-card" aria-labelledby="entry-title">
            <div className="entry-card-top"><span className="entry-card-label">WELCOME TO THE ARENA</span><span className="entry-card-icon"><Swords size={17} /></span></div>
            <h2 id="entry-title">Ready when you are.</h2>
            <p className="entry-card-subtitle">Pick a name, then make a room or jump into one already waiting.</p>
            <form className="create-form" onSubmit={createRoom}>
              <label htmlFor="player-name">YOUR PLAYER NAME</label>
              <input id="player-name" autoComplete="nickname" maxLength={20} placeholder="e.g. Curious Casey" value={name} onChange={(event) => setName(event.target.value)} />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="create-button" type="submit"><span>Create a room</span><ArrowRight size={17} /></button>
            </form>
            <div className="or-divider"><span /> OR JOIN A FRIEND <span /></div>
            <form className="join-form" onSubmit={joinRoom}>
              <label htmlFor="room-code">FOUR-LETTER ROOM CODE</label>
              <div className="room-code-input"><Hash size={16} /><input id="room-code" autoComplete="off" maxLength={4} placeholder="A  B  C  D" value={joinCode} onChange={(event) => setJoinCode(event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase())} /><button type="submit" disabled={joinCode.length !== 4} aria-label="Join room"><ArrowRight size={17} /></button></div>
            </form>
            <div className="entry-note"><Lightbulb size={14} /><span>Quick guesses score more. Good luck out there.</span></div>
          </section>
        </section>
        <footer className="welcome-footer"><span>QUIZ CLUB · 2026</span><span>PLAY CURIOUS</span><span>NO TRICK QUESTIONS. MOSTLY.</span></footer>
      </main>
    );
  }

  const isLobby = room.phase === "lobby";
  const isQuestion = room.phase === "question";
  const isReveal = room.phase === "reveal";
  const isResults = room.phase === "results";
  const answersLocked = currentPlayer?.answered || isReveal || isResults;
  const ownRank = room.players.findIndex((player) => player.id === currentPlayer?.id) + 1;

  return (
    <main className="arena-page">
      <header className="arena-header">
        <a className="quiz-brand" href="#arena" aria-label="Quiz Club">
          <span className="brand-symbol"><Gamepad2 size={18} /></span><span>QUIZ<span className="brand-light">CLUB</span></span>
        </a>
        <div className="arena-room-meta"><span className="room-status"><i /> {isLobby ? "LOBBY OPEN" : isResults ? "ROUND COMPLETE" : "LIVE ROUND"}</span><span className="meta-separator" /><span className="arena-code-label">ROOM</span><strong>{room.roomCode}</strong></div>
        <div className="arena-header-actions"><span className={`connection-status ${socketStatus}`}><i /> {socketStatus === "online" ? "LIVE" : "RECONNECTING"}</span><button className="leave-room-button" type="button" onClick={leaveRoom}><DoorOpen size={15} /><span>Leave room</span></button></div>
      </header>

      <div className="arena-body" id="arena">
        <section className="game-column">
          {isLobby && (
            <div className="lobby-view">
              <div className="round-label"><span className="round-label-line" /> GET THE CREW TOGETHER <span className="round-label-line" /></div>
              <div className="lobby-icon"><Users size={24} /></div>
              <h1>Room <span>{room.roomCode}</span></h1>
              <p className="lobby-subtitle">Send your code to the group chat. The more brains, the better the guesses.</p>
              <button className="share-code-button" type="button" onClick={copyRoomCode}>{copied ? <Check size={17} /> : <Copy size={17} />}<span>{copied ? "CODE COPIED" : "COPY ROOM CODE"}</span></button>
              <div className="lobby-roster">
                <div className="roster-heading"><span>PLAYERS IN THE ROOM</span><span>{room.players.length} / 12</span></div>
                <div className="roster-grid">{room.players.map((player, index) => <div className="roster-player" key={player.id} style={{ "--player-accent": getAvatarColor(player.name), "--player-delay": `${index * 70}ms` }}><span className="roster-avatar">{player.name.slice(0, 1).toUpperCase()}</span><span>{player.name}</span>{player.isHost && <Crown size={13} />}</div>)}</div>
              </div>
              <div className="lobby-start-wrap">{isHost ? <div className="lobby-actions"><button className="start-game-button" type="button" disabled={room.players.length < 2} onClick={() => socketRef.current?.emit("game:start")}><span>{room.players.length < 2 ? "Waiting for one more player" : "Start the quiz"}</span><ArrowRight size={18} /></button>{room.players.length === 1 && <button className="solo-game-button" type="button" onClick={() => socketRef.current?.emit("game:solo")}><Cpu size={16} /><span>Play solo vs. QuizBot</span><ArrowRight size={16} /></button>}</div> : <div className="waiting-message"><LoaderCircle size={16} /><span>Waiting for the host to start...</span></div>}</div>
              <p className="lobby-footnote"><CircleHelp size={13} /> 8 questions · 20 seconds per answer · fastest correct answer wins</p>
            </div>
          )}

          {(isQuestion || isReveal) && (
            <div className={`question-view ${isReveal ? "is-reveal" : ""}`}>
              <div className="question-topline"><span className="round-label"><span className="round-label-line" /> {room.question.category} <span className="round-label-line" /></span><span className="question-progress">QUESTION <strong>{String(room.questionNumber).padStart(2, "0")}</strong> <i>/ {String(room.questionTotal).padStart(2, "0")}</i></span></div>
              <div className={`question-clock ${timerRemaining <= 5 && isQuestion ? "urgent" : ""}`}><Timer size={15} /><span>{formatCountdown(room.endsAt, now)}</span><div className="clock-track"><i style={{ width: `${Math.max(0, Math.min(100, timerRemaining / 20 * 100))}%` }} /></div></div>
              <h1 className="question-prompt">{room.question.prompt}</h1>
              <div className="answer-grid">
                {room.question.options.map((option, index) => {
                  const isCorrect = isReveal && index === room.question.correctIndex;
                  const isWrongSelection = isReveal && selectedAnswer === index && index !== room.question.correctIndex;
                  return <button className={`answer-option ${selectedAnswer === index ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrongSelection ? "is-wrong" : ""}`} key={option} type="button" disabled={answersLocked || !isQuestion} onClick={() => submitAnswer(index)} style={{ "--choice-color": choiceColors[index] }}><span className="answer-letter">{isCorrect ? <Check size={17} /> : choiceLetters[index]}</span><span className="answer-text">{option}</span>{selectedAnswer === index && !isReveal && <span className="answer-lock">LOCKED IN</span>}</button>;
                })}
              </div>
              {isQuestion && <div className="answer-feedback">{currentPlayer?.answered ? <><CheckCircle2 size={16} /><span>Answer locked. {room.players.filter((player) => !player.answered).length} {room.players.filter((player) => !player.answered).length === 1 ? "player is" : "players are"} still thinking.</span></> : <><Zap size={15} /><span>Choose quickly. Correct answers earn more points when you answer fast.</span></>}</div>}
              {isReveal && <div className="explanation-box"><span className="explanation-icon"><Lightbulb size={18} /></span><div><span className="explanation-kicker">THE QUICK EXPLAINER</span><p>{room.question.explanation}</p></div><span className="reveal-next"><i /> NEXT QUESTION SOON</span></div>}
            </div>
          )}

          {isResults && (
            <div className="results-view">
              <div className="results-confetti confetti-one" /><div className="results-confetti confetti-two" /><div className="results-confetti confetti-three" />
              <span className="results-eyebrow"><Trophy size={15} /> THE FINAL TALLY</span>
              <div className="winner-medal"><Award size={33} /></div>
              <h1>{room.players[0]?.id === currentPlayer?.id ? "That's your victory." : `${room.players[0]?.name || "No one"} takes the crown.`}</h1>
              <p className="results-subtitle">Eight questions down. Here's how the room stacked up.</p>
              <div className="final-podium">{room.players.slice(0, 3).map((player, index) => <div className={`podium-person podium-${index + 1}`} key={player.id} style={{ "--player-accent": getAvatarColor(player.name) }}><span className="podium-rank">{index + 1 === 1 ? <Crown size={16} /> : `0${index + 1}`}</span><span className="podium-avatar">{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong><span className="podium-score">{player.score.toLocaleString()} <small>PTS</small></span></div>)}</div>
              <div className="personal-result"><span>YOUR FINISH</span><strong>#{ownRank}</strong><span>{currentPlayer?.score.toLocaleString() || 0} points earned</span></div>
              <button className="back-to-lobby" type="button" onClick={leaveRoom}><ArrowLeft size={16} /> Back to room setup</button>
            </div>
          )}
        </section>

        <aside className="score-column">
          <section className="scoreboard-panel">
            <div className="scoreboard-title"><div><span className="scoreboard-eyebrow">THE LIVE TALLY</span><h2>Scoreboard <span>{room.players.length}</span></h2></div><span className="scoreboard-live"><i /> LIVE</span></div>
            {isLobby ? <p className="scoreboard-prompt"><Users size={14} /> Scores show up once the first question lands.</p> : <div className="leaderboard-list">{room.players.map((player, index) => <div className={`leaderboard-row ${player.id === currentPlayer?.id ? "is-you" : ""} ${player.lastCorrect ? "got-it-right" : ""}`} key={player.id} style={{ "--player-accent": getAvatarColor(player.name) }}><span className="leaderboard-rank">{String(index + 1).padStart(2, "0")}</span><span className="leaderboard-avatar">{player.name.slice(0, 1).toUpperCase()}</span><span className="leaderboard-name">{player.name}{player.isBot && <small>CPU</small>}{player.id === currentPlayer?.id && <small>YOU</small>}</span><span className="leaderboard-score">{player.score.toLocaleString()}</span>{player.lastCorrect && <CheckCircle2 className="leaderboard-correct" size={14} />}{isQuestion && player.answered && <CheckCircle2 className="leaderboard-answered" size={13} />}</div>)}</div>}
            {!isLobby && <div className="scoreboard-key"><span><i className="key-dot key-correct" /> CORRECT</span><span><i className="key-dot key-pending" /> THINKING</span></div>}
          </section>
          <section className="round-info-panel"><div className="round-info-icon"><Flame size={17} /></div><div><span className="round-info-label">THE RULES</span><p>Fast + correct = more points.<br />You only get one guess.</p></div></section>
          <div className="your-standing"><span className="standing-icon"><Trophy size={15} /></span><div><span>YOUR STANDING</span><strong>{isLobby ? "Ready to play" : `#${ownRank} / ${room.players.length}`}</strong></div><span className="standing-score">{currentPlayer?.score.toLocaleString() || 0}<small>PTS</small></span></div>
          <div className="arena-sidebar-foot"><span>ROOM {room.roomCode}</span><span>PLAY FAIR. STAY CURIOUS.</span></div>
        </aside>
      </div>
      <footer className="arena-footer"><span>QUIZ CLUB · LIVE TRIVIA</span><span>GOOD GUESSES ONLY</span><span>BUILT FOR THE GROUP CHAT <Sparkles size={12} /></span></footer>
    </main>
  );
}