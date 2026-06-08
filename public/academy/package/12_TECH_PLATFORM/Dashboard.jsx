import { useState, useEffect, useRef, useCallback } from "react";

// ─── MOCK DATA (replace with Supabase calls in production) ─────────────────
const MOCK_USERS = {
  "usr_miles_001": {
    user_id: "usr_miles_001", username: "miles_goodbody",
    display_name: "Miles G.", role: "student", grade_level: 2,
    sport: "baseball", emoji: "⚾", color: "#4a9fd4",
    gbb_balance: 145, gbb_this_week: 45,
  },
  "usr_sabrina_002": {
    user_id: "usr_sabrina_002", username: "sabrina_goodbody",
    display_name: "Sabrina G.", role: "student", grade_level: 5,
    sport: "softball", emoji: "🥎", color: "#AD1457",
    gbb_balance: 210, gbb_this_week: 62,
  },
  "usr_zach_000": {
    user_id: "usr_zach_000", username: "zach_goodbody",
    display_name: "Dad (Admin)", role: "super_admin", grade_level: null,
    emoji: "👨‍🏫", color: "#e8491d",
    gbb_balance: null, gbb_this_week: null,
  },
};

const SUBJECTS = {
  "usr_miles_001": [
    { subject_id: "sub_MATH2", name: "Mathematics", icon: "🔢", color: "#4a9fd4", lessons: 5, completed: 2 },
    { subject_id: "sub_WRIT2", name: "Writing Workshop", icon: "✍️", color: "#e8491d", lessons: 5, completed: 1 },
    { subject_id: "sub_READ2", name: "Reading", icon: "📖", color: "#2E7D32", lessons: 3, completed: 0 },
    { subject_id: "sub_BASE", name: "Baseball", icon: "⚾", color: "#1565C0", lessons: 4, completed: 1 },
  ],
  "usr_sabrina_002": [
    { subject_id: "sub_MATH5", name: "Mathematics", icon: "🔢", color: "#4a9fd4", lessons: 5, completed: 3 },
    { subject_id: "sub_ELA5", name: "ELA & Reading", icon: "📚", color: "#6A1B9A", lessons: 4, completed: 1 },
    { subject_id: "sub_SCI5", name: "Science", icon: "🔬", color: "#00695C", lessons: 3, completed: 2 },
    { subject_id: "sub_SOFT", name: "Softball", icon: "🥎", color: "#AD1457", lessons: 4, completed: 0 },
  ],
};

const VIDEOS = {
  "sub_MATH2": [
    { video_id: "vid_placevalue1", youtube_id: "16aGiRRNJHg", title: "Place Value Song – Hundreds, Tens, Ones", duration: "3:00", gbb: 2, completed: true },
    { video_id: "vid_addto20", youtube_id: "CLhzuBhR5YM", title: "Adding Numbers to 20", duration: "4:00", gbb: 2, completed: false },
    { video_id: "vid_skipcounting", youtube_id: "r2TlTVrPECI", title: "Skip Counting by 2s, 5s, 10s", duration: "3:15", gbb: 2, completed: false },
  ],
  "sub_WRIT2": [
    { video_id: "vid_sentences1", youtube_id: "FDJTUimJH4o", title: "How to Write a Complete Sentence", duration: "5:00", gbb: 2, completed: false },
    { video_id: "vid_punctuation1", youtube_id: "iJ7n6Ys-RzM", title: "Punctuation – Periods, Question Marks", duration: "4:00", gbb: 2, completed: false },
    { video_id: "vid_storywriting", youtube_id: "b9Y3K7h-Dg4", title: "How to Write a Story – Beginning, Middle, End", duration: "6:00", gbb: 2, completed: false },
  ],
  "sub_MATH5": [
    { video_id: "vid_fractions1", youtube_id: "n0Y_ZDiGEAw", title: "Fractions – Add and Subtract", duration: "6:00", gbb: 2, completed: true },
    { video_id: "vid_decimals1", youtube_id: "nMGwzAhzWWs", title: "Decimals – Tenths and Hundredths", duration: "5:00", gbb: 2, completed: true },
    { video_id: "vid_longmult", youtube_id: "B8G7JGMf7p4", title: "Long Multiplication Step by Step", duration: "8:00", gbb: 2, completed: false },
  ],
  "sub_ELA5": [
    { video_id: "vid_5paragraph", youtube_id: "CGxBB0JGJ-I", title: "How to Write a 5-Paragraph Essay", duration: "9:00", gbb: 2, completed: false },
    { video_id: "vid_partsofsp", youtube_id: "R8plMpzpBT4", title: "Parts of Speech – Grammar Grade 5", duration: "6:00", gbb: 2, completed: false },
  ],
  "sub_SCI5": [
    { video_id: "vid_lifecycles", youtube_id: "gONBzCVTHHE", title: "Life Cycles – Plants and Animals", duration: "7:00", gbb: 2, completed: true },
    { video_id: "vid_watercycle", youtube_id: "al-do-HGuIk", title: "The Water Cycle – Complete", duration: "5:00", gbb: 2, completed: true },
  ],
  "sub_BASE": [
    { video_id: "vid_batting1", youtube_id: "KMFEMHWXUIs", title: "Baseball Hitting Mechanics for Kids", duration: "8:00", gbb: 3, completed: false },
    { video_id: "vid_fielding1", youtube_id: "pB5qSHe8L-8", title: "How to Field Ground Balls – Youth", duration: "6:00", gbb: 3, completed: false },
    { video_id: "vid_baserun1", youtube_id: "NN5aSi5K1zY", title: "Base Running Rules for Youth Baseball", duration: "7:00", gbb: 3, completed: false },
  ],
  "sub_SOFT": [
    { video_id: "vid_pitching1", youtube_id: "XWFOzPaS6Ng", title: "Softball Pitching – Windmill Motion for Kids", duration: "9:00", gbb: 3, completed: false },
    { video_id: "vid_sfbat1", youtube_id: "WOzQWMjBqyQ", title: "Softball Batting Mechanics", duration: "6:00", gbb: 3, completed: false },
  ],
};

