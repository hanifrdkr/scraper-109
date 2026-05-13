import express from "express";
import { execSync } from "child_process";
import path from "path";

const app = express();
const PORT = 4000;

const DB_DIR = path.join(__dirname, "../db");

function queryDB(dbFile: string, sql: string): any[] {
  try {
    const dbPath = path.join(DB_DIR, dbFile);
    const out = execSync(`sqlite3 -json "${dbPath}" "${sql}"`, { encoding: "utf-8" });
    return out.trim() ? JSON.parse(out) : [];
  } catch {
    return [];
  }
}

async function getAllApplicants() {
  const sources = [
    { name: "glints", file: "glints.db" },
    { name: "jooble", file: "jooble.db" },
    { name: "kitalulus", file: "kitalulus.db" },
  ];

  const results: any[] = [];

  for (const src of sources) {
    const rows = queryDB(src.file, "SELECT id, email, data FROM applicants");
    for (const row of rows) {
      try {
        const data = typeof row.data === "string" ? JSON.parse(row.data) : {};
        results.push({ _source: src.name, _id: row.id, ...data });
      } catch {
        results.push({ _source: src.name, _id: row.id, email: row.email });
      }
    }
  }

  return results;
}

app.get("/api/applicants", async (_req, res) => {
  const data = await getAllApplicants();
  res.json(data);
});

app.get("/", (_req, res) => {
  res.send(HTML);
});

