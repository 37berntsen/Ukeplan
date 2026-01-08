import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCGyPMHUac2lHwIsmjYxKr_6dtQKAVQHe8",
    authDomain: "ukeplanskole-790e3.firebaseapp.com",
    projectId: "ukeplanskole-790e3",
    storageBucket: "ukeplanskole-790e3.firebasestorage.app",
    messagingSenderId: "59113153158",
    appId: "1:59113153158:web:57934f14254da5a19d6707"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const hardcodedTeachers = ["Tiril Engemoen Aasland", "Ola Eieland Abrahamsen", "Frode Andersen", "Petter Brun Andersen", "Netsanet Leyew Anley", "Nicolas Charles Sylvest Battersby", "Ingerid Kristine Berge", "Kristoffer Berntsen", "Malene Emilia Berstad", "Emilie Louise Bjelland-Ibenfeldt", "Tony Danielsen"];
const hardcodedSubjects = [{n: "Norsk", c: "#fecaca", r: false}, {n: "Matematikk", c: "#bbf7d0", r: false}, {n: "Engelsk", c: "#bfdbfe", r: false}, {n: "Samfunnsfag", c: "#ffedd5", r: false}, {n: "Naturfag", c: "#ccfbf1", r: true}, {n: "KRLE", c: "#fef9c3", r: false}, {n: "Kroppsøving", c: "#e9d5ff", r: true}, {n: "Kunst & Håndverk", c: "#fbcfe8", r: true}];
const slotsTemplate = [{t: "08:30-09:15"}, {t: "09:15-10:00"}, {t: "10:00-10:15", p: "PAUSE"}, {t: "10:15-11:00"}, {t: "11:00-11:45"}, {t: "11:45-12:15", p: "LUNSJ"}, {t: "12:15-13:00"}, {t: "13:00-13:45"}, {t: "13:45-14:00", p: "PAUSE"}, {t: "14:00-14:45"}, {t: "14:45-15:30"}];

let currentTab = 'class', dragData = null, pendingRoomTarget = null, copyTarget = null, editingSubIndex = null;
let store = { currentPlanId: "9A", globalSubjects: [...hardcodedSubjects], globalTeachers: [...hardcodedTeachers], plans: { "9A": { klasse: "9A", laerer: "", uke: "1", cells: [] } } };

// AUTH LOGIKK
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        loadFromFirebase();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

window.login = () => signInWithPopup(auth, provider);

// FIREBASE SYNKRONISERING
async function persistData() {
    if(currentTab === 'teacher') return;
    const plan = store.plans[store.currentPlanId];
    plan.klasse = document.getElementById('labelKlasse').innerText;
    plan.laerer = document.getElementById('labelLaerer').innerText;
    plan.uke = document.getElementById('labelUke').innerText;
    plan.cells = [];
    document.querySelectorAll('.dropzone').forEach(z => {
        const ts = Array.from(z.querySelectorAll('.teacher-chip')).map(c => c.firstChild.textContent);
        plan.cells.push({ s: z.querySelector('.subject-display').innerText, r: z.querySelector('.room-label').innerText, t: ts, bg: z.style.backgroundColor });
    });
    await setDoc(doc(db, "data", "mainStore"), store);
}

function loadFromFirebase() {
    onSnapshot(doc(db, "data", "mainStore"), (d) => {
        if(d.exists()) {
            store = d.data();
            renderGlobalLists();
            renderPlanSelector();
            loadPlan(store.currentPlanId);
        }
    });
}

