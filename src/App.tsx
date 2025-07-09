import React, { useEffect, useState, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import './App.css';

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBtzd0B3fIDJ8XRM1ESKx3klnGZRtVy0Dg',
  authDomain: 'digital-scoresheet-by-jcta.firebaseapp.com',
  projectId: 'digital-scoresheet-by-jcta',
  storageBucket: 'digital-scoresheet-by-jcta.firebasestorage.app',
  messagingSenderId: '911278880062',
  appId: '1:911278880062:web:7ae070f8bdc8e9bbe8686f',
  measurementId: 'G-C31DHJ8EXT',
  databaseURL: 'https://digital-scoresheet-by-jcta-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const DEFAULT_PASSWORD = 'JCTA123';

const auth = getAuth(app);

export default function App() {
  try {
  const [events, setEvents] = useState([]);
  const [organizerView, setOrganizerView] = useState(false);
  const [currentJudge, setCurrentJudge] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [viewMode, setViewMode] = useState<'intro' | 'judge' | 'organizer'>(
    'intro'
  );
  const updateFirebase = (key: string, data: any) => {
    if (!user) {
      console.warn("❌ No user. Skipping updateFirebase.");
      return;
    }
    set(ref(db, `users/${user.uid}/${key}`), data)
      .then(() => {
        console.log(`✅ Updated Firebase key: ${key}`);
      })
      .catch((err) => {
        console.error("❌ Firebase write failed:", err);
      });
  };
  
  const [orgPasswordInput, setOrgPasswordInput] = useState('');
  const [organizerPassword, setOrganizerPassword] = useState(DEFAULT_PASSWORD);
  const [pendingJudgeName, setPendingJudgeName] = useState('');
  const [judgeCodes, setJudgeCodes] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [tempScores, setTempScores] = useState({});

  const chatRef = useRef(null);

  const [user, setUser] = useState(null); // ✅ Firebase Auth user
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    console.log("✅ viewMode:", viewMode);
    console.log("✅ organizerView:", organizerView);
  }, [viewMode, organizerView]);
  
  useEffect(() => {
    if (!user) return;
  
    const base = `users/${user.uid}/`;
  
    const eventsRef = ref(db, base + 'events');
    const chatMessagesRef = ref(db, base + 'chatMessages');
    const codesRef = ref(db, base + 'judgeCodes');
    const passRef = ref(db, base + 'organizerPassword');
  
    onValue(eventsRef, (snapshot) => {
      setEvents(snapshot.val() || []);
    });
  
    onValue(chatMessagesRef, (snapshot) => {
      setChatMessages(snapshot.val() || []);
    });
  
    onValue(codesRef, (snapshot) => {
      const val = snapshot.val();
      const codeList = val ? Object.values(val) : [];
      setJudgeCodes(codeList);
    });
  
    onValue(passRef, (snapshot) => {
      setOrganizerPassword(snapshot.val() || DEFAULT_PASSWORD);
    });
  }, [user]);  // 👈 Make sure to re-run when user changes
      
  useEffect(() => {
    if (!authChecked || !user) return;
  
    const savedView = localStorage.getItem('viewMode');
    const savedJudge = localStorage.getItem('currentJudge');
    const savedOrganizer = localStorage.getItem('organizerView');
  
    if (savedView) setViewMode(savedView as 'intro' | 'judge' | 'organizer');
    if (savedJudge) setCurrentJudge(savedJudge);
    if (savedOrganizer === 'true') setOrganizerView(true);
  }, [authChecked, user]);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
      if (firebaseUser) {
        refreshAllData(); // Automatically pulls the latest data
      }
      
      if (!firebaseUser) {
        localStorage.clear();
        setOrganizerView(false);
        setCurrentJudge('');
        setViewMode('intro');
      } else {
        setTimeout(() => {
          const savedView = localStorage.getItem('viewMode');
          const savedJudge = localStorage.getItem('currentJudge');
          const savedOrganizer = localStorage.getItem('organizerView');
      
          if (savedView) setViewMode(savedView as 'intro' | 'judge' | 'organizer');
          if (savedJudge) setCurrentJudge(savedJudge);
          if (savedOrganizer === 'true') setOrganizerView(true);
        }, 100);
      }
    });
  
    return () => unsubscribe(); // ✅ CORRECTLY outside
  }, []);
      
  const createNewEvent = () => {
    const name = prompt('Enter event name:');
    if (!name) return;
    const newEvents = [
      ...events,
      {
        name,
        participants: ['Alice', 'Bob'],
        judges: ['Judge 1'],
        criteriaPhase1: [{ name: 'Creativity', max: 10 }],
criteriaPhase2: [{ name: 'Impact', max: 10 }],
phase1Participants: ['Alice', 'Bob'],
phase2Participants: [],
        scores: {},
        visibleToJudges: false,
        resultsVisibleToJudges: false, // ✅ NEW FIELD
      },
    ];
    updateFirebase('events', newEvents);
    setEvents(newEvents);
  };
  const createTwoPhasedEvent = () => {
    const name = prompt('Enter 2-Phase Event name:');
    if (!name) return;
    const newEvents = [
      ...events,
      {
        name,
        participants: ['Alice', 'Bob'],
        judges: ['Judge 1'],
        criteria: [], // optional fallback
        criteriaPhase1: [{ name: 'Creativity', max: 10 }],
        criteriaPhase2: [{ name: 'Impact', max: 10 }],
        phase1Participants: ['Alice', 'Bob'],
        phase2Participants: [],
        scores: {}, // in case other logic accesses this
        phase1Scores: {},
        phase2Scores: {},
        submittedJudges: [], // in case other logic accesses this
        submittedJudgesPhase1: [],
        submittedJudgesPhase2: [],
        phase: 1,
        phased: true,
        visibleToJudges: false,
        resultsVisibleToJudges: false,
        selectedForPhase2: [],
      },
    ];
    updateFirebase('events', newEvents);
    setEvents(newEvents);
  };
      
  const deleteEvent = (idx) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      const copy = [...events];
      copy.splice(idx, 1);
      updateFirebase('events', copy);
    }
  };

  const updateEvent = (idx, newEv) => {
    const copy = [...events];
    copy[idx] = newEv;
    updateFirebase('events', copy);
  };
  const promptEditList = (title, list, callback) => {
    const input = prompt(`${title} (comma separated):`, list.join(', '));
    if (input != null) {
      const newList = input.split(',').map((s) => s.trim()).filter(Boolean);
      callback(newList);
    }
  };

  const toggleVisibility = (idx) => {
    const ev = events[idx];
    const updated = { ...ev, visibleToJudges: !ev.visibleToJudges };
    const updatedEvents = [...events];
    updatedEvents[idx] = updated;
    updateFirebase('events', updatedEvents);
    setEvents(updatedEvents); // ensure UI reflects change immediately
  };
  
  const toggleResultsVisibility = (idx) => {
    const ev = events[idx];
    const updated = {
      ...ev,
      resultsVisibleToJudges: !ev.resultsVisibleToJudges,
    };
    const updatedEvents = [...events];
    updatedEvents[idx] = updated;
    updateFirebase('events', updatedEvents);
    setEvents(updatedEvents);
  };
  
  const handleInputScore = (idx, judge, participant, crit, val) => {
    const ev = events[idx];
    const scoreVal = val === '' ? '' : Number(val);
    const newScores = {
      ...ev.scores,
      [judge]: {
        ...(ev.scores[judge] || {}),
        [participant]: {
          ...(ev.scores[judge]?.[participant] || {}),
          [crit]: scoreVal,
        },
      },
    };
    updateEvent(idx, { ...ev, scores: newScores });
  };

  const handleSubmitScores = (idx) => {
    const ev = events[idx];
    const updatedSubmitted = [...(ev.submittedJudges || []), currentJudge];

    // 🔁 Push all tempScores to Firebase
    const scoresToPush = { ...ev.scores };

    const temp = tempScores?.[idx] || {};
    Object.keys(temp).forEach((participant) => {
      const participantScores = temp[participant];
      Object.keys(participantScores).forEach((crit) => {
        if (!scoresToPush[currentJudge]) scoresToPush[currentJudge] = {};
        if (!scoresToPush[currentJudge][participant])
          scoresToPush[currentJudge][participant] = {};
        scoresToPush[currentJudge][participant][crit] = Number(
          participantScores[crit]
        );
      });
    });

    updateEvent(idx, {
      ...ev,
      scores: scoresToPush,
      submittedJudges: updatedSubmitted,
    });

    setTempScores({});
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const updatedMessages = [
        ...chatMessages,
        {
          sender: organizerView ? 'Organizer' : currentJudge,
          text: newMessage.trim(),
        },
      ];
      updateFirebase('chatMessages', updatedMessages);
      setNewMessage('');
    }
  };

  const generateJudgeCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const updatedCodes = [...judgeCodes, code];
  
    // Convert to object for Firebase
    const codeObj = updatedCodes.reduce((acc, val, idx) => {
      acc[idx] = val;
      return acc;
    }, {} as Record<string, string>);
  
    updateFirebase('judgeCodes', codeObj);
    setJudgeCodes(updatedCodes); // ✅ Also update UI
    alert('New Judge Code: ' + code);
  };

  const changeOrganizerPassword = () => {
    const newPass = prompt('Enter new password:');
    if (newPass && newPass.length >= 4) {
      updateFirebase('organizerPassword', newPass);
      alert('Password updated.');
    }
  };

  const handleJudgeLogin = () => {
    if (!judgeCodes.includes(codeInput.trim())) {
      alert('Invalid code');
      return;
    }
    if (!pendingJudgeName.trim()) {
      alert('Please enter a name.');
      return;
    }
  
    const updatedEvents = events.map((ev) => {
      if (!ev.judges.includes(pendingJudgeName)) {
        return { ...ev, judges: [...ev.judges, pendingJudgeName] };
      }
      return ev;
    });
  
    updateFirebase('events', updatedEvents);
    localStorage.setItem('viewMode', 'judge');
    localStorage.setItem('currentJudge', pendingJudgeName);
    setCurrentJudge(pendingJudgeName);
    setViewMode('judge');
  };
  
  const handleOrganizerLogin = () => {
    if (orgPasswordInput === organizerPassword) {
      localStorage.setItem('viewMode', 'organizer');
      localStorage.setItem('organizerView', 'true');
      setOrganizerView(true);
      setViewMode('organizer');
    } else {
      alert('Incorrect password');
    }
  };
  
  const handleImport = () => {
    if (!user) return;
    const input = prompt('Paste your exported JSON here:');
    if (input) {
      try {
        const parsed = JSON.parse(input);
        updateFirebase('events', parsed.events || []);
        updateFirebase('chatMessages', parsed.chatMessages || []);
        updateFirebase('judgeCodes', parsed.judgeCodes || []);
        updateFirebase('organizerPassword', parsed.organizerPassword || DEFAULT_PASSWORD);
        alert('Data imported and synced to Firebase.');
      } catch {
        alert('Invalid data.');
      }
    }
  };
  
  const handleExport = () => {
    if (!user) return;
    const exportData = {
      events,
      chatMessages,
      judgeCodes,
      organizerPassword,
    };
    navigator.clipboard.writeText(JSON.stringify(exportData));
    alert('Data copied to clipboard.');
  };
  
  const handleAuthLogout = () => {
    signOut(auth).then(() => {
      alert("👋 Signed out");
      localStorage.clear();
      setOrganizerView(false);
      setCurrentJudge('');
      setViewMode('intro');
      setEvents([]);
      setJudgeCodes([]);
      setChatMessages([]);
    });
  };
  const handleLogout = () => {
    localStorage.clear();
    setOrganizerView(false);
    setCurrentJudge('');
    setViewMode('intro');
    setEvents([]);
    setJudgeCodes([]);
    setChatMessages([]);
  };
  
  const refreshAllData = () => {
    if (!user) return;
  
    const base = `users/${user.uid}/`;
  
    onValue(ref(db, base + 'events'), (snapshot) => {
      setEvents(snapshot.val() || []);
    }, { onlyOnce: true });
  
    onValue(ref(db, base + 'chatMessages'), (snapshot) => {
      setChatMessages(snapshot.val() || []);
    }, { onlyOnce: true });
  
    onValue(ref(db, base + 'judgeCodes'), (snapshot) => {
      const val = snapshot.val();
      const codeList = val ? Object.values(val) : [];
      setJudgeCodes(codeList);
    }, { onlyOnce: true });
  
    onValue(ref(db, base + 'organizerPassword'), (snapshot) => {
      setOrganizerPassword(snapshot.val() || DEFAULT_PASSWORD);
    }, { onlyOnce: true });
  
    alert('✅ Data refreshed from Firebase.');
  };

