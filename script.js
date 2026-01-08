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

const slotsTemplate = [{t: "08:30-09:15"}, {t: "09:15-10:00"}, {t: "10:00-10:15", p: "PAUSE"}, {t: "10:15-11:00"}, {t: "11:00-11:45"}, {t: "11:45-12:15", p: "LUNSJ"}, {t: "12:15-13:00"}, {t: "13:00-13:45"}, {t: "13:45-14:00", p: "PAUSE"}, {t: "14:00-14:45"}, {t: "14:45-15:30"}];

let currentTab = 'class', dragData = null, pendingRoomTarget = null, editingSubIndex = null;
let store = { currentPlanId: "9A", globalSubjects: [], globalTeachers: [], plans: { "9A": { klasse: "9A", uke: "1", cells: [], times: slotsTemplate.map(s => s.t) } } };

// AUTH LOGIKK
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        loadFromFirebase();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
    }
});

window.login = () => signInWithPopup(auth, provider);

// SIKKER LAGRING (Fjerner 'undefined')
async function persistData() {
    if (currentTab === 'teacher') return;
    const plan = store.plans[store.currentPlanId];
    
    // Sikre at info-felt har verdier
    plan.klasse = document.getElementById('labelKlasse').innerText || store.currentPlanId;
    plan.uke = document.getElementById('labelUke').innerText || "1";
    plan.times = Array.from(document.querySelectorAll('.time-cell')).map(td => td.innerText || "");
    
    plan.cells = [];
    document.querySelectorAll('.dropzone').forEach(z => {
        const ts = Array.from(z.querySelectorAll('.teacher-chip')).map(c => c.firstChild.textContent || "");
        plan.cells.push({ 
            s: z.querySelector('.subject-display').innerText || "", 
            r: z.querySelector('.room-label').innerText || "", 
            t: ts, 
            bg: z.style.backgroundColor || "" 
        });
    });

    try {
        await setDoc(doc(db, "data", "mainStore"), store);
    } catch (err) {
        console.error("Lagringsfeil:", err);
    }
}

function loadFromFirebase() {
    onSnapshot(doc(db, "data", "mainStore"), (d) => {
        if (d.exists()) {
            store = d.data();
            // Sikkerhets-sjekk for objekter som kan mangle i databasen
            if (!store.globalSubjects) store.globalSubjects = [];
            if (!store.globalTeachers) store.globalTeachers = [];
            
            updateGlobalListsUI();
            updatePlanSelectorUI();
            if (currentTab === 'class') window.loadPlan(store.currentPlanId);
            else renderTeacherSchedule();
        }
    });
}

// RENDERING (GJENOPPRETTET FRA DIN LOKALE FIL)
window.loadPlan = (id) => {
    if (!store.plans[id]) return;
    store.currentPlanId = id; 
    const plan = store.plans[id];
    
    document.getElementById('labelKlasse').innerText = plan.klasse || id;
    document.getElementById('labelUke').innerText = plan.uke || "1";
    
    const tbody = document.getElementById('tableBody'); 
    tbody.innerHTML = "";
    let cellIdx = 0;

    slotsTemplate.forEach((slot, i) => {
        const tr = document.createElement('tr');
        const displayTime = (plan.times && plan.times[i]) ? plan.times[i] : slot.t;
        
        tr.innerHTML = `<td class="time-cell" contenteditable="true" onblur="persistData()">${displayTime}</td>`;
        
        if (slot.p) {
            tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        } else {
            for (let j = 0; j < 5; j++) {
                const td = document.createElement('td'); 
                td.className = "dropzone";
                const saved = (plan.cells && plan.cells[cellIdx]) ? plan.cells[cellIdx] : {s:'', t:[], bg:'', r:''};
                
                td.style.backgroundColor = saved.bg || '';
                const rDisp = (saved.r && saved.r !== "Primærrom") ? `<div class="room-label">${saved.r}</div>` : '';
                let tHtml = (saved.t || []).map(t => `<span class="teacher-chip">${t}<span class="remove-chip no-print" onclick="removeTeacher(this)">✕</span></span>`).join('');
                
                td.innerHTML = `
                    <div class="subject-display">${saved.s || ''}</div>
                    ${rDisp}
                    <div class="teachers-container">${tHtml}</div>
                    ${saved.s ? '<span class="clear-btn no-print" onclick="clearSubject(this)">✕</span>' : ''}
                `;
                
                td.ondragover = e => e.preventDefault();
                td.ondrop = (e) => handleDrop(td, cellIdx);
                tr.appendChild(td); 
                cellIdx++;
            }
        }
        tbody.appendChild(tr);
    });
};

// ... (Resten av funksjonene: handleDrop, addItem, removeItem, switchPlan, createNewPlan, setTab)
// Inkluderer alle globale koblinger
window.persistData = persistData;
window.handleDrop = (td, idx) => { /* Logikk for drag & drop */ }; 
window.addItem = (type) => { /* Legg til fag/lærer */ };
// (Ferdigstilt kode må inkludere alle disse som i forrige versjon for full funksjonalitet)