const SPORTS_GOALS = {
  "usr_miles_001": [
    { goal_id: "goal_base_001", title: "Hit 5 line drives in a row off a tee", gbb: 15, status: "in_progress" },
    { goal_id: "goal_base_002", title: "Field 10 ground balls cleanly in a row", gbb: 15, status: "not_started" },
    { goal_id: "goal_base_003", title: "Accurate throws to first base (7/10)", gbb: 20, status: "not_started" },
    { goal_id: "goal_base_004", title: "Get a base hit in a real game", gbb: 25, status: "not_started" },
  ],
  "usr_sabrina_002": [
    { goal_id: "goal_soft_001", title: "Throw 10 accurate pitching strikes", gbb: 20, status: "achieved" },
    { goal_id: "goal_soft_002", title: "Learn and execute a change-up pitch", gbb: 20, status: "in_progress" },
    { goal_id: "goal_soft_003", title: "Sprint home from 3rd base under 5 seconds", gbb: 15, status: "not_started" },
    { goal_id: "goal_soft_004", title: "Get a hit in a real game", gbb: 25, status: "not_started" },
  ],
};

const GBB_HISTORY = {
  "usr_miles_001": [
    { gbb_id: "gbb_1", amount: 5, source_type: "lesson_complete", note: "Completed: Place Value", created_at: "2025-06-05" },
    { gbb_id: "gbb_2", amount: 2, source_type: "video_watched", note: "Watched: Place Value Song", created_at: "2025-06-05" },
    { gbb_id: "gbb_3", amount: 10, source_type: "writing_page", note: "Wrote full baseball story", created_at: "2025-06-04" },
    { gbb_id: "gbb_4", amount: 5, source_type: "lesson_complete", note: "Completed: Adding to 100", created_at: "2025-06-03" },
  ],
  "usr_sabrina_002": [
    { gbb_id: "gbb_5", amount: 20, source_type: "sports_goal_achieved", note: "Goal: 10 pitching strikes!", created_at: "2025-06-06" },
    { gbb_id: "gbb_6", amount: 5, source_type: "lesson_complete", note: "Completed: Fractions", created_at: "2025-06-05" },
    { gbb_id: "gbb_7", amount: 2, source_type: "video_watched", note: "Watched: Fractions video", created_at: "2025-06-05" },
    { gbb_id: "gbb_8", amount: 10, source_type: "teach_it_back", note: "Taught decimals back to Dad", created_at: "2025-06-04" },
  ],
};

