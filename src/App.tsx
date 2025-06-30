import React, { useEffect, useState, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import './App.css';

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

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
  const [orgPasswordInput, setOrgPasswordInput] = useState('');
  const [organizerPassword, setOrganizerPassword] = useState(DEFAULT_PASSWORD);
  const [pendingJudgeName, setPendingJudgeName] = useState('');
  const [judgeCodes, setJudgeCodes] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [tempScores, setTempScores] = useState({});

  const chatRef = useRef(null);

  useEffect(() => {
    const eventsRef = ref(db, 'events');
    const chatMessagesRef = ref(db, 'chatMessages');
    const codesRef = ref(db, 'judgeCodes');
    const passRef = ref(db, 'organizerPassword');
  
    onValue(eventsRef, (snapshot) => {
      const val = snapshot.val();
      setEvents(val || []); // ← Fallback to empty array
    });
  
    onValue(chatMessagesRef, (snapshot) => {
      const val = snapshot.val();
      setChatMessages(val || []);
    });
      
    onValue(codesRef, (snapshot) => {
      const val = snapshot.val();
      const codeList = val ? Object.values(val) : [];
      setJudgeCodes(codeList);
    });
      
    onValue(passRef, (snapshot) => {
      const val = snapshot.val();
      setOrganizerPassword(val || DEFAULT_PASSWORD); // ← Default fallback
    });
  }, []);
  
  useEffect(() => {
    const savedView = localStorage.getItem('viewMode');
    const savedJudge = localStorage.getItem('currentJudge');
    const savedOrganizer = localStorage.getItem('organizerView');
  
    if (savedView) setViewMode(savedView as 'intro' | 'judge' | 'organizer');
    if (savedJudge) setCurrentJudge(savedJudge);
    if (savedOrganizer === 'true') setOrganizerView(true);
  }, []);

  const updateFirebase = (key: string, data: any) => {
    set(ref(db, key), data);
  };

  const createNewEvent = () => {
    const name = prompt('Enter event name:');
    if (!name) return;
    const newEvents = [
      ...events,
      {
        name,
        participants: ['Alice', 'Bob'],
        judges: ['Judge 1'],
        criteria: ['Creativity'],
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
    updateEvent(idx, { ...ev, visibleToJudges: !ev.visibleToJudges });
  };

  const toggleResultsVisibility = (idx) => {
    const ev = events[idx];
    const updated = {
      ...ev,
      resultsVisibleToJudges: !ev.resultsVisibleToJudges,
    };
    updateEvent(idx, updated);
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
  
    // Convert array to object for Firebase storage
    const codeObj = updatedCodes.reduce((acc, val, idx) => {
      acc[idx] = val;
      return acc;
    }, {} as Record<string, string>);
  
    updateFirebase('judgeCodes', codeObj);
    setJudgeCodes(updatedCodes); // ✅ Also update local state
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
    const input = prompt('Paste your exported JSON here:');
    if (input) {
      try {
        const parsed = JSON.parse(input);
        updateFirebase('events', parsed.events || []);
        updateFirebase('chatMessages', parsed.chatMessages || []);
        updateFirebase('judgeCodes', parsed.judgeCodes || []);
        updateFirebase(
          'organizerPassword',
          parsed.organizerPassword || DEFAULT_PASSWORD
        );
        alert('Data imported and synced to Firebase.');
      } catch {
        alert('Invalid data.');
      }
    }
  };

  const handleExport = () => {
    const exportData = {
      events,
      chatMessages,
      judgeCodes,
      organizerPassword,
    };
    navigator.clipboard.writeText(JSON.stringify(exportData));
    alert('Data copied to clipboard.');
  };
  const handleLogout = () => {
    localStorage.clear();
    setCurrentJudge('');
    setOrganizerView(false);
    setViewMode('intro');
  };
  const refreshAllData = () => {
    onValue(ref(db, 'events'), (snapshot) => {
      setEvents(snapshot.val() || []);
    }, { onlyOnce: true });
  
    onValue(ref(db, 'chatMessages'), (snapshot) => {
      setChatMessages(snapshot.val() || []);
    }, { onlyOnce: true });
  
    onValue(ref(db, 'judgeCodes'), (snapshot) => {
      setJudgeCodes(snapshot.val() || []);
    }, { onlyOnce: true });
  
    onValue(ref(db, 'organizerPassword'), (snapshot) => {
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
            onClick={() => setViewMode('organizer')}
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
      <h1 className="text-center">
        🎯 Digital Scoresheet App
        <br />
        <small className="credits">made by JCTA</small>
      </h1>
      {(organizerView || currentJudge) && (
  <div className="flex-center">
    <button className="btn-gray" onClick={handleLogout}>🚪 Logout</button>
  </div>
)}

      {organizerView && (
        <div className="flex-center">
          <button onClick={refreshAllData} className="btn-gray">
  🔄 Refresh Data
</button>
          <button
            onClick={() => setOrganizerView(!organizerView)}
            className="btn-blue"
          >
            Switch to {organizerView ? 'Judge' : 'Organizer'} View
          </button>
          <button onClick={createNewEvent} className="btn-green">
            ➕ Add Event
          </button>
          <button onClick={handleImport} className="btn-yellow">
            📥 Import
          </button>
          <div className="dropdown-export">
            <button className="btn-purple">📤 Export ▼</button>
            <div className="dropdown-content">
              <button onClick={handleExport}>📋 Backup JSON</button>
              <button onClick={exportOverallSummaryPDF}>
                🏆 Export Overall Rankings PDF
              </button>
              <button onClick={exportPerJudgePDF}>
                🧑‍⚖️ Export Per-Judge Results PDF
              </button>
              <button onClick={exportSpecificEventPDF}>
                📄 Export Specific Event PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {organizerView && (
        <div className="organizer-controls">
          <button onClick={generateJudgeCode} className="btn-blue">
            🎫 Generate Judge Code
          </button>
          <button onClick={changeOrganizerPassword} className="btn-red">
            🔐 Change Password
          </button>
          <div className="codes-list">
            <h4>Active Judge Codes:</h4>
            <ul>
              {judgeCodes.map((code, idx) => (
                <li key={idx}>
                  {code}{' '}
                  <button
                    className="btn-red"
                    style={{ padding: '2px 6px', marginLeft: '8px' }}
                    onClick={() => {
                      const updated = judgeCodes.filter((_, i) => i !== idx);
                      updateFirebase('judgeCodes', updated);
                    }}
                  >
                    ❌
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Chat Section */}
      <div className="chat-toggle" onClick={() => setChatOpen(!chatOpen)}>
        💬 Chat {chatOpen ? '▲' : '▼'}
      </div>
      {chatOpen && (
        <div className="chat-box" ref={chatRef}>
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-message ${
                msg.sender === 'Organizer' ? 'organizer' : 'judge'
              }`}
            >
              <strong>{msg.sender}:</strong> {msg.text}
            </div>
          ))}
          <div className="chat-input">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type message..."
            />
            <button onClick={handleSendMessage}>Send</button>
          </div>
        </div>
      )}
      {organizerView ? (
        <>
          {events.map((ev, idx) => (
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
                    promptEditList(
                      'Edit Participants',
                      ev.participants,
                      (newList) =>
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
                    promptEditList('Edit Criteria', ev.criteria, (newList) =>
                      updateEvent(idx, { ...ev, criteria: newList })
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
          ))}
        </>
      ) : (
        <>
  <div className="flex-center">
    <button onClick={refreshAllData} className="btn-gray">
      🔄 Refresh Data
    </button>
  </div>
          {events.map(
            (ev, idx) =>
              ev.visibleToJudges &&
              ev.judges
                .map((j) => j.toLowerCase())
                .includes(currentJudge.trim().toLowerCase()) && (
                <div key={idx} className="card">
                  <h2>{ev.name}</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Participant</th>
                        {ev.criteria.map((c, cdx) => (
                          <th key={cdx}>{c}</th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.participants.map((p, pdx) => (
                        <tr key={pdx}>
                          <td>{p}</td>
                          {ev.criteria.map((c, cdx) => (
                            <td key={cdx}>
                              <input
                                type="number"
                                value={
                                  tempScores?.[idx]?.[p]?.[c] ??
                                  ev.scores?.[currentJudge]?.[p]?.[c] ??
                                  ''
                                }
                                disabled={ev.submittedJudges?.includes(
                                  currentJudge
                                )}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setTempScores((prev) => ({
                                    ...prev,
                                    [idx]: {
                                      ...(prev[idx] || {}),
                                      [p]: {
                                        ...(prev[idx]?.[p] || {}),
                                        [c]: newVal,
                                      },
                                    },
                                  }));
                                }}
                                onBlur={(e) => {
                                  const val = tempScores?.[idx]?.[p]?.[c];
                                  if (val !== undefined && val !== '') {
                                    handleInputScore(
                                      idx,
                                      currentJudge,
                                      p,
                                      c,
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
              )
          )}
        </>
      )}

      {/* Watermark - binary-encoded signature */}
      <div style={{ display: 'none' }}>
        {Array.from('JOHN CARL TABANAO ALCORIN ')
          .map((char) => char.charCodeAt(0).toString(2))
          .join(' ')}
      </div>
    </div>
  );
}

// Utility function: editable list prompt
function promptEditList(
  title: string,
  oldList: string[],
  callback: (newList: string[]) => void
) {
  const input = prompt(`${title} (comma-separated):`, oldList.join(', '));
  if (input !== null) {
    const newList = input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    callback(newList);
  }
}