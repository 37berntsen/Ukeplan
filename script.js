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

// Din originale datastruktur
let store = { 
    currentPlanId: "9A", 
    globalSubjects: [], 
    globalTeachers: [], 
    plans: { "9A": { klasse: "9A", laerer: "", uke: "1", cells: [] } } 
};

let currentTab = 'class', dragData = null, pendingRoomTarget = null, editingSubIndex = null;
const slotsTemplate = [{t: "08:30-09:15"}, {t: "09:15-10:00"}, {t: "10:00-10:15", p: "PAUSE"}, {t: "10:15-11:00"}, {t: "11:00-11:45"}, {t: "11:45-12:15", p: "LUNSJ"}, {t: "12:15-13:00"}, {t: "13:00-13:45"}, {t: "13:45-14:00", p: "PAUSE"}, {t: "14:00-14:45"}, {t: "14:45-15:30"}];

// AUTENTISERING
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        loadFromFirebase();
    }
});

// INITIALISERING OG RENDERING
window.init = () => {
    renderGlobalLists();
    renderPlanSelector();
    loadPlan(store.currentPlanId);
    setupDragEvents();
};

window.loadPlan = (id) => {
    store.currentPlanId = id;
    const plan = store.plans[id];
    document.getElementById('labelKlasse').innerText = plan.klasse;
    document.getElementById('labelLaerer').innerText = plan.laerer;
    document.getElementById('labelUke').innerText = plan.uke;
    
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";
    let cellIdx = 0;

    slotsTemplate.forEach((slot, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="time-cell" contenteditable="true">${slot.t}</td>`;
        if(slot.p) {
            tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        } else {
            for(let j=0; j<5; j++) {
                const td = document.createElement('td');
                td.className = "dropzone";
                const saved = plan.cells[cellIdx] || {s:'', t:[], bg:'', r:''};
                td.style.backgroundColor = saved.bg;
                td.innerHTML = `
                    <div class="subject-display">${saved.s}</div>
                    <div class="room-label">${saved.r}</div>
                    <div class="teachers-container">
                        ${(saved.t || []).map(t => `<span class="teacher-chip">${t}<span class="remove-chip" onclick="removeTeacher(this)">✕</span></span>`).join('')}
                    </div>
                    ${saved.s ? '<span class="clear-btn no-print" onclick="clearSubject(this)">✕</span>' : ''}
                `;
                tr.appendChild(td);
                cellIdx++;
            }
        }
        tbody.appendChild(tr);
    });
};

// DRAG AND DROP
window.setupDragEvents = () => {
    document.addEventListener('dragover', e => { if(e.target.closest('.dropzone')) e.preventDefault(); });
    document.addEventListener('drop', e => {
        const z = e.target.closest('.dropzone');
        if(z && dragData) {
            if(dragData.type === 'subject') {
                if(dragData.needsRoom) {
                    pendingRoomTarget = z;
                    document.getElementById('modalOverlay').style.display = 'block';
                    document.getElementById('roomModal').style.display = 'block';
                } else updateCell(z, dragData.text, dragData.color, "");
            } else addTeacher(z, dragData.text);
            persistAndSave();
        }
    });
};

// GLOBALE FUNKSJONER (KNAPPER)
window.login = () => signInWithPopup(auth, provider);
window.setTab = (type) => {
    currentTab = type;
    document.getElementById('tabClass').classList.toggle('active', type === 'class');
    document.getElementById('tabTeacher').classList.toggle('active', type === 'teacher');
    document.getElementById('classView').style.display = type === 'class' ? 'block' : 'none';
    document.getElementById('teacherView').style.display = type === 'teacher' ? 'block' : 'none';
};

window.addGlobalItem = (type) => {
    const inp = document.getElementById(type === 'subject' ? 'subInp' : 'teaInp');
    if(!inp.value) return;
    if(type === 'subject') store.globalSubjects.push({n: inp.value, c: document.getElementById('colInp').value, r: true});
    else store.globalTeachers.push(inp.value);
    inp.value = "";
    renderGlobalLists();
    persistAndSave();
};

window.createNewPlan = () => {
    const name = prompt("Klassenavn:");
    if(name) {
        store.plans[name] = { klasse: name, laerer: "", uke: "1", cells: [] };
        renderPlanSelector();
        loadPlan(name);
        persistAndSave();
    }
};

window.applyRoomChoice = (r) => {
    updateCell(pendingRoomTarget, dragData.text, dragData.color, r);
    closeModals();
};

// SYNKRONISERING
async function persistAndSave() {
    const plan = store.plans[store.currentPlanId];
    plan.cells = [];
    document.querySelectorAll('#tableBody .dropzone').forEach(z => {
        plan.cells.push({
            s: z.querySelector('.subject-display').innerText,
            r: z.querySelector('.room-label').innerText,
            t: Array.from(z.querySelectorAll('.teacher-chip')).map(c => c.firstChild.textContent),
            bg: z.style.backgroundColor
        });
    });
    await setDoc(doc(db, "data", "mainStore"), store);
}

function loadFromFirebase() {
    onSnapshot(doc(db, "data", "mainStore"), (doc) => {
        if(doc.exists()) {
            store = doc.data();
            renderGlobalLists();
            renderPlanSelector();
            loadPlan(store.currentPlanId);
        }
    });
}