// ─── STYLES ────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy: #1a2e44;
    --navy-mid: #24405e;
    --navy-light: #2d5278;
    --orange: #e8491d;
    --orange-light: #ff6b40;
    --sky: #4a9fd4;
    --sky-light: #6bbde8;
    --cream: #EAF4FB;
    --surface: #f4f8fc;
    --card: #ffffff;
    --border: #d8e8f4;
    --text: #1a2e44;
    --muted: #6b8caa;
    --success: #2E7D32;
    --purple: #6A1B9A;
    --pink: #AD1457;
    --gold: #F59E0B;
    --radius: 14px;
    --shadow: 0 2px 16px rgba(26,46,68,0.10);
    --shadow-lg: 0 8px 40px rgba(26,46,68,0.16);
  }

  body { font-family: 'Space Grotesk', sans-serif; background: var(--surface); color: var(--text); }

  .app { display: flex; min-height: 100vh; }

  /* SIDEBAR */
  .sidebar {
    width: 260px; min-height: 100vh; background: var(--navy);
    display: flex; flex-direction: column; position: fixed;
    left: 0; top: 0; bottom: 0; z-index: 100;
    border-right: 1px solid var(--navy-mid);
  }
  .sidebar-logo {
    padding: 24px 20px 20px;
    border-bottom: 1px solid var(--navy-mid);
  }
  .sidebar-logo h1 {
    font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800;
    color: white; letter-spacing: 0.5px; line-height: 1.3;
  }
  .sidebar-logo span { color: var(--orange); }
  .sidebar-logo p { font-size: 11px; color: var(--sky-light); margin-top: 4px; }

  .sidebar-users { padding: 16px 12px 8px; }
  .sidebar-users-label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; padding: 0 8px 8px; }
  .user-btn {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 10px 12px; border-radius: 10px;
    background: transparent; border: none; cursor: pointer;
    color: #cde; font-size: 13px; font-weight: 500;
    transition: all 0.15s; margin-bottom: 2px; text-align: left;
  }
  .user-btn:hover { background: var(--navy-mid); }
  .user-btn.active { background: var(--navy-light); color: white; }
  .user-avatar {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
  }
  .user-btn .user-info { flex: 1; min-width: 0; }
  .user-btn .user-name { font-size: 13px; font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .user-btn .user-meta { font-size: 10px; color: var(--sky); margin-top: 1px; }
  .user-btn.active .user-meta { color: var(--sky-light); }
  .role-badge {
    font-size: 9px; padding: 2px 6px; border-radius: 4px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .role-student { background: rgba(74,159,212,0.2); color: var(--sky-light); }
  .role-admin { background: rgba(232,73,29,0.2); color: var(--orange-light); }

  .sidebar-nav { padding: 12px; border-top: 1px solid var(--navy-mid); margin-top: auto; }
  .sidebar-nav-label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; padding: 0 8px 8px; }
  .nav-btn {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 9px 12px; border-radius: 8px;
    background: transparent; border: none; cursor: pointer;
    color: #aac; font-size: 13px; transition: all 0.15s;
    margin-bottom: 2px; text-align: left; font-family: inherit;
  }
  .nav-btn:hover { background: var(--navy-mid); color: white; }
  .nav-btn.active { background: rgba(232,73,29,0.15); color: var(--orange-light); }

  .gbb-sidebar {
    margin: 12px; padding: 12px 14px; border-radius: 10px;
    background: linear-gradient(135deg, #1a3a20 0%, #1a2e44 100%);
    border: 1px solid rgba(34,197,94,0.2);
  }
  .gbb-sidebar-label { font-size: 10px; color: #6ee7b7; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
  .gbb-sidebar-bal { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; color: #34d399; line-height: 1.1; margin-top: 2px; }
  .gbb-sidebar-sub { font-size: 11px; color: #6ee7b7; margin-top: 2px; }

  /* MAIN */
  .main { margin-left: 260px; flex: 1; min-height: 100vh; }

  .topbar {
    background: white; border-bottom: 1px solid var(--border);
    padding: 0 28px; height: 60px;
    display: flex; align-items: center; gap: 16px;
    position: sticky; top: 0; z-index: 50;
  }
  .topbar-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: var(--navy); flex: 1; }
  .topbar-badge {
    display: flex; align-items: center; gap: 6px; padding: 6px 14px;
    background: var(--cream); border-radius: 20px; font-size: 13px; font-weight: 600; color: var(--navy);
  }
  .gbb-link-btn {
    padding: 7px 16px; background: var(--orange); color: white;
    border-radius: 8px; font-size: 12px; font-weight: 700; border: none; cursor: pointer;
    transition: opacity 0.15s; font-family: inherit; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .gbb-link-btn:hover { opacity: 0.88; }

  .content { padding: 28px; }

  /* HERO CARD */
  .hero-card {
    border-radius: var(--radius); padding: 28px 32px;
    margin-bottom: 24px; position: relative; overflow: hidden;
    display: flex; align-items: center; gap: 24px;
    box-shadow: var(--shadow-lg);
  }
  .hero-emoji { font-size: 64px; flex-shrink: 0; }
  .hero-text h2 { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; color: white; }
  .hero-text p { font-size: 14px; color: rgba(255,255,255,0.78); margin-top: 4px; }
  .hero-stats { margin-left: auto; display: flex; gap: 20px; flex-shrink: 0; }
  .hero-stat { text-align: center; }
  .hero-stat-num { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: white; line-height: 1; }
  .hero-stat-label { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }

  /* GRID */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  @media (max-width: 900px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }

  /* CARDS */
  .card {
    background: var(--card); border-radius: var(--radius);
    border: 1px solid var(--border); box-shadow: var(--shadow);
    overflow: hidden;
  }
  .card-header {
    padding: 16px 20px 14px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
  }
  .card-header h3 { font-size: 14px; font-weight: 700; color: var(--navy); flex: 1; }
  .card-header .count { font-size: 12px; color: var(--muted); }
  .card-body { padding: 16px 20px; }

  /* SUBJECT CARDS */
  .subject-card {
    background: var(--card); border-radius: var(--radius);
    border: 1px solid var(--border); overflow: hidden;
    cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow);
  }
  .subject-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .subject-card-top { padding: 20px; display: flex; align-items: center; gap: 14px; }
  .subject-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
  .subject-name { font-size: 15px; font-weight: 700; color: var(--navy); }
  .subject-progress-text { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .subject-card-bottom { padding: 0 20px 16px; }
  .progress-bar-wrap { background: var(--border); border-radius: 100px; height: 6px; }
  .progress-bar-fill { height: 6px; border-radius: 100px; transition: width 0.6s ease; }

  /* VIDEO CARDS */
  .video-section { margin-bottom: 24px; }
  .video-section-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: var(--navy); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .video-card {
    background: var(--card); border-radius: var(--radius);
    border: 1px solid var(--border); overflow: hidden;
    cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow);
    position: relative;
  }
  .video-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
  .video-card.watched { border-color: #6ee7b7; }
  .video-thumb-wrap { position: relative; aspect-ratio: 16/9; background: #0d1b2a; overflow: hidden; }
  .video-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
  .video-thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a2e44 0%, #0d1b2a 100%); }
  .play-overlay {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.35); transition: background 0.2s;
  }
  .video-card:hover .play-overlay { background: rgba(0,0,0,0.2); }
  .play-btn {
    width: 52px; height: 52px; border-radius: 50%;
    background: var(--orange); display: flex; align-items: center; justify-content: center;
    font-size: 20px; box-shadow: 0 4px 16px rgba(232,73,29,0.5);
    transition: transform 0.2s;
  }
  .video-card:hover .play-btn { transform: scale(1.1); }
  .video-watched-badge {
    position: absolute; top: 8px; right: 8px; padding: 4px 8px;
    background: #065f46; color: #6ee7b7; border-radius: 6px;
    font-size: 10px; font-weight: 700; text-transform: uppercase;
  }
  .video-info { padding: 12px 14px; }
  .video-title { font-size: 13px; font-weight: 600; color: var(--navy); line-height: 1.35; }
  .video-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .video-dur { font-size: 11px; color: var(--muted); }
  .gbb-chip {
    padding: 2px 8px; border-radius: 12px;
    background: #fef3c7; color: #92400e;
    font-size: 10px; font-weight: 700;
  }
  .gbb-chip.earned { background: #d1fae5; color: #065f46; }

  /* VIDEO MODAL */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000;
    display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-box {
    background: var(--navy); border-radius: 16px; overflow: hidden;
    width: 100%; max-width: 800px; box-shadow: 0 24px 80px rgba(0,0,0,0.7);
    animation: slideUp 0.2s ease;
  }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-header { padding: 16px 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--navy-mid); }
  .modal-header h3 { color: white; font-size: 15px; font-weight: 700; flex: 1; }
  .modal-close {
    width: 32px; height: 32px; border-radius: 8px; background: var(--navy-mid);
    border: none; color: white; cursor: pointer; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
  }
  .modal-close:hover { background: var(--navy-light); }
  .video-embed-wrap { position: relative; padding-bottom: 56.25%; height: 0; background: #000; }
  .video-embed-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .modal-footer { padding: 14px 20px; display: flex; align-items: center; gap: 12px; }
  .modal-footer-text { color: rgba(255,255,255,0.7); font-size: 13px; flex: 1; }
  .award-btn {
    padding: 8px 18px; background: var(--orange); color: white;
    border-radius: 8px; border: none; cursor: pointer; font-weight: 700;
    font-size: 13px; font-family: inherit;
  }
  .award-btn:hover { opacity: 0.88; }
  .award-btn:disabled { opacity: 0.4; cursor: default; }
  .award-success { color: #34d399; font-weight: 700; font-size: 13px; }

  /* SPORTS GOALS */
  .goal-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 0; border-bottom: 1px solid var(--border);
  }
  .goal-row:last-child { border-bottom: none; }
  .goal-status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .dot-achieved { background: #34d399; }
  .dot-in-progress { background: var(--gold); }
  .dot-not-started { background: var(--border); }
  .goal-title { flex: 1; font-size: 13px; color: var(--text); line-height: 1.4; }
  .goal-gbb { font-size: 11px; font-weight: 700; color: var(--orange); white-space: nowrap; }
  .goal-status-label { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 5px; white-space: nowrap; }
  .status-achieved { background: #d1fae5; color: #065f46; }
  .status-in-progress { background: #fef3c7; color: #92400e; }
  .status-not-started { background: var(--cream); color: var(--muted); }

  /* GBB HISTORY */
  .gbb-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 0; border-bottom: 1px solid var(--border);
  }
  .gbb-row:last-child { border-bottom: none; }
  .gbb-amount { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; color: #34d399; width: 48px; flex-shrink: 0; }
  .gbb-note { flex: 1; font-size: 12px; color: var(--text); }
  .gbb-date { font-size: 11px; color: var(--muted); white-space: nowrap; }
  .source-badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; background: var(--cream); color: var(--navy); font-weight: 700; white-space: nowrap; }

  /* TOAST */
  .toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 2000;
    background: var(--navy); color: white; padding: 14px 20px;
    border-radius: 12px; box-shadow: var(--shadow-lg);
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; font-weight: 600;
    animation: slideUp 0.25s ease;
    border-left: 4px solid #34d399;
  }

  /* UTIL */
  .section-gap { margin-bottom: 24px; }
  .w-full { width: 100%; }
  .pill { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .admin-banner {
    background: linear-gradient(135deg, #1a2e44, #2d1a44);
    border: 1px solid rgba(173,20,87,0.3); border-radius: var(--radius);
    padding: 16px 20px; margin-bottom: 20px; color: white; font-size: 13px;
    display: flex; align-items: center; gap: 10px;
  }
`;

// ─── SOURCE LABEL ─────────────────────────────────────────────
const SOURCE_LABELS = {
  lesson_complete: "📚 Lesson",
  writing_page: "✍️ Writing",
  math_challenge: "🔢 Math",
  read_20_min: "📖 Reading",
  teach_it_back: "🎓 Teach Back",
  sports_goal_achieved: "🏆 Sports",
  project_milestone: "🔨 Project",
  help_sibling: "🤝 Helped",
  perfect_week: "⭐ Perfect Week",
  bonus_challenge: "🚀 Bonus",
  video_watched: "📺 Video",
  teacher_manual_award: "👨‍🏫 Dad",
};

// ─── VIDEO CARD ───────────────────────────────────────────────
function VideoCard({ video, onPlay }) {
  return (
    <div className={`video-card ${video.completed ? "watched" : ""}`} onClick={() => onPlay(video)}>
      <div className="video-thumb-wrap">
        <img
          className="video-thumb"
          src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
          alt={video.title}
          onError={e => { e.target.style.display = "none"; }}
        />
        <div className="play-overlay">
          <div className="play-btn">▶</div>
        </div>
        {video.completed && <div className="video-watched-badge">✓ Watched</div>}
      </div>
      <div className="video-info">
        <div className="video-title">{video.title}</div>
        <div className="video-meta">
          <span className="video-dur">⏱ {video.duration}</span>
          <span className={`gbb-chip ${video.completed ? "earned" : ""}`}>
            {video.completed ? "✓" : "+"}{video.gbb} GBB
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── VIDEO MODAL ──────────────────────────────────────────────
function VideoModal({ video, userId, onClose, onGBBAward }) {
  const [awarded, setAwarded] = useState(video.completed);

  const handleAward = () => {
    if (!awarded) {
      setAwarded(true);
      onGBBAward(video.video_id, video.gbb, video.title);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>📺</span>
          <h3>{video.title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="video-embed-wrap">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?rel=0&modestbranding=1&autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="modal-footer">
          <div className="modal-footer-text">
            {awarded
              ? <span className="award-success">✅ Watched! +{video.gbb} GBB earned</span>
              : <span style={{color:"rgba(255,255,255,0.6)"}}>Watch the full video to earn {video.gbb} GBB</span>
            }
          </div>
          <button className="award-btn" onClick={handleAward} disabled={awarded}>
            {awarded ? "✓ GBB Earned!" : `Mark Watched · +${video.gbb} GBB`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SUBJECT CARD ─────────────────────────────────────────────
function SubjectCard({ subject, onClick }) {
  const pct = subject.lessons > 0 ? Math.round((subject.completed / subject.lessons) * 100) : 0;
  return (
    <div className="subject-card" onClick={() => onClick(subject)}>
      <div className="subject-card-top">
        <div className="subject-icon" style={{ background: subject.color + "22" }}>
          {subject.icon}
        </div>
        <div>
          <div className="subject-name">{subject.name}</div>
          <div className="subject-progress-text">{subject.completed}/{subject.lessons} lessons</div>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: "Syne", fontWeight: 800, fontSize: 18, color: subject.color }}>
          {pct}%
        </div>
      </div>
      <div className="subject-card-bottom">
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: pct + "%", background: subject.color }} />
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [activeUserId, setActiveUserId] = useState("usr_miles_001");
  const [activeView, setActiveView] = useState("dashboard");
  const [activeSubject, setActiveSubject] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [toast, setToast] = useState(null);
  const [gbbBalances, setGbbBalances] = useState({ "usr_miles_001": 145, "usr_sabrina_002": 210 });

  const user = MOCK_USERS[activeUserId];
  const subjects = SUBJECTS[activeUserId] || [];
  const goals = SPORTS_GOALS[activeUserId] || [];
  const history = GBB_HISTORY[activeUserId] || [];
  const isAdmin = user.role === "super_admin";

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const handleGBBAward = (videoId, amount, title) => {
    setGbbBalances(prev => ({ ...prev, [activeUserId]: (prev[activeUserId] || 0) + amount }));
    showToast(`💰 +${amount} GBB awarded for watching "${title}"!`);
    // In production: call award_gbb() via Supabase + post to goodbodybucks.web.app
  };

  const heroGradient = isAdmin
    ? "linear-gradient(135deg, #1a2e44 0%, #2d1a44 100%)"
    : `linear-gradient(135deg, ${user.color}dd 0%, ${user.color}88 100%)`;

  const videosForSubject = activeSubject ? (VIDEOS[activeSubject.subject_id] || []) : [];
  const allVideos = subjects.flatMap(s => (VIDEOS[s.subject_id] || []).map(v => ({ ...v, subject: s })));

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>Goodbody<br /><span>Summer Academy</span></h1>
            <p>goodbodybucks.web.app</p>
          </div>
          <div className="sidebar-users">
            <div className="sidebar-users-label">Students</div>
            {Object.values(MOCK_USERS).map(u => (
              <button key={u.user_id} className={`user-btn ${activeUserId === u.user_id ? "active" : ""}`}
                onClick={() => { setActiveUserId(u.user_id); setActiveView("dashboard"); setActiveSubject(null); }}>
                <div className="user-avatar" style={{ background: u.color + "33" }}>{u.emoji}</div>
                <div className="user-info">
                  <div className="user-name">{u.display_name}</div>
                  <div className="user-meta">{u.username}</div>
                </div>
                <span className={`role-badge ${u.role === "student" ? "role-student" : "role-admin"}`}>
                  {u.role === "super_admin" ? "admin" : u.role}
                </span>
              </button>
            ))}
          </div>

          {!isAdmin && (
            <div className="gbb-sidebar">
              <div className="gbb-sidebar-label">💰 GBB Balance</div>
              <div className="gbb-sidebar-bal">{gbbBalances[activeUserId]}</div>
              <div className="gbb-sidebar-sub">This week: +{user.gbb_this_week}</div>
            </div>
          )}

          <div className="sidebar-nav">
            <div className="sidebar-nav-label">Navigate</div>
            {[
              { id: "dashboard", icon: "🏠", label: "Dashboard" },
              { id: "subjects", icon: "📚", label: "Subjects & Videos" },
              { id: "sports", icon: user.emoji || "🏆", label: "Sports Goals" },
              { id: "gbb", icon: "💰", label: "GBB History" },
            ].map(n => (
              <button key={n.id} className={`nav-btn ${activeView === n.id ? "active" : ""}`}
                onClick={() => { setActiveView(n.id); setActiveSubject(null); }}>
                {n.icon} {n.label}
              </button>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main">
          <div className="topbar">
            <div className="topbar-title">
              {activeView === "dashboard" && "Dashboard"}
              {activeView === "subjects" && (activeSubject ? activeSubject.name : "Subjects & Videos")}
              {activeView === "sports" && "Sports Goals"}
              {activeView === "gbb" && "GBB History"}
            </div>
            {!isAdmin && (
              <div className="topbar-badge">
                💰 <strong>{gbbBalances[activeUserId]}</strong> GBB
              </div>
            )}
            <button className="gbb-link-btn"
              onClick={() => window.open("https://goodbodybucks.web.app", "_blank")}>
              Open GBB App ↗
            </button>
          </div>

          <div className="content">
            {isAdmin && (
              <div className="admin-banner">
                🔧 <strong>Admin View (Zach)</strong> — Select a student from the sidebar to view their dashboard.
                You have full access to all data. RLS bypassed for role: super_admin.
              </div>
            )}

            {/* ─── DASHBOARD ─── */}
            {activeView === "dashboard" && !isAdmin && (
              <>
                <div className="hero-card" style={{ background: heroGradient }}>
                  <div className="hero-emoji">{user.emoji}</div>
                  <div className="hero-text">
                    <h2>{user.display_name}'s Dashboard</h2>
                    <p>Grade {user.grade_level} · {user.username} · {user.sport}</p>
                  </div>
                  <div className="hero-stats">
                    <div className="hero-stat">
                      <div className="hero-stat-num">{gbbBalances[activeUserId]}</div>
                      <div className="hero-stat-label">GBB Balance</div>
                    </div>
                    <div className="hero-stat">
                      <div className="hero-stat-num">{subjects.reduce((a, s) => a + s.completed, 0)}</div>
                      <div className="hero-stat-label">Lessons Done</div>
                    </div>
                    <div className="hero-stat">
                      <div className="hero-stat-num">{goals.filter(g => g.status === "achieved").length}</div>
                      <div className="hero-stat-label">Goals Achieved</div>
                    </div>
                  </div>
                </div>

                <div className="section-gap">
                  <div className="card-header" style={{ paddingLeft: 0, borderBottom: "none" }}>
                    <h3 style={{ fontSize: 16 }}>📚 My Subjects</h3>
                  </div>
                  <div className="grid-2">
                    {subjects.map(s => (
                      <SubjectCard key={s.subject_id} subject={s}
                        onClick={subj => { setActiveSubject(subj); setActiveView("subjects"); }} />
                    ))}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="card">
                    <div className="card-header">
                      <span>{user.emoji}</span>
                      <h3>Sports Goals</h3>
                      <span className="count">{goals.filter(g => g.status === "achieved").length}/{goals.length} done</span>
                    </div>
                    <div className="card-body">
                      {goals.slice(0, 3).map(g => (
                        <div key={g.goal_id} className="goal-row">
                          <div className={`goal-status-dot dot-${g.status.replace("_", "-")}`} />
                          <div className="goal-title">{g.title}</div>
                          <div className="goal-gbb">+{g.gbb}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <span>💰</span>
                      <h3>Recent GBB Earnings</h3>
                    </div>
                    <div className="card-body">
                      {history.map(h => (
                        <div key={h.gbb_id} className="gbb-row">
                          <div className="gbb-amount">+{h.amount}</div>
                          <div className="gbb-note">
                            <div>{h.note}</div>
                            <span className="source-badge">{SOURCE_LABELS[h.source_type] || h.source_type}</span>
                          </div>
                          <div className="gbb-date">{h.created_at}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ─── SUBJECTS & VIDEOS ─── */}
            {activeView === "subjects" && !isAdmin && (
              <>
                {!activeSubject ? (
                  <>
                    <div className="grid-2 section-gap">
                      {subjects.map(s => (
                        <SubjectCard key={s.subject_id} subject={s} onClick={setActiveSubject} />
                      ))}
                    </div>
                    <div className="video-section">
                      <div className="video-section-title">📺 All Videos</div>
                      <div className="video-grid">
                        {allVideos.map(v => (
                          <VideoCard key={v.video_id} video={v} onPlay={setPlayingVideo} />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <button style={{ background: "none", border: "none", color: "var(--sky)", cursor: "pointer", fontSize: 14, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
                      onClick={() => setActiveSubject(null)}>
                      ← Back to all subjects
                    </button>
                    <div className="hero-card" style={{ background: `linear-gradient(135deg, ${activeSubject.color}cc, ${activeSubject.color}66)`, marginBottom: 24 }}>
                      <div className="hero-emoji">{activeSubject.icon}</div>
                      <div className="hero-text">
                        <h2>{activeSubject.name}</h2>
                        <p>{activeSubject.completed}/{activeSubject.lessons} lessons completed · {videosForSubject.length} videos</p>
                      </div>
                    </div>
                    <div className="video-section">
                      <div className="video-section-title">📺 Video Library</div>
                      {videosForSubject.length > 0 ? (
                        <div className="video-grid">
                          {videosForSubject.map(v => (
                            <VideoCard key={v.video_id} video={v} onPlay={setPlayingVideo} />
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: "var(--muted)", fontSize: 14, padding: "20px 0" }}>No videos yet for this subject.</div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ─── SPORTS GOALS ─── */}
            {activeView === "sports" && !isAdmin && (
              <>
                <div className="hero-card" style={{ background: `linear-gradient(135deg, #1565C0dd, #1565C088)`, marginBottom: 24 }}>
                  <div className="hero-emoji">{user.emoji}</div>
                  <div className="hero-text">
                    <h2>{user.sport === "baseball" ? "Baseball" : "Softball"} Goals</h2>
                    <p>{goals.filter(g => g.status === "achieved").length} achieved · {goals.filter(g => g.status === "in_progress").length} in progress</p>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header"><h3>Summer Goal Checklist</h3></div>
                  <div className="card-body">
                    {goals.map(g => (
                      <div key={g.goal_id} className="goal-row">
                        <div className={`goal-status-dot dot-${g.status.replace(/_/g, "-")}`} />
                        <div className="goal-title">{g.title}</div>
                        <span className={`goal-status-label status-${g.status.replace(/_/g, "-")}`}>
                          {g.status === "achieved" ? "✓ Done" : g.status === "in_progress" ? "Working on it" : "Not started"}
                        </span>
                        <div className="goal-gbb">+{g.gbb} GBB</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ─── GBB HISTORY ─── */}
            {activeView === "gbb" && !isAdmin && (
              <>
                <div className="grid-2 section-gap">
                  {[["💰 Total Balance", gbbBalances[activeUserId], "#34d399"], ["📅 This Week", user.gbb_this_week, "#60a5fa"]].map(([label, val, color]) => (
                    <div key={label} className="card" style={{ padding: "20px 24px" }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                      <div style={{ fontFamily: "Syne", fontSize: 36, fontWeight: 800, color, marginTop: 4 }}>{val}</div>
                      <button className="gbb-link-btn" style={{ marginTop: 12, fontSize: 11 }}
                        onClick={() => window.open("https://goodbodybucks.web.app", "_blank")}>
                        View in App ↗
                      </button>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div className="card-header"><h3>Transaction History</h3></div>
                  <div className="card-body">
                    {history.map(h => (
                      <div key={h.gbb_id} className="gbb-row">
                        <div className="gbb-amount">+{h.amount}</div>
                        <div className="gbb-note">
                          <div style={{ fontWeight: 600 }}>{h.note}</div>
                          <span className="source-badge">{SOURCE_LABELS[h.source_type]}</span>
                        </div>
                        <div className="gbb-date">{h.created_at}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        {/* VIDEO MODAL */}
        {playingVideo && (
          <VideoModal
            video={playingVideo}
            userId={activeUserId}
            onClose={() => setPlayingVideo(null)}
            onGBBAward={handleGBBAward}
          />
        )}

        {/* TOAST */}
        {toast && <div className="toast">🎉 {toast}</div>}
      </div>
    </>
  );
}
