import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Data-struktur
let store = {
    currentPlanId: "9A",
    globalSubjects: [],
    globalTeachers: [],
    plans: { "9A": { klasse: "9A", cells: Array(60).fill(null).map(() => ({s:'', r:'', t:[], bg:''})), times: ["08:30-09:15", "09:15-10:00", "10:00-10:15", "10:15-11:00", "11:00-11:45", "11:45-12:15", "12:15-13:00", "13:00-13:45", "13:45-14:00", "14:00-14:45", "14:45-15:30"] } }
};

let draggedItem = null;
let pendingCellIdx = null;

// INNLOGGING
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

window.login = () => {
    signInWithPopup(auth, provider).catch(err => {
        alert("Feil ved innlogging: " + err.message);
        console.error(err);
    });
};

// APP LOGIKK
function setupApp() {
    renderTable();
    updateLists();
    updatePlanSelector();
}

function renderTable() {
    const plan = store.plans[store.currentPlanId];
    const body = document.getElementById('tableBody');
    body.innerHTML = "";
    
    let cellIdx = 0;
    plan.times.forEach((time, i) => {
        const tr = document.createElement('tr');
        
        const tidTd = document.createElement('td');
        tidTd.className = "time-cell";
        tidTd.contentEditable = true;
        tidTd.innerText = time;
        tidTd.onblur = () => { plan.times[i] = tidTd.innerText; save(); };
        tr.appendChild(tidTd);

        const isPause = [2, 5, 8].includes(i);
        if (isPause) {
            const txt = i === 5 ? "LUNSJ" : "PAUSE";
            tr.innerHTML += `<td colspan="5" class="pause-row">${txt}</td>`;
        } else {
            for (let d = 0; d < 5; d++) {
                const td = document.createElement('td');
                td.className = "drop-zone";
                const idx = cellIdx;
                const c = plan.cells[idx] || {s:'', r:'', t:[], bg:''};
                
                if (c.bg) td.style.backgroundColor = c.bg;
                td.innerHTML = `
                    <div class="s-text">${c.s || ''}</div>
                    <div class="r-text">${c.r || ''}</div>
                    <div class="t-wrap">${(c.t || []).map(t => `<span class="chip">${t}</span>`).join('')}</div>
                    ${c.s ? `<span class="del-x" onclick="clearCell(${idx})">×</span>` : ''}
                `;
                td.ondragover = e => e.preventDefault();
                td.ondrop = () => handleDrop(idx);
                tr.appendChild(td);
                cellIdx++;
            }
        }
        body.appendChild(tr);
    });
}

window.setDrag = (type, text, color = '') => { draggedItem = {type, text, color}; };

function handleDrop(idx) {
    if (!draggedItem) return;
    if (draggedItem.type === 'fag') {
        pendingCellIdx = idx;
        document.getElementById('roomModal').style.display = 'block';
    } else {
        const plan = store.plans[store.currentPlanId];
        if (!plan.cells[idx].t.includes(draggedItem.text)) {
            plan.cells[idx].t.push(draggedItem.text);
            save();
        }
    }
}

window.applyRoom = (room) => {
    const plan = store.plans[store.currentPlanId];
    plan.cells[pendingCellIdx].s = draggedItem.text;
    plan.cells[pendingCellIdx].bg = draggedItem.color;
    plan.cells[pendingCellIdx].r = room;
    document.getElementById('roomModal').style.display = 'none';
    save();
};

window.clearCell = (idx) => {
    store.plans[store.currentPlanId].cells[idx] = {s:'', r:'', t:[], bg:''};
    save();
};

window.addItem = (type) => {
    const val = document.getElementById(type === 'fag' ? 'subInp' : 'teaInp').value;
    if (!val) return;
    if (type === 'fag') store.globalSubjects.push({n: val, c: document.getElementById('colInp').value});
    else store.globalTeachers.push(val);
    save();
};

window.addNewClass = () => {
    const name = prompt("Navn på ny klasse:");
    if (name) {
        store.plans[name] = JSON.parse(JSON.stringify(store.plans["9A"]));
        store.plans[name].klasse = name;
        store.plans[name].cells = Array(60).fill(null).map(() => ({s:'', r:'', t:[], bg:''}));
        store.currentPlanId = name;
        save();
    }
};

function updateLists() {
    document.getElementById('subjectsList').innerHTML = store.globalSubjects.map(s => `<div class="item" draggable="true" style="background:${s.c}" ondragstart="setDrag('fag','${s.n}','${s.c}')">${s.n}</div>`).join('');
    document.getElementById('teachersList').innerHTML = store.globalTeachers.map(t => `<div class="item" draggable="true" ondragstart="setDrag('teacher','${t}')">${t}</div>`).join('');
}

function updatePlanSelector() {
    const sel = document.getElementById('planSelector');
    sel.innerHTML = Object.keys(store.plans).map(id => `<option value="${id}" ${id === store.currentPlanId ? 'selected' : ''}>${id}</option>`).join('');
    sel.onchange = (e) => { store.currentPlanId = e.target.value; renderTable(); };
}

async function save() { await setDoc(doc(db, "data", "main"), store); }
function loadFromFirebase() { onSnapshot(doc(db, "data", "main"), (d) => { if(d.exists()){ store = d.data(); setupApp(); }}); }
