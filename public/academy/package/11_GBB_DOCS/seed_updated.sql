-- ============================================================
-- GOODBODY SUMMER ACADEMY — UPDATED SEED DATA
-- Uses REAL data from goodbodybucks.web.app
-- Real allotment: { "Miles": 12, "Sabrina": 15 }
-- Real avatars, real image URLs, real app structure
-- ============================================================

-- ─── USERS (matching real GBB family names) ──────────────────
SELECT create_academy_user('zach_goodbody',   'Zach (Dad)',   'zach@goodbody.family',   'super_admin', NULL, '{"gbb_username": "admin", "avatar": "👨"}');
SELECT create_academy_user('miles_goodbody',  'Miles',        'miles@goodbody.family',  'student',     2,    '{"gbb_username": "Miles",   "gbb_daily_allotment": 12, "avatar": "👦", "sport": "baseball", "focus": "writing"}');
SELECT create_academy_user('sabrina_goodbody','Sabrina',      'sabrina@goodbody.family','student',     5,    '{"gbb_username": "Sabrina", "gbb_daily_allotment": 15, "avatar": "👧", "sport": "softball", "focus": "all-around"}');

-- NOTE: GBB daily allotment JSON (exact from live app):
-- { "Miles": 12, "Sabrina": 15 }
-- Applied each morning via: Admin Controls → Daily Allotment → Apply

-- ─── GBB ASSET REFERENCES ────────────────────────────────────
-- Store image URLs for use in UI components
CREATE TABLE IF NOT EXISTS gbb_assets (
  asset_id    VARCHAR(50) PRIMARY KEY,
  asset_type  VARCHAR(30) NOT NULL,   -- 'coin', 'menu', 'legacy', 'consequence'
  url         TEXT NOT NULL,
  description TEXT,
  used_in     TEXT[]
);

INSERT INTO gbb_assets (asset_id, asset_type, url, description, used_in) VALUES
('img_coin_nav',    'coin',        'https://goodbodybucks.web.app/images/gbucks-coin-nav.png',                    'GB$ coin — small/nav size',             ARRAY['header', 'badges', 'navigation']),
('img_coin_full',   'coin',        'https://goodbodybucks.web.app/images/gbucks-coin.png',                       'GB$ coin — full/hero size',             ARRAY['hero', 'wallet_display', 'rewards']),
('img_food',        'menu',        'https://goodbodybucks.web.app/images/food/food_menu.png',                    'Food menu with GB$ prices',             ARRAY['kid_dashboard', 'admin_reference']),
('img_gaming',      'menu',        'https://goodbodybucks.web.app/images/tablet_time/gaming_menu.png',           'Screen time / gaming packages menu',    ARRAY['kid_dashboard', 'admin_reference']),
('img_learning',    'menu',        'https://goodbodybucks.web.app/images/learning/learning_menu.png',            'Learning rewards / earning menu',       ARRAY['kid_dashboard', 'admin_reference', 'lesson_pages']),
('img_wallet',      'menu',        'https://goodbodybucks.web.app/images/wallet/wallet_menu.png',                'Kid wallet balance view',               ARRAY['wallet_component', 'dashboard']),
('img_cons_time',   'consequence', 'https://goodbodybucks.web.app/images/consequences/consequences_menu_time.png',  'Time consequences menu',            ARRAY['admin_panel', 'parent_controls']),
('img_cons_money',  'consequence', 'https://goodbodybucks.web.app/images/consequences/consequences_menu_money.png', 'Money consequences menu',           ARRAY['admin_panel', 'parent_controls']),
('img_legacy',      'legacy',      'https://goodbodybucks.web.app/images/legacy/goodbody_legacy_schedule.JPG',   'Original hand-drawn 9-kid schedule',    ARRAY['about_page', 'legacy_section']);

-- ─── GBB REWARD SCHEDULE (calibrated to real allotment) ──────
-- Miles earns GB$12/day base allotment. Summer Academy rewards ADD to this.
-- Sabrina earns GB$15/day base allotment.
INSERT INTO gbb_reward_schedule (event_type, amount, daily_cap, notes) VALUES
('lesson_complete',      5,  3, 'Core lesson via slide deck'),
('writing_page',        10,  2, 'Original writing, full page'),
('math_challenge',       5,  5, 'Must show work'),
('read_20_min',          3,  1, 'Any book'),
('teach_it_back',       10,  2, 'Must explain clearly to Dad'),
('sports_goal_achieved',20,  3, 'Dad verifies; see sports_goals table'),
('project_milestone',   20,  1, 'Per milestone, max 2 per project'),
('help_sibling',        10,  1, 'Genuine help, Dad confirms'),
('perfect_week',        25,  1, 'All 4 school days completed'),
('bonus_challenge',      8,  2, 'Bonus slide in lesson deck'),
('video_watched',        2,  5, '80%+ completion via YouTube API')
ON CONFLICT DO NOTHING;

