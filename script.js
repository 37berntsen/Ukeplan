import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

const tider = ["08:30-09:15", "09:15-10:00", "10:15-11:00", "11:00-11:45", "11:45-12:15 (LUNSJ)", "12:15-13:00", "13:00-13:45", "13:45-14:00 (PAUSE)", "14:00-14:45", "14:45-15:30"];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        renderTable();
        loadData();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

function renderTable() {
    const body = document.getElementById('planBody');
    body.innerHTML = tider.map((tid, i) => {
        if (tid.includes("LUNSJ") || tid.includes("PAUSE")) {
            return `<tr style="background:#f1f5f9; font-weight:900; font-size:11px;"><td colspan="6">${tid}</td></tr>`;
        }
        return `<tr><td class="time-col">${tid}</td>${Array(5).fill(0).map((_, j) => `<td id="cell-${i}-${j}" class="drop-zone"></td>`).join('')}</tr>`;
    }).join('');
    setupDragDrop();
}

function setupDragDrop() {
    document.querySelectorAll('.fag-item, .laerer-item').forEach(item => {
        item.ondragstart = (e) => e.dataTransfer.setData("text", e.target.innerText + "|" + e.target.style.backgroundColor);
    });
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.ondragover = (e) => e.preventDefault();
        zone.ondrop = (e) => {
            const [txt, bg] = e.dataTransfer.getData("text").split('|');
            zone.innerHTML = `<div style="background:${bg}; padding:8px; border-radius:6px; font-weight:800; border:2px solid #000; font-size:12px;">${txt}</div>`;
        };
    });
}

document.getElementById('loginBtn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logoutBtn').onclick = () => signOut(auth);

document.getElementById('adminSaveBtn').onclick = async () => {
    const cells = Array.from(document.querySelectorAll('.drop-zone')).map(td => ({ id: td.id, html: td.innerHTML }));
    await setDoc(doc(db, "ukeplaner", "hovedplan"), { cells });
    alert("Lagret!");
};

function loadData() {
    onSnapshot(doc(db, "ukeplaner", "hovedplan"), (doc) => {
        if (doc.exists()) doc.data().cells.forEach(c => {
            const el = document.getElementById(c.id);
            if (el) el.innerHTML = c.html;
        });
    });
}