// RENDERING LOGIKK (FRA DIN FIL)
window.loadPlan = (id) => {
    if(!store.plans[id]) return;
    store.currentPlanId = id; const plan = store.plans[id];
    document.getElementById('labelKlasse').innerText = plan.klasse || id;
    document.getElementById('labelLaerer').innerText = plan.laerer || "";
    document.getElementById('labelUke').innerText = plan.uke || "1";
    const tbody = document.getElementById('tableBody'); tbody.innerHTML = "";
    let cellIdx = 0;
    slotsTemplate.forEach((slot, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="time-cell">${slot.t}</td>`;
        if(slot.p) tr.innerHTML += `<td colspan="5" style="background:#f1f5f9; font-weight:900;">${slot.p}</td>`;
        else {
            for(let j=0; j<5; j++) {
                const td = document.createElement('td'); td.className = "dropzone";
                const saved = (plan.cells && plan.cells[cellIdx]) ? plan.cells[cellIdx] : {s:'', t:[], bg:'', r:''};
                td.style.backgroundColor = saved.bg || '';
                let tHtml = (saved.t || []).map(t => `<span class="teacher-chip">${t}<span class="remove-chip no-print" onclick="removeTeacher(this)">✕</span></span>`).join('');
                td.innerHTML = `<div class="subject-display">${saved.s || ''}</div><div class="room-label">${saved.r || ''}</div><div class="teachers-container">${tHtml}</div>${saved.s ? '<span class="clear-btn no-print" onclick="clearSubject(this)">✕</span>' : ''}`;
                tr.appendChild(td); cellIdx++;
            }
        }
        tbody.appendChild(tr);
    });
}

// DRAG & DROP LOGIKK (FRA DIN FIL)
window.setupDragEvents = () => {
    document.addEventListener('dragover', e => { if(e.target.closest('.dropzone')) e.preventDefault(); });
    document.addEventListener('drop', e => {
        const z = e.target.closest('.dropzone');
        if(z && dragData && currentTab === 'class') {
            if(dragData.type === 'subject') {
                if(dragData.needsRoom) {
                    pendingRoomTarget = z;
                    document.getElementById('modalOverlay').style.display = 'block';
                    document.getElementById('roomModal').style.display = 'block';
                } else updateCellSubject(z, dragData.text, dragData.color, "");
            } else {
                addTeacherToCell(z, dragData.text);
                checkForDoubleHour(z, dragData.text, e.clientX, e.clientY);
            }
            persistData();
        }
    });
}

// HJELPEFUNKSJONER
window.setTab = (type) => {
    currentTab = type;
    document.getElementById('tabClass').classList.toggle('active', type === 'class');
    document.getElementById('tabTeacher').classList.toggle('active', type === 'teacher');
    document.getElementById('labelLaerer').parentElement.style.display = type === 'class' ? 'block' : 'none';
    document.getElementById('teacherViewSelector').style.display = type === 'teacher' ? 'inline-block' : 'none';
    if(type === 'class') loadPlan(store.currentPlanId);
    else { populateTeacherSelector(); renderTeacherSchedule(); }
};

window.applyRoomChoice = (r) => { updateCellSubject(pendingRoomTarget, dragData.text, dragData.color, r); closeModals(); };
window.updateCellSubject = (z, sub, col, room) => { 
    z.querySelector('.subject-display').innerText = sub; 
    z.querySelector('.room-label').innerText = room; 
    z.style.backgroundColor = col; 
    persistData(); 
};
window.closeModals = () => { document.getElementById('modalOverlay').style.display = 'none'; document.getElementById('roomModal').style.display = 'none'; document.getElementById('editSubjectModal').style.display = 'none'; };
window.clearSubject = (btn) => { const td = btn.closest('.dropzone'); td.querySelector('.subject-display').innerText = ""; td.querySelector('.room-label').innerText = ""; td.querySelector('.teachers-container').innerHTML = ""; td.style.backgroundColor = ""; persistData(); };
window.removeTeacher = (btn) => { btn.parentElement.remove(); persistData(); };
window.addGlobalItem = (type) => {
    const inp = document.getElementById(type === 'subject' ? 'subInp' : 'teaInp');
    if(!inp.value) return;
    if(type === 'teacher') { if(!store.globalTeachers.includes(inp.value)) store.globalTeachers.push(inp.value); }
    else { store.globalSubjects.push({n: inp.value, c: document.getElementById('colInp').value, r: false}); }
    inp.value = ""; renderGlobalLists(); persistData();
};
window.removeItemFromList = (type, name) => {
    if(type === 'teacher') store.globalTeachers = store.globalTeachers.filter(t => t !== name);
    else store.globalSubjects = store.globalSubjects.filter(s => s.n !== name);
    renderGlobalLists(); persistData();
};

// INITIALISERING
function renderGlobalLists() {
    const sL = document.getElementById('subjectsList'), tL = document.getElementById('teachersList');
    sL.innerHTML = ""; tL.innerHTML = "";
    store.globalSubjects.forEach((s, idx) => {
        const div = document.createElement('div'); div.className = 'item'; div.draggable = true;
        div.ondragstart = () => { dragData = { type: 'subject', text: s.n, color: s.c, needsRoom: s.r }; };
        div.innerHTML = `<div class="color-preview" style="background:${s.c}"></div><span>${s.n}</span><div class="item-actions"><span class="action-btn" onclick="openEditSubject(${idx})">✎</span><span class="action-btn" onclick="removeItemFromList('subject','${s.n}')">✕</span></div>`;
        sL.appendChild(div);
    });
    store.globalTeachers.sort().forEach(t => {
        const div = document.createElement('div'); div.className = 'item'; div.draggable = true;
        div.ondragstart = () => { dragData = { type: 'teacher', text: t }; };
        div.innerHTML = `<span>👤 ${t}</span><span class="action-btn" onclick="removeItemFromList('teacher','${t}')">✕</span>`;
        tL.appendChild(div);
    });
}

window.openEditSubject = (idx) => {
    editingSubIndex = idx; const s = store.globalSubjects[idx];
    document.getElementById('editSubName').value = s.n;
    document.getElementById('editSubColor').value = s.c;
    document.getElementById('editSubNeedsRoom').checked = s.r;
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('editSubjectModal').style.display = 'block';
};

window.saveSubjectEdit = () => {
    store.globalSubjects[editingSubIndex] = { n: document.getElementById('editSubName').value, c: document.getElementById('editSubColor').value, r: document.getElementById('editSubNeedsRoom').checked };
    closeModals(); renderGlobalLists(); persistData();
};

window.renderPlanSelector = () => {
    const sel = document.getElementById('planSelector'); sel.innerHTML = "";
    Object.keys(store.plans).forEach(id => { const opt = document.createElement('option'); opt.value = id; opt.textContent = id; if(id === store.currentPlanId) opt.selected = true; sel.appendChild(opt); });
};

window.switchPlan = () => { loadPlan(document.getElementById('planSelector').value); };
window.createNewPlan = () => { const n = prompt("Klassenavn:"); if(n) { store.plans[n] = { klasse: n, laerer: "", uke: "1", cells: [] }; renderPlanSelector(); loadPlan(n); persistData(); } };

// EXCEL OG ANDRE FUNKSJONER (FRA DIN FIL)
window.handleExcelImport = (input) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1});
        rows.forEach(row => { if(row[0] && row[1]) { const full = row[0].toString().trim() + " " + row[1].toString().trim(); if(!store.globalTeachers.includes(full)) store.globalTeachers.push(full); } });
        renderGlobalLists(); persistData();
    };
    reader.readAsArrayBuffer(input.files[0]);
};

function addTeacherToCell(z, n) { const cont = z.querySelector('.teachers-container'); if(!Array.from(cont.querySelectorAll('.teacher-chip')).some(c => c.firstChild.textContent === n)) cont.insertAdjacentHTML('beforeend', `<span class="teacher-chip">${n}<span class="remove-chip no-print" onclick="removeTeacher(this)">✕</span></span>`); }
function checkForDoubleHour(cell, name, x, y) {
    const dropzones = Array.from(document.querySelectorAll('.dropzone'));
    const idx = dropzones.indexOf(cell);
    const nextIdx = idx + 5;
    if(dropzones[nextIdx]) {
        const curSub = cell.querySelector('.subject-display').innerText;
        const nextSub = dropzones[nextIdx].querySelector('.subject-display').innerText;
        if(curSub !== "" && curSub === nextSub) {
            const prompt = document.getElementById('copyPrompt');
            prompt.style.left = x + "px"; prompt.style.top = (y + 20) + "px";
            prompt.style.display = "block";
            copyTarget = { cell: dropzones[nextIdx], name: name };
            setTimeout(() => { prompt.style.display = "none"; }, 5000);
        }
    }
}
window.confirmCopy = () => { if(copyTarget) { addTeacherToCell(copyTarget.cell, copyTarget.name); document.getElementById('copyPrompt').style.display = "none"; persistData(); } };
window.generatePDF = () => { window.print(); };

// Start setup
setupDragEvents();