app.listen(PORT, () => {
  console.log(`Viewer running at http://localhost:${PORT}`);
});

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Applicants Viewer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #111;
      background: #fff;
      padding: 24px;
      max-width: 960px;
      margin: 0 auto;
    }

    h1 { font-size: 20px; font-weight: 600; margin-bottom: 16px; }

    .controls {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      align-items: center;
    }

    input[type="text"] {
      border: 1px solid #ccc;
      padding: 6px 10px;
      font-size: 14px;
      width: 240px;
    }

    select {
      border: 1px solid #ccc;
      padding: 6px 10px;
      font-size: 14px;
    }

    .count { color: #555; font-size: 13px; }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #111;
      font-size: 13px;
      white-space: nowrap;
    }

    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e0e0e0;
      vertical-align: top;
    }

    tr:hover td { background: #f7f7f7; }

    .tag {
      display: inline-block;
      background: #eee;
      padding: 1px 6px;
      font-size: 12px;
      border-radius: 2px;
    }

    .detail-btn {
      background: none;
      border: 1px solid #999;
      padding: 3px 8px;
      font-size: 12px;
      cursor: pointer;
    }

    .detail-btn:hover { background: #f0f0f0; }

    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 10;
    }

    .modal-overlay.open { display: flex; align-items: center; justify-content: center; }

    .modal {
      background: #fff;
      width: 90%;
      max-width: 680px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 24px;
      position: relative;
    }

    .modal-close {
      position: absolute;
      top: 12px; right: 16px;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #555;
    }

    .modal h2 { font-size: 16px; margin-bottom: 16px; }

    .section { margin-bottom: 16px; }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #555;
      margin-bottom: 6px;
      border-bottom: 1px solid #eee;
      padding-bottom: 4px;
    }

    .field { display: flex; gap: 8px; margin-bottom: 4px; }
    .field-label { color: #555; min-width: 120px; flex-shrink: 0; }
    .field-value { word-break: break-word; }

    .exp-item, .edu-item {
      margin-bottom: 10px;
      padding-left: 12px;
      border-left: 3px solid #ddd;
    }

    .exp-item strong, .edu-item strong { display: block; margin-bottom: 2px; }

    .skills { display: flex; gap: 6px; flex-wrap: wrap; }

    .loading { color: #555; padding: 40px 0; text-align: center; }

    a { color: #0055cc; }
  </style>
</head>
<body>
  <h1>Applicants</h1>

  <div class="controls">
    <input type="text" id="search" placeholder="Search name, email, position..." />
    <select id="filter-source">
      <option value="">All sources</option>
      <option value="glints">Glints</option>
      <option value="jooble">Jooble</option>
      <option value="kitalulus">Kitalulus</option>
    </select>
    <span class="count" id="count"></span>
  </div>

  <div id="table-container"><p class="loading">Loading...</p></div>

  <div class="modal-overlay" id="modal-overlay">
    <div class="modal" id="modal">
      <button class="modal-close" id="modal-close">&#x2715;</button>
      <div id="modal-body"></div>
    </div>
  </div>

  <script>
    let allApplicants = [];

    async function load() {
      const res = await fetch('/api/applicants');
      allApplicants = await res.json();
      render();
    }

    function render() {
      const search = document.getElementById('search').value.toLowerCase();
      const source = document.getElementById('filter-source').value;

      const filtered = allApplicants.filter(a => {
        const matchSrc = !source || a._source === source;
        const haystack = [a.name, a.email, a.applied_for, a._source].join(' ').toLowerCase();
        return matchSrc && (!search || haystack.includes(search));
      });

      document.getElementById('count').textContent = filtered.length + ' applicant' + (filtered.length !== 1 ? 's' : '');

      if (!filtered.length) {
        document.getElementById('table-container').innerHTML = '<p style="color:#555;padding:20px 0">No results.</p>';
        return;
      }

      const rows = filtered.map((a, i) => {
        const phone = a.contact?.contact_number || a.phone?.contact_number || a.phone || '-';
        return \`<tr>
          <td>\${i + 1}</td>
          <td><span class="tag">\${a._source || '-'}</span></td>
          <td>\${esc(a.name || '-')}</td>
          <td>\${esc(a.email || '-')}</td>
          <td>\${esc(a.applied_for || '-')}</td>
          <td>\${esc(a.applied_date || '-')}</td>
          <td>\${esc(phone)}</td>
          <td>\${esc(a.location || '-')}</td>
          <td><button class="detail-btn" onclick="showDetail(\${allApplicants.indexOf(a)})">View</button></td>
        </tr>\`;
      }).join('');

      document.getElementById('table-container').innerHTML = \`
        <table>
          <thead>
            <tr>
              <th>#</th><th>Source</th><th>Name</th><th>Email</th>
              <th>Applied For</th><th>Date</th><th>Phone</th><th>Location</th><th></th>
            </tr>
          </thead>
          <tbody>\${rows}</tbody>
        </table>
      \`;
    }

    function showDetail(idx) {
      const a = allApplicants[idx];
      const phone = a.contact?.contact_number || a.phone?.contact_number || a.phone || '-';
      const skills = Array.isArray(a.skill) ? a.skill : [];
      const experiences = Array.isArray(a.work_experience) ? a.work_experience : [];
      const education = Array.isArray(a.education) ? a.education : [];

      let html = \`<h2>\${esc(a.name || 'Unknown')}</h2>\`;

      html += \`<div class="section">
        <div class="section-title">Basic Info</div>
        \${field('Source', a._source)}
        \${field('Applied For', a.applied_for)}
        \${field('Applied Date', a.applied_date)}
        \${field('Email', a.email)}
        \${field('Phone', phone)}
        \${field('Location', a.location)}
        \${field('Gender', a.gender)}
        \${field('Date of Birth', a.date_of_birth)}
        \${field('Salary Expectation', a.salary_expectation ? 'Rp ' + Number(a.salary_expectation).toLocaleString() : null)}
      </div>\`;

      if (a.summary) {
        html += \`<div class="section">
          <div class="section-title">Summary</div>
          <p style="white-space:pre-wrap">\${esc(a.summary)}</p>
        </div>\`;
      }

      if (skills.length) {
        html += \`<div class="section">
          <div class="section-title">Skills</div>
          <div class="skills">\${skills.map(s => \`<span class="tag">\${esc(s)}</span>\`).join('')}</div>
        </div>\`;
      }

      if (experiences.length) {
        html += \`<div class="section">
          <div class="section-title">Work Experience</div>
          \${experiences.map(e => \`<div class="exp-item">
            <strong>\${esc(e.position)} — \${esc(e.organization)}</strong>
            <div style="color:#555;font-size:13px">\${esc(e.period_from || '')} → \${esc(e.period_to || '')}</div>
            \${e.job_desc ? \`<p style="margin-top:6px;white-space:pre-wrap;font-size:13px">\${esc(e.job_desc)}</p>\` : ''}
          </div>\`).join('')}
        </div>\`;
      }

      if (education.length) {
        html += \`<div class="section">
          <div class="section-title">Education</div>
          \${education.map(e => \`<div class="edu-item">
            <strong>\${esc(e.institution)}</strong>
            <div style="color:#555;font-size:13px">\${esc(e.education || '')} · \${esc(e.period_start_year || '')}–\${esc(e.period_end_year || '')}</div>
          </div>\`).join('')}
        </div>\`;
      }

      if (a.url_profile || a.page_url) {
        html += \`<div class="section">
          <div class="section-title">Links</div>
          \${a.url_profile ? \`<div><a href="\${esc(a.url_profile)}" target="_blank">Profile Page</a></div>\` : ''}
          \${a.page_url ? \`<div><a href="\${esc(a.page_url)}" target="_blank">Application Page</a></div>\` : ''}
        </div>\`;
      }

      document.getElementById('modal-body').innerHTML = html;
      document.getElementById('modal-overlay').classList.add('open');
    }

    function field(label, value) {
      if (!value) return '';
      return \`<div class="field"><span class="field-label">\${label}</span><span class="field-value">\${esc(String(value))}</span></div>\`;
    }

    function esc(str) {
      return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('modal-overlay').classList.remove('open');
    });
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) document.getElementById('modal-overlay').classList.remove('open');
    });

    document.getElementById('search').addEventListener('input', render);
    document.getElementById('filter-source').addEventListener('change', render);

    load();
  </script>
</body>
</html>`;