-- ─── SUBJECTS ────────────────────────────────────────────────
INSERT INTO subjects (subject_id, code, name, grade_levels, color_hex, icon, sort_order) VALUES
('sub_MATH2',  'MATH2',  'Mathematics',       '{2}',   '#4a9fd4', '🔢', 1),
('sub_WRIT2',  'WRIT2',  'Writing Workshop',  '{2}',   '#e8491d', '✍️',  2),
('sub_READ2',  'READ2',  'Reading',           '{2}',   '#2E7D32', '📖', 3),
('sub_MATH5',  'MATH5',  'Mathematics',       '{5}',   '#4a9fd4', '🔢', 1),
('sub_ELA5',   'ELA5',   'ELA & Reading',     '{5}',   '#6A1B9A', '📚', 2),
('sub_SCI5',   'SCI5',   'Science',           '{5}',   '#00695C', '🔬', 3),
('sub_SOC5',   'SOC5',   'Social Studies',    '{5}',   '#5D4037', '🌍', 4),
('sub_BASE',   'BASE',   'Baseball',          '{2,5}', '#1565C0', '⚾', 5),
('sub_SOFT',   'SOFT',   'Softball',          '{5}',   '#AD1457', '🥎', 5)
ON CONFLICT DO NOTHING;

-- ─── VIDEO LIBRARY ───────────────────────────────────────────
INSERT INTO video_library (video_id, youtube_id, title, subject_id, grade_levels, duration_seconds, gbb_on_complete, approved, tags) VALUES
-- MATH Grade 2
('vid_placevalue1',  '16aGiRRNJHg', 'Place Value Song - Hundreds, Tens and Ones', 'sub_MATH2', '{2}', 180, 2, TRUE, '{place_value,math,song}'),
('vid_addto20',      'CLhzuBhR5YM', 'Adding Numbers to 20 - Fun Math for Kids',   'sub_MATH2', '{2}', 240, 2, TRUE, '{addition,math}'),
('vid_subto20',      'rZhUPGrm-kw', 'Subtraction for Kids',                       'sub_MATH2', '{2}', 300, 2, TRUE, '{subtraction,math}'),
('vid_wordprob2',    'DWUBPaalDRs', '2nd Grade Math - Word Problems',              'sub_MATH2', '{2}', 420, 2, TRUE, '{word_problems,math}'),
('vid_skipcounting', 'r2TlTVrPECI', 'Skip Counting by 2s, 5s, and 10s Song',      'sub_MATH2', '{2}', 195, 2, TRUE, '{skip_counting,multiplication}'),
-- WRITING Grade 2
('vid_sentences1',   'FDJTUimJH4o', 'How to Write a Complete Sentence',            'sub_WRIT2', '{2}', 300, 2, TRUE, '{sentences,writing}'),
('vid_punctuation1', 'iJ7n6Ys-RzM', 'Punctuation for Kids',                        'sub_WRIT2', '{2}', 240, 2, TRUE, '{punctuation,writing}'),
('vid_capitals1',    'UKnSP4e8waw', 'Capital Letters - When to Use Them',          'sub_WRIT2', '{2}', 210, 2, TRUE, '{capitalization,writing}'),
('vid_storywriting', 'b9Y3K7h-Dg4', 'How to Write a Story',                        'sub_WRIT2', '{2}', 360, 2, TRUE, '{story,creative_writing}'),
-- MATH Grade 5
('vid_fractions1',   'n0Y_ZDiGEAw', 'Fractions for Kids - Add and Subtract',      'sub_MATH5', '{5}', 360, 2, TRUE, '{fractions,math}'),
('vid_decimals1',    'nMGwzAhzWWs', 'Decimals Explained',                          'sub_MATH5', '{5}', 300, 2, TRUE, '{decimals,math}'),
('vid_longmult',     'B8G7JGMf7p4', 'Long Multiplication Step by Step',            'sub_MATH5', '{5}', 480, 2, TRUE, '{multiplication,math}'),
('vid_division1',    'JTHwDmgYlLE', 'Division with Remainders - 5th Grade',        'sub_MATH5', '{5}', 420, 2, TRUE, '{division,math}'),
-- SCIENCE Grade 5
('vid_lifecycles',   'gONBzCVTHHE', 'Life Cycles - Plants and Animals',            'sub_SCI5',  '{5}', 420, 2, TRUE, '{life_cycles,science}'),
('vid_watercycle',   'al-do-HGuIk', 'The Water Cycle',                             'sub_SCI5',  '{5}', 300, 2, TRUE, '{water_cycle,earth_science}'),
-- SPORTS
('vid_batting1',     'KMFEMHWXUIs', 'Baseball Hitting Mechanics for Kids',         'sub_BASE',  '{2,5}', 480, 3, TRUE, '{batting,baseball}'),
('vid_fielding1',    'pB5qSHe8L-8', 'How to Field Ground Balls',                   'sub_BASE',  '{2,5}', 360, 3, TRUE, '{fielding,baseball}'),
('vid_pitching1',    'XWFOzPaS6Ng', 'Softball Pitching - Windmill Motion',         'sub_SOFT',  '{5}',   540, 3, TRUE, '{pitching,softball}')
ON CONFLICT DO NOTHING;
