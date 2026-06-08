/**
 * academy.js — Academy materials data and hub rendering.
 * Depends on: api.js
 */

import { setStatus } from './api.js';

/* ---- Materials manifest ------------------------------------ */

export const ACADEMY_MATERIALS = [
  // Essential
  { title:"Start Here",         detail:"Day 1 flow, daily rhythm, and full package map.",              icon:"🗺️", type:"guide",   cat:"Essential",    href:"/academy/package/0_START_HERE/START_HERE.md" },
  { title:"Teacher Guide",      detail:"Master curriculum guide for running the Academy.",              icon:"👨‍🏫", type:"guide",   cat:"Essential",    href:"/academy/package/1_TEACHER_GUIDES/dads_teacher_guide.pdf" },
  { title:"Parent Cheatsheet",  detail:"Quick reference: rewards, rules, and app usage.",              icon:"📋", type:"guide",   cat:"Essential",    href:"/academy/package/1_TEACHER_GUIDES/gbb_parent_cheatsheet.pdf" },
  { title:"8-Week Calendar",    detail:"Mon–Thu schedule for the full summer.",                        icon:"📅", type:"guide",   cat:"Essential",    href:"/academy/package/4_LESSON_CALENDARS/8_week_calendar.pdf" },
  { title:"GBB Reference",      detail:"Complete platform reference — rewards, images, rules.",        icon:"📕", type:"guide",   cat:"Essential",    href:"/academy/package/11_GBB_DOCS/GOODBODYBUCKS_REFERENCE.md" },
  // Student Plans
  { title:"Miles Plan",         detail:"Personalized 8-week plan — Grade 2.",                         icon:"👦", type:"plan",    cat:"Student Plans", href:"/academy/package/2_STUDENT_PLANS/miles_student_plan.pdf" },
  { title:"Sabrina Plan",       detail:"Personalized 8-week plan — Grade 5.",                         icon:"👧", type:"plan",    cat:"Student Plans", href:"/academy/package/2_STUDENT_PLANS/sabrina_student_plan.pdf" },
  { title:"Blank Student Plan", detail:"Editable template for any child.",                            icon:"📝", type:"plan",    cat:"Student Plans", href:"/academy/package/3_BLANK_TEMPLATES/blank_student_plan.pdf" },
  // Lesson Decks
  { title:"Kickoff Deck",       detail:"Day 1 presentation — show the kids.",                         icon:"🚀", type:"deck",    cat:"Lesson Decks",  href:"/academy/package/6_PPTX_KICKOFF/summer_kickoff_deck.pptx" },
  { title:"Miles · Math",       detail:"Reusable lesson slides — Miles Math.",                        icon:"🔢", type:"deck",    cat:"Lesson Decks",  href:"/academy/package/5_PPTX_LESSON_TEMPLATES/Miles_MATH_template.pptx" },
  { title:"Miles · Reading",    detail:"Reusable lesson slides — Miles Reading.",                     icon:"📖", type:"deck",    cat:"Lesson Decks",  href:"/academy/package/5_PPTX_LESSON_TEMPLATES/Miles_READING_template.pptx" },
  { title:"Miles · Writing",    detail:"Reusable lesson slides — Miles Writing.",                     icon:"✍️", type:"deck",    cat:"Lesson Decks",  href:"/academy/package/5_PPTX_LESSON_TEMPLATES/Miles_WRITING_template.pptx" },
  { title:"Sabrina · ELA",      detail:"Reusable lesson slides — Sabrina ELA.",                      icon:"📚", type:"deck",    cat:"Lesson Decks",  href:"/academy/package/5_PPTX_LESSON_TEMPLATES/Sabrina_ELA_template.pptx" },
  { title:"Sabrina · Math",     detail:"Reusable lesson slides — Sabrina Math.",                     icon:"🔢", type:"deck",    cat:"Lesson Decks",  href:"/academy/package/5_PPTX_LESSON_TEMPLATES/Sabrina_MATH_template.pptx" },
  { title:"Sabrina · Science",  detail:"Reusable lesson slides — Sabrina Science.",                  icon:"🔬", type:"deck",    cat:"Lesson Decks",  href:"/academy/package/5_PPTX_LESSON_TEMPLATES/Sabrina_SCIENCE_template.pptx" },
  // Print & Use
  { title:"Fridge Menus",       detail:"4-page printable menus: food, screen time, learning, consequences.", icon:"🖨️", type:"print", cat:"Print & Use", href:"/academy/package/7_PRINTABLES/fridge_menus.pdf" },
  { title:"GB$ Currency Bills", detail:"Cut-out printable GoodbodyBucks for offline use.",            icon:"💵", type:"print",   cat:"Print & Use",  href:"/academy/package/7_PRINTABLES/gbb_currency_bills.pdf" },
  { title:"Sports Goal Sheets", detail:"Sports goals + Better Yourself project guide.",               icon:"🏆", type:"print",   cat:"Print & Use",  href:"/academy/package/8_SPORTS_AND_PROJECTS/sports_goal_sheets.pdf" },
  // Progress
  { title:"Summer Tracker",     detail:"Excel: GB$ ledger, progress tracker, video library.",         icon:"📊", type:"tracker", cat:"Progress",     href:"/academy/package/9_TRACKING_SHEETS/summer_tracker.xlsx" },
];

const TYPE_LABEL = { print: "Print", guide: "Guide", plan: "Plan", deck: "Deck", tracker: "Tracker" };

/* ---- Hub renderer ------------------------------------------ */

export function renderAcademyHub() {
  const target = document.getElementById("academyMaterials");
  if (!target) return;
  const cats = [...new Set(ACADEMY_MATERIALS.map(m => m.cat))];
  target.innerHTML = cats.map(cat => {
    const items = ACADEMY_MATERIALS.filter(m => m.cat === cat);
    return `<div class="academy-cat-heading">${cat}</div>` +
      items.map(item => `
        <div class="academy-card">
          <div class="academy-card-meta">
            <span class="academy-card-icon">${item.icon}</span>
            <span class="academy-type-badge badge-${item.type}">${TYPE_LABEL[item.type] || item.type}</span>
          </div>
          <strong>${item.title}</strong>
          <span>${item.detail}</span>
          <a href="${item.href}" target="_blank" rel="noopener noreferrer">Open →</a>
        </div>`).join("");
  }).join("");
}

/* ---- Quick-action helpers ---------------------------------- */

export function applyAcademyAllotment() {
  document.getElementById("allotment").value = '{ "Miles": 12, "Sabrina": 15 }';
  document.getElementById("allotment").scrollIntoView({ behavior: "smooth", block: "center" });
  setStatus("Academy allotment loaded. Click Apply when ready.");
}

export function focusAcademyReward() {
  const rewardSelect    = document.getElementById("rewardAction");
  const academyOption   = Array.from(rewardSelect.options).find(o => o.value.startsWith("academy_"));
  if (academyOption) rewardSelect.value = academyOption.value;
  rewardSelect.scrollIntoView({ behavior: "smooth", block: "center" });
  setStatus(academyOption ? "Academy reward selected." : "Login and refresh catalog to load Academy rewards.");
}