// Calculates total score given by a judge for a participant
const calcTotalForJudge = (ev, judge, participant, phase = null) => {
  const scores =
    phase === 'phase1'
      ? ev.phase1Scores?.[judge]?.[participant] || {}
      : phase === 'phase2'
      ? ev.phase2Scores?.[judge]?.[participant] || {}
      : ev.scores?.[judge]?.[participant] || {};

  return Object.values(scores).reduce((a, b) => a + Number(b || 0), 0);
};

// Calculates total score from all judges for a participant
const calcTotalAllJudges = (ev, participant, phase = null) => {
  return ev.judges.reduce(
    (sum, judge) => sum + calcTotalForJudge(ev, judge, participant, phase),
    0
  );
};

const calcCombinedAvgPhased = (ev, participant) => {
  const judgeList1 = Object.keys(ev.phase1Scores || {});
  const judgeList2 = Object.keys(ev.phase2Scores || {});
  const totalJudges = new Set([...judgeList1, ...judgeList2]);

  if (totalJudges.size === 0) return 0;

  let total = 0;
  totalJudges.forEach((j) => {
    total += calcTotalForJudge(ev, j, participant, 'phase1');
    total += calcTotalForJudge(ev, j, participant, 'phase2');
  });

  return (total / totalJudges.size).toFixed(2);
};

  const renderSummary = (ev) => {
    const ranked = ev.participants
      .map((p) => ({
        name: p,
        avg: Number(calcAvg(ev, p)),
      }))
      .sort((a, b) => b.avg - a.avg);

    return (
      <div className="summary-box">
        <h3>🏅 Rankings (Based on Averages)</h3>
        <ol>
          {ranked.map((r, idx) => (
            <li key={idx}>
              {r.name} — {r.avg.toFixed(2)}
            </li>
          ))}
        </ol>
      </div>
    );
  };

  const exportOverallSummaryPDF = () => {
    const doc = new jsPDF();
    doc.text('Overall Rankings (by Average)', 14, 14);
    events.forEach((ev, i) => {
      const ranked = ev.participants
        .map((p) => ({
          name: p,
          avg: Number(calcAvg(ev, p)),
        }))
        .sort((a, b) => b.avg - a.avg);

      autoTable(doc, {
        startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 20,
        head: [[`🏆 ${ev.name}`]],
        body: ranked.map((r, idx) => [
          `${idx + 1}. ${r.name} — ${r.avg.toFixed(2)}`,
        ]),
      });
    });
    doc.save('overall_summary.pdf');
  };

  const exportPerJudgePDF = () => {
    const doc = new jsPDF();
    doc.text('Per-Judge Scoring Summary', 14, 14);
    events.forEach((ev, i) => {
      ev.judges.forEach((j) => {
        autoTable(doc, {
          startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 20,
          head: [[`👨‍⚖️ ${j} — ${ev.name}`]],
          body: ev.participants.map((p) => [
            `${p}: ${calcTotalForJudge(ev, j, p)}`,
          ]),
        });
      });
    });
    doc.save('per_judge_results.pdf');
  };
  const exportSpecificEventPDF = () => {
    const evName = prompt('Enter exact event name:');
    const ev = events.find((e) => e.name === evName);
    if (!ev) {
      alert('Event not found.');
      return;
    }

    const doc = new jsPDF();
    doc.text(`📄 ${ev.name} – Scoring Summary (by Average)`, 14, 14);

    autoTable(doc, {
      head: [['Participant', ...ev.judges, 'Total', 'Average']],
      body: ev.participants.map((p) => [
        p,
        ...ev.judges.map((j) => calcTotalForJudge(ev, j, p)),
        calcTotalAllJudges(ev, p),
        calcAvg(ev, p),
      ]),
    });

    const ranked = ev.participants
      .map((p) => ({
        name: p,
        avg: Number(calcAvg(ev, p)),
      }))
      .sort((a, b) => b.avg - a.avg);

    autoTable(doc, {
      startY: doc.lastAutoTable?.finalY + 10 || 60,
      head: [['🏅 Rankings (Based on Averages)']],
      body: ranked.map((r, idx) => [
        `${idx + 1}. ${r.name} — ${r.avg.toFixed(2)}`,
      ]),
    });

    doc.save(`${ev.name.replace(/\s+/g, '_')}.pdf`);
  };
  const loginWithEmail = async () => {
    const email = prompt("Enter email:");
    const password = prompt("Enter password:");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("✅ Logged in successfully.");    } catch (err) {
      alert("❌ Login failed: " + err.message);
    }
  };
  
  const registerWithEmail = async () => {
    const email = prompt("Enter new email:");
    const password = prompt("Enter new password (min 6 chars):");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("✅ Registered successfully. You're now logged in.");
      setViewMode('intro');        // ✅ GO TO judge/organizer menu
    } catch (err) {
      alert("❌ Registration failed: " + err.message);
    }
  };
  
  if (!authChecked) {
    return (
      <div className="intro-screen">
        <h1>🎯 Digital Scoresheet App</h1>
        <p className="text-center credits">made by JCTA</p>
        <div className="flex-center">
          <p>⏳ Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  
  if (!user) {
    return (
      <div className="intro-screen">
        <h1>🎯 Digital Scoresheet App</h1>
        <p className="text-center credits">made by JCTA</p>
        <div className="flex-center">
          <button className="btn-purple" onClick={loginWithEmail}>
            🔐 Login with Email
          </button>
          <button className="btn-yellow" onClick={registerWithEmail}>
            🆕 Register New Account
          </button>
        </div>
      </div>
    );
  }
    
  if (viewMode === 'intro') {
    return (
      <div className="intro-screen">
        <h1>🎯 Digital Scoresheet App</h1>
        <p className="text-center credits">made by JCTA</p>
        <div className="flex-center">
          <button className="btn-blue" onClick={() => setViewMode('judge')}>
            Login as Judge
          </button>
          <button
  className="btn-green"
  onClick={() => {
    setOrganizerView(false); // ✅ Force password screen to appear
    setViewMode('organizer');
  }}
>
  Login as Organizer
</button>

                  </div>
      </div>
    );
  }
  const calcAvg = (ev, participant, phase = null) => {
    const scores =
      phase === 'phase1'
        ? Object.values(ev.phase1Scores || {})
        : phase === 'phase2'
        ? Object.values(ev.phase2Scores || {})
        : Object.values(ev.scores || {});
  
    const judgeCount = scores.length;
    if (judgeCount === 0) return 0;
  
    let total = 0;
    scores.forEach((judge) => {
      const pscores = judge[participant] || {};
      total += Object.values(pscores).reduce((a, b) => a + Number(b || 0), 0);
    });
  
    return (total / judgeCount).toFixed(2);
  };


  const renderOnePhasedEvent = (ev, idx) => {
    return (
      <div key={idx} className="card">
        <h2>{ev.name}</h2>
        <table>
          <thead>
            <tr>
              <th>Participant</th>
              {(ev.criteria || []).map((c, cdx) => (
                <th key={cdx}>{c.name || c}</th>
              ))}
              <th>Total</th>
              <th>Average</th>
            </tr>
          </thead>
          <tbody>
            {(ev.participants || []).map((p, pdx) => (
              <tr key={pdx}>
                <td>{p}</td>
                {(ev.criteria || []).map((c, cdx) => (
                  <td key={cdx}>—</td> // Optional: show per-criterion later
                ))}
                <td>{calcTotalAllJudges(ev, p)}</td>
                <td>{calcAvg(ev, p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
  
        {ev.finalRanking && (
          <>
            <h3>🏅 Final Ranking</h3>
            <ol>
              {ev.finalRanking.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ol>
          </>
        )}
        {organizerView && (
  <div className="button-row">
    <button className="btn-yellow" onClick={() =>
      promptEditList('Participants', ev.participants, (newList) => {
        updateEvent(idx, { ...ev, participants: newList });
      })
    }>
      ✏️ Edit Participants
    </button>

    <button className="btn-yellow" onClick={() =>
      promptEditList('Judges', ev.judges, (newList) => {
        updateEvent(idx, { ...ev, judges: newList });
      })
    }>
      🧑‍⚖️ Edit Judges
    </button>

    <button className="btn-yellow" onClick={() =>
      promptEditList('Criteria', ev.criteria.map((c) => c.name || c), (newList) => {
        const formatted = newList.map((name) => ({ name, max: 10 }));
        updateEvent(idx, { ...ev, criteria: formatted });
      })
    }>
      📝 Edit Criteria
    </button>

    <button className="btn-green" onClick={() => toggleVisibility(idx)}>
      {ev.visibleToJudges ? '🙈 Hide from Judges' : '👁️ Show to Judges'}
    </button>

    <button className="btn-blue" onClick={() => toggleResultsVisibility(idx)}>
      {ev.resultsVisibleToJudges ? '🙈 Hide Results' : '📊 Show Results'}
    </button>

    <button className="btn-red" onClick={() => deleteEvent(idx)}>
      🗑️ Delete Event
    </button>
  </div>
)}

      </div>
    );
  };  

  if (viewMode === 'organizer' && !organizerView) {
    return (
      <div className="intro-screen">
        <h2>🔒 Enter Organizer Password</h2>
        <input
          type="password"
          value={orgPasswordInput}
          onChange={(e) => setOrgPasswordInput(e.target.value)}
          placeholder="Enter password"
        />
        <br />
        <button className="btn-blue" onClick={handleOrganizerLogin}>
          Submit
        </button>
        <button className="btn-gray" onClick={() => setViewMode('intro')}>
          🔙 Back
        </button>
      </div>
    );
  }
  const renderTwoPhasedEvent = (ev, idx) => {
    return (
      <div key={idx} className="card">
        <h2>{ev.name} (Two Phases)</h2>
  
        {/* Phase 1 */}
        <h3>📍 Phase 1</h3>
        <table>
          <thead>
            <tr>
              <th>Participant</th>
              {(ev.criteriaPhase1 || []).map((c, cdx) => (
                <th key={cdx}>{c.name} ({c.max})</th>
              ))}
              <th>Total</th>
              <th>Average</th>
            </tr>
          </thead>
          <tbody>
            {(ev.phase1Participants || []).map((p, pdx) => (
              <tr key={pdx}>
                <td>{p}</td>
                {(ev.criteriaPhase1 || []).map((c, cdx) => (
                  <td key={cdx}>
                    {Object.values(ev.phase1Scores || {}).map(judgeScores =>
                      judgeScores[p]?.[c.name] ?? ''
                    ).filter(v => v !== '').map(Number).reduce((a, b) => a + b, 0)}
                  </td>
                ))}
                <td>{calcTotalAllJudges(ev, p, 'phase1')}</td>
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </table>
  
        {/* Phase 1 Rankings */}
        <h4>🏅 Phase 1 Rankings</h4>
        <ol>
          {(ev.phase1Participants || [])
            .map((p) => ({
              name: p,
              avg: Number(calcAvgPhased(ev, p, 'phase1') || 0),
            }))
            .sort((a, b) => b.avg - a.avg)
            .map((r, i) => (
              <li key={i}>{r.name} — {r.avg.toFixed(2)}</li>
            ))}
        </ol>
  
        {/* Proceed to Phase 2 */}
        {organizerView && ev.phase === 1 && (!ev.phase2Participants || ev.phase2Participants.length === 0) && (
          <button
            className="btn-blue"
            onClick={() => {
              const selected = prompt('Comma-separated names for Phase 2 participants:');
              if (selected) {
                const names = selected.split(',').map((n) => n.trim()).filter(Boolean);
                const updated = {
                  ...ev,
                  phase2Participants: names,
                  phase: 2
                };
                updateEvent(idx, updated);
              }
            }}
          >
            ➡️ Proceed to Phase 2
          </button>
        )}
  
        {/* Phase 2 */}
        {(ev.phase2Participants || []).length > 0 && (
          <>
            <h3>🏁 Phase 2</h3>
            <table>
              <thead>
                <tr>
                  <th>Participant</th>
                  {(ev.criteriaPhase2 || []).map((c, cdx) => (
                    <th key={cdx}>{c.name} ({c.max})</th>
                  ))}
                  <th>Total</th>
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                {(ev.phase2Participants || []).map((p, pdx) => (
                  <tr key={pdx}>
                    <td>{p}</td>
                    {(ev.criteriaPhase2 || []).map((c, cdx) => (
                      <td key={cdx}>
                        {Object.values(ev.phase2Scores || {}).map(judgeScores =>
                          judgeScores[p]?.[c.name] ?? ''
                        ).filter(v => v !== '').map(Number).reduce((a, b) => a + b, 0)}
                      </td>
                    ))}
                    <td>{calcTotalAllJudges(ev, p, 'phase2')}</td>
                    <td>{calcAvgPhased(ev, p, 'phase2')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
  
            {/* Phase 2 Rankings */}
            <h4>🏅 Phase 2 Rankings</h4>
            <ol>
              {(ev.phase2Participants || [])
                .map((p) => ({
                  name: p,
                  avg: Number(calcAvgPhased(ev, p, 'phase2') || 0),
                }))
                .sort((a, b) => b.avg - a.avg)
                .map((r, i) => (
                  <li key={i}>{r.name} — {r.avg.toFixed(2)}</li>
                ))}
            </ol>
          </>
        )}
  
        {/* Combined Overall Rankings */}
        {organizerView && (ev.phase2Participants || []).length > 0 && (
          <>
            <h4>🌟 Overall Rankings (Phase 1 + Phase 2)</h4>
            <ol>
              {(ev.phase2Participants || [])
                .map((p) => {
                  const combined = Number(calcCombinedAvgPhased(ev, p) || 0);
                  return { name: p, combined };
                })
                .sort((a, b) => b.combined - a.combined)
                .map((r, i) => (
                  <li key={i}>{r.name} — {r.combined.toFixed(2)}</li>
                ))}
            </ol>
          </>
        )}
        {organizerView && (
  <div className="button-row">
    <button className="btn-yellow" onClick={() =>
      promptEditList('Participants', ev.participants, (newList) => {
        updateEvent(idx, { ...ev, participants: newList });
      })
    }>
      ✏️ Edit Participants
    </button>

    <button className="btn-yellow" onClick={() =>
      promptEditList('Judges', ev.judges, (newList) => {
        updateEvent(idx, { ...ev, judges: newList });
      })
    }>
      🧑‍⚖️ Edit Judges
    </button>

    <button className="btn-yellow" onClick={() =>
      promptEditList('Criteria', ev.criteria.map((c) => c.name || c), (newList) => {
        const formatted = newList.map((name) => ({ name, max: 10 }));
        updateEvent(idx, { ...ev, criteria: formatted });
      })
    }>
      📝 Edit Criteria
    </button>

    <button className="btn-green" onClick={() => toggleVisibility(idx)}>
      {ev.visibleToJudges ? '🙈 Hide from Judges' : '👁️ Show to Judges'}
    </button>

    <button className="btn-blue" onClick={() => toggleResultsVisibility(idx)}>
      {ev.resultsVisibleToJudges ? '🙈 Hide Results' : '📊 Show Results'}
    </button>

    <button className="btn-red" onClick={() => deleteEvent(idx)}>
      🗑️ Delete Event
    </button>
  </div>
)}
      </div>
    );
  };
  const calcTotalForJudgePhased = (ev, judge, participant, phaseKey) => {
    const scores = ev[phaseKey + 'Scores']?.[judge]?.[participant];
    if (!scores) return 0;
    return Object.values(scores).reduce((sum, val) => sum + Number(val || 0), 0);
  };
  
  const calcAvgPhased = (ev, participant, phaseKey) => {
    const judgeList = Object.keys(ev[phaseKey + 'Scores'] || {});
    if (judgeList.length === 0) return 0;
  
    let total = 0;
    judgeList.forEach((j) => {
      total += calcTotalForJudge(ev, j, participant, phaseKey);
    });
    return (total / judgeList.length).toFixed(2);
  };
  
  const calcCombinedAvg = (ev, participant) => {
    const judgeList1 = Object.keys(ev.phase1Scores || {});
    const judgeList2 = Object.keys(ev.phase2Scores || {});
    const totalJudges = new Set([...judgeList1, ...judgeList2]);
  
    if (totalJudges.size === 0) return 0;
  
    let total = 0;
    totalJudges.forEach((j) => {
      total += calcTotalForJudge(ev, j, participant, 'phase1');
      total += calcTotalForJudge(ev, j, participant, 'phase2');
    });
    return (total / totalJudges.size).toFixed(2);
  };
    const getRanking = (ev, phaseKey) => {
    const participants = phaseKey === 'phase1'
      ? ev.phase1Participants
      : phaseKey === 'phase2'
      ? ev.phase2Participants
      : Array.from(new Set([...(ev.phase1Participants || []), ...(ev.phase2Participants || [])]));
  
    return [...participants].sort((a, b) => {
      const avgA = phaseKey === 'overall'
        ? calcCombinedAvg(ev, a)
        : calcAvg(ev, a, phaseKey);
      const avgB = phaseKey === 'overall'
        ? calcCombinedAvg(ev, b)
        : calcAvg(ev, b, phaseKey);
      return avgB - avgA;
    });
  };

  if (viewMode === 'organizer' && organizerView) {
    return (
      <div className="app-container">
        <h1>📋 Organizer Dashboard</h1>
  
        <div className="btn-row">
          <button className="btn-green" onClick={createNewEvent}>
            ➕ Add Event
          </button>
          <button className="btn-yellow" onClick={createTwoPhasedEvent}>
            ✌️ Add Two-Phased Event
          </button>
          <button className="btn-purple" onClick={generateJudgeCode}>
            🎟️ Generate Judge Code
          </button>
          <button className="btn-blue" onClick={handleExport}>
            📤 Export
          </button>
          <button className="btn-orange" onClick={handleImport}>
            📥 Import
          </button>
          <button className="btn-gray" onClick={refreshAllData}>
            🔄 Refresh
          </button>
          <button className="btn-red" onClick={handleAuthLogout}>
            🔓 Logout
          </button>
        </div>
  
        {/* Active Judge Codes */}
        <div className="card">
          <h3>🎟️ Active Judge Codes:</h3>
          <ul>
            {judgeCodes.length === 0 ? (
              <li>No codes yet</li>
            ) : (
              judgeCodes.map((code, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{code}</span>
                </li>
              ))
            )}
          </ul>
        </div>
  
        {/* Event List */}
        {events.map((ev, idx) =>
          ev.phased ? renderTwoPhasedEvent(ev, idx) : renderOnePhasedEvent(ev, idx)
        )}
      </div>
    );
  }     
  return (
    <div className="app-container">
      {viewMode === 'organizer' && organizerView ? (
        <>
          <div className="top-bar">
            <h1>🎯 Digital Scoresheet App</h1>
            <p className="text-center credits">made by JCTA</p>
  
            <div className="flex-center">
              <button className="btn-green" onClick={createNewEvent}>
                ➕ Add Event
              </button>
              <button className="btn-green" onClick={createTwoPhasedEvent}>
                ➕ Add Two-Phased Event
              </button>
              <button className="btn-purple" onClick={handleImport}>
                📥 Import
              </button>
              <button className="btn-purple" onClick={handleExport}>
                📤 Export ▼
              </button>
              <button className="btn-yellow" onClick={generateJudgeCode}>
                🎫 Generate Judge Code
              </button>
              <button className="btn-blue" onClick={changeOrganizerPassword}>
                🔐 Change Password
              </button>
              <button className="btn-gray" onClick={refreshAllData}>
                🔄 Refresh
              </button>
              <button
                className="btn-gray"
                onClick={() => {
                  setOrganizerView(false);
                  setViewMode('judge');
                }}
              >
                👨‍⚖️ Switch to Judge View
              </button>
              <button className="btn-red" onClick={handleAuthLogout}>
                🚪 Logout
              </button>
            </div>
  
            {/* Active Judge Codes */}
            <div className="card">
              <h3>🎟️ Active Judge Codes:</h3>
              <ul>
                {judgeCodes.length === 0 ? (
                  <li>No codes yet</li>
                ) : (
                  judgeCodes.map((code, i) => <li key={i}>{code}</li>)
                )}
              </ul>
            </div>
          </div>
  
          {events.length === 0 ? (
            <p className="text-center">
              📭 No events yet. Click "➕ Add Event" to begin.
            </p>
          ) : (
            <>
              {events.map((ev, idx) => {
                if (ev.phased) {
                  return renderTwoPhasedEvent(ev, idx);
                } else {
                  return renderOnePhasedEvent(ev, idx);
                }
              })}
  
              <div className="flex-center">
                <button onClick={refreshAllData} className="btn-gray">
                  🔄 Refresh Data
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
{events.map((ev, idx) => {
  if (ev.phased) {
    return (
      <div key={idx} className="card">
        {renderTwoPhasedEvent(ev, idx)}

        {/* Organizer controls for two-phased event */}
        <div className="flex-center" style={{ marginTop: '1em' }}>
          <button className="btn-blue" onClick={() =>
            promptEditList("Edit Participants", ev.participants, (newList) => {
              updateEvent(idx, { ...ev, participants: newList });
            })
          }>👥 Edit Participants</button>

          <button className="btn-blue" onClick={() =>
            promptEditList("Edit Judges", ev.judges, (newList) => {
              updateEvent(idx, { ...ev, judges: newList });
            })
          }>⚖️ Edit Judges</button>

          <button className="btn-blue" onClick={() =>
            promptEditList("Edit Phase 1 Criteria", ev.criteriaPhase1.map(c => c.name), (newList) => {
              const updated = newList.map((name) => ({ name, max: 10 }));
              updateEvent(idx, { ...ev, criteriaPhase1: updated });
            })
          }>📋 Edit Phase 1 Criteria</button>

          <button className="btn-blue" onClick={() =>
            promptEditList("Edit Phase 2 Criteria", ev.criteriaPhase2.map(c => c.name), (newList) => {
              const updated = newList.map((name) => ({ name, max: 10 }));
              updateEvent(idx, { ...ev, criteriaPhase2: updated });
            })
          }>📋 Edit Phase 2 Criteria</button>

          <button className="btn-purple" onClick={() => toggleVisibility(idx)}>
            {ev.visibleToJudges ? '🙈 Hide from Judges' : '👁️ Show to Judges'}
          </button>

          <button className="btn-purple" onClick={() => toggleResultsVisibility(idx)}>
            {ev.resultsVisibleToJudges ? '❌ Hide Results' : '📊 Show Results'}
          </button>

          <button className="btn-red" onClick={() => deleteEvent(idx)}>
            🗑️ Delete
          </button>
        </div>
      </div>
    );
  } else {
    return (
      <div key={idx} className="card">
        {renderOnePhasedEvent(ev, idx)}

        {/* Organizer controls for one-phased event */}
        <div className="flex-center" style={{ marginTop: '1em' }}>
          <button className="btn-blue" onClick={() =>
            promptEditList("Edit Participants", ev.participants, (newList) => {
              updateEvent(idx, { ...ev, participants: newList });
            })
          }>👥 Edit Participants</button>

          <button className="btn-blue" onClick={() =>
            promptEditList("Edit Judges", ev.judges, (newList) => {
              updateEvent(idx, { ...ev, judges: newList });
            })
          }>⚖️ Edit Judges</button>

          <button className="btn-blue" onClick={() =>
            promptEditList("Edit Criteria", ev.criteria.map(c => c.name || c), (newList) => {
              const updated = newList.map((name) => ({ name, max: 10 }));
              updateEvent(idx, { ...ev, criteria: updated });
            })
          }>📋 Edit Criteria</button>

          <button className="btn-purple" onClick={() => toggleVisibility(idx)}>
            {ev.visibleToJudges ? '🙈 Hide from Judges' : '👁️ Show to Judges'}
          </button>

          <button className="btn-purple" onClick={() => toggleResultsVisibility(idx)}>
            {ev.resultsVisibleToJudges ? '❌ Hide Results' : '📊 Show Results'}
          </button>

          <button className="btn-red" onClick={() => deleteEvent(idx)}>
            🗑️ Delete
          </button>
        </div>
      </div>
    );
  }
})}

                  </>
      )}
  
      {/* Hidden Watermark */}
      <div style={{ display: 'none' }}>
        {Array.from('JOHN CARL TABANAO ALCORIN')
          .map((char) => char.charCodeAt(0).toString(2))
          .join(' ')}
      </div>
    </div>
  );
} catch (err) {
  console.error("❌ Rendering error:", err);
  return <div style={{ padding: 20, color: 'red' }}>App crashed: {String(err)}</div>;
}
}
        