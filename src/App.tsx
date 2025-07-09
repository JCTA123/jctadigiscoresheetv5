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
        criteria: [{ name: 'Creativity', max: 10 }],
        scores: {},
        visibleToJudges: false,
        resultsVisibleToJudges: false, // ✅ NEW FIELD
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

  const calcTotalForJudge = (ev, judge, participant) => {
    const scores = ev.scores?.[judge]?.[participant] || {};
    return Object.values(scores).reduce((a, b) => a + Number(b || 0), 0);
  };

  const calcTotalAllJudges = (ev, participant) => {
    return ev.judges.reduce(
      (sum, judge) => sum + calcTotalForJudge(ev, judge, participant),
      0
    );
  };

  const calcAvg = (ev, participant) => {
    return (calcTotalAllJudges(ev, participant) / ev.judges.length).toFixed(2);
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
      alert("✅ Logged in successfully.");
      setViewMode('intro');        // ✅ GO TO judge/organizer menu
    } catch (err) {
      alert("❌ Login failed: " + err.message);
    }
  };
  
  const registerWithEmail = async () => {
    const email = prompt("Enter new email:");
    const password = prompt("Enter new password (min 6 chars):");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("✅ Registered successfully. You're now logged in.");
      setRequireFreshLogin(false); // (if applicable)
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

  if (viewMode === 'judge' && !currentJudge) {
    return (
      <div className="intro-screen">
        <h2>Judge Login</h2>
        <input
          placeholder="Enter code"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
        />
        <input
          placeholder="Enter your name"
          value={pendingJudgeName}
          onChange={(e) => setPendingJudgeName(e.target.value)}
        />
        <br />
        <button className="btn-green" onClick={handleJudgeLogin}>
          Login
        </button>
        <button className="btn-gray" onClick={() => setViewMode('intro')}>
          🔙 Back
        </button>
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
    setOrganizerView(false); // 👈 ADD THIS LINE TOO
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
      <p className="text-center">📭 No events yet. Click "➕ Add Event" to begin.</p>
    ) : (
      events.map((ev, idx) => {
        const safeCriteria = ev.criteria.map(c =>
          typeof c === 'string' ? { name: c, max: 10 } : c
        );
        return (
          <div key={idx} className="card">
            <div className="flex-center">
              <h2>{ev.name}</h2>
              <button
                onClick={() => toggleVisibility(idx)}
                className={ev.visibleToJudges ? 'btn-red' : 'btn-green'}
              >
                {ev.visibleToJudges ? 'Hide from Judges' : 'Show to Judges'}
              </button>
              <button onClick={() => deleteEvent(idx)} className="btn-red">
                ❌ Delete
              </button>
            </div>

            <div className="flex-center">
              <button
                className="btn-purple"
                onClick={() =>
                  promptEditList('Edit Participants', ev.participants, (newList) =>
                    updateEvent(idx, { ...ev, participants: newList })
                  )
                }
              >
                👥 Participants
              </button>
              <button
                className="btn-yellow"
                onClick={() =>
                  promptEditList('Edit Judges', ev.judges, (newList) =>
                    updateEvent(idx, { ...ev, judges: newList })
                  )
                }
              >
                🧑‍⚖️ Judges
              </button>
              <button
                className="btn-blue"
                onClick={() =>
                  promptEditList(
                    'Edit Criteria (use format: Creativity (10))',
                    ev.criteria.map(c => typeof c === 'string' ? c : `${c.name} (${c.max})`),
                    (newList) =>
                      updateEvent(idx, {
                        ...ev,
                        criteria: newList.map((entry) => {
                          const match = entry.match(/(.+?)\s*\((\d+)\)/);
                          if (match) {
                            return { name: match[1].trim(), max: parseInt(match[2]) };
                          }
                          return { name: entry.trim(), max: 10 };
                        }),
                      })
                  )
                }
              >
                📋 Criteria
              </button>
              <button
                className="btn-gray"
                onClick={() => toggleResultsVisibility(idx)}
              >
                {ev.resultsVisibleToJudges
                  ? '🙈 Hide Results from Judges'
                  : '👁️ Show Results to Judges'}
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Participant</th>
                  {ev.judges.map((j, jdx) => (
                    <th key={jdx}>{j}</th>
                  ))}
                  <th>Total</th>
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                {ev.participants.map((p, pdx) => (
                  <tr key={pdx}>
                    <td>{p}</td>
                    {ev.judges.map((j, jdx) => (
                      <td key={jdx}>{calcTotalForJudge(ev, j, p)}</td>
                    ))}
                    <td>{calcTotalAllJudges(ev, p)}</td>
                    <td>{calcAvg(ev, p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {ev.resultsVisibleToJudges && renderSummary(ev)}
          </div>
        );
      })
    )}
  </>
) : (

      <>
{viewMode === 'organizer' && organizerView && (
  <div className="flex-center">
    <button onClick={refreshAllData} className="btn-gray">
      🔄 Refresh Data
    </button>
  </div>
)}

        <div className="top-bar">
  <h1>🎯 Digital Scoresheet App</h1>
  <p className="text-center credits">made by JCTA</p>

  <div className="flex-center">
    {organizerView && (
      <>
        <button className="btn-yellow" onClick={generateJudgeCode}>
          🎫 Generate Judge Code
        </button>
        <button className="btn-blue" onClick={changeOrganizerPassword}>
          🔐 Change Password
        </button>
        <button className="btn-green" onClick={createNewEvent}>
          ➕ Add Event
        </button>
        <button className="btn-purple" onClick={handleImport}>
          📥 Import
        </button>
        <button className="btn-purple" onClick={handleExport}>
          📤 Export ▼
        </button>
        <button
  className="btn-gray"
  onClick={() => {
    setOrganizerView(false); // 👈 ADD THIS LINE TOO
    setViewMode('judge');
  }}
>
  👨‍⚖️ Switch to Judge View
</button>

              </>
    )}

    <button className="btn-gray" onClick={refreshAllData}>
      🔄 Refresh Data
    </button>

    <button className="btn-red" onClick={handleAuthLogout}>
      🚪 Logout
    </button>
  </div>

  {organizerView && (
    <div className="card">
      <h3>Active Judge Codes:</h3>
      <ul>
        {judgeCodes.map((code, i) => (
          <li key={i}>{code}</li>
        ))}
      </ul>
    </div>
  )}
</div>
        {events.map((ev, idx) => {
          const isJudgeAllowed = ev.judges
            .map((j) => j.toLowerCase())
            .includes(currentJudge.trim().toLowerCase());

          if (!ev.visibleToJudges || !isJudgeAllowed) return null;

          const safeCriteria = ev.criteria.map((c) => {
            if (typeof c === 'string') {
              const match = c.match(/^(.*?)(?:\s*\((\d+)\))?$/);
              return {
                name: match?.[1]?.trim() || c,
                max: match?.[2] ? parseInt(match[2]) : 10,
              };
            }
            return c;
          });

          return (
            <div key={idx} className="card">
              <h2>{ev.name}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Participant</th>
                    {safeCriteria.map((c, cdx) => (
                      <th key={cdx}>
                        {c.name} ({c.max})
                      </th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ev.participants.map((p, pdx) => (
                    <tr key={pdx}>
                      <td>{p}</td>
                      {safeCriteria.map((c, cdx) => (
                        <td key={cdx}>
                          <input
                            type="number"
                            min={0}
                            max={c.max}
                            value={
                              tempScores?.[idx]?.[p]?.[c.name] ??
                              ev.scores?.[currentJudge]?.[p]?.[c.name] ??
                              ''
                            }
                            disabled={ev.submittedJudges?.includes(currentJudge)}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              if (Number(newVal) <= c.max) {
                                setTempScores((prev) => ({
                                  ...prev,
                                  [idx]: {
                                    ...(prev[idx] || {}),
                                    [p]: {
                                      ...(prev[idx]?.[p] || {}),
                                      [c.name]: newVal,
                                    },
                                  },
                                }));
                              }
                            }}
                            onBlur={(e) => {
                              const val = tempScores?.[idx]?.[p]?.[c.name];
                              if (val !== undefined && val !== '') {
                                handleInputScore(
                                  idx,
                                  currentJudge,
                                  p,
                                  c.name,
                                  Number(val)
                                );
                              }
                            }}
                          />
                        </td>
                      ))}
                      <td>{calcTotalForJudge(ev, currentJudge, p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!ev.submittedJudges?.includes(currentJudge) ? (
                <button
                  className="btn-green"
                  onClick={() => handleSubmitScores(idx)}
                >
                  Submit Scores
                </button>
              ) : (
                <>
                  <p className="submitted-label">
                    Submitted. You can view but not change scores.
                  </p>
                  {ev.resultsVisibleToJudges && renderSummary(ev)}
                </>
              )}
            </div>
          );
        })}
      </>
    )}

    {/* Watermark */}
    <div style={{ display: 'none' }}>
      {Array.from('JOHN CARL TABANAO ALCORIN')
        .map((char) => char.charCodeAt(0).toString(2))
        .join(' ')}
    </div>
  </div> // <-- closes .app-container
);       // <-- closes the return

const promptEditList = (title, list, callback) => {
  const input = prompt(`${title} (comma separated):`, list.join(', '));
  if (input != null) {
    const newList = input.split(',').map((s) => s.trim()).filter(Boolean);
    callback(newList);
  }
};
  }