import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyCGyPMHUac2lHwIsmjYxKr_6dtQKAVQHe8", // Sjekk at denne er din aktive nøkkel
  authDomain: "ukeplanskole-790e3.firebaseapp.com",
  projectId: "ukeplanskole-790e3",
  storageBucket: "ukeplanskole-790e3.firebasestorage.app",
  messagingSenderId: "59113153158",
  appId: "1:59113153158:web:57934f14254da5a19d6707"
};

console.log("Skriptet har startet!"); // Sjekk i F12 om du ser denne

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const tider = ["08:30-09:15", "09:15-10:00", "10:15-11:00", "11:00-11:45", "12:15-13:00", "13:00-13:45", "14:00-14:45", "14:45-15:30"];

// Håndter innloggingstilstad
onAuthStateChanged(auth, async (user) => {
    const loginOverlay = document.getElementById('loginOverlay');
    const mainApp = document.getElementById('mainApp');
    
    if (user) {
        console.log("Bruker er logget inn:", user.email);
        loginOverlay.style.display = 'none';
        mainApp.style.display = 'flex';
        
        // Sjekk admin-tilgang
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            document.getElementById('adminSaveBtn').style.display = 'inline-block';
        }
        renderTable();
        loadData();
    } else {
        console.log("Ingen bruker logget inn.");
        loginOverlay.style.display = 'flex';
        mainApp.style.display = 'none';
    }
});

function renderTable() {
    const body = document.getElementById('planBody');
    if (!body) return;
    body.innerHTML = tider.map((tid, i) => `
        <tr>
            <td>${tid}</td>
            ${Array(5).fill(0).map((_, j) => `<td id="cell-${i}-${j}" class="drop-zone"></td>`).join('')}
        </tr>`).join('');
    setupDragDrop();
}

function setupDragDrop() {
    document.querySelectorAll('.fag-item').forEach(item => {
        item.ondragstart = (e) => {
            e.dataTransfer.setData("text", e.target.innerText + "|" + e.target.style.backgroundColor);
        };
    });
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.ondragover = (e) => e.preventDefault();
        zone.ondrop = (e) => {
            const data = e.dataTransfer.getData("text");
            if (!data) return;
            const [txt, bg] = data.split('|');
            zone.innerHTML = `<div style="background:${bg}; padding:10px; border-radius:8px; font-weight:800; border:2px solid #000; font-size:12px; margin:2px;">${txt}</div>`;
        };
    });
}

// Knappeklikk
document.getElementById('loginBtn').addEventListener('click', () => {
    console.log("Login-knapp trykket");
    signInWithPopup(auth, provider).catch(err => console.error("Login feilet:", err));
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth);
});

document.getElementById('adminSaveBtn').addEventListener('click', async () => {
    const cells = Array.from(document.querySelectorAll('.drop-zone')).map(td => ({ id: td.id, html: td.innerHTML }));
    await setDoc(doc(db, "ukeplaner", "hovedplan"), { cells });
    alert("Planen er lagret!");
});

function loadData() {
    onSnapshot(doc(db, "ukeplaner", "hovedplan"), (doc) => {
        if (doc.exists()) {
            doc.data().cells.forEach(c => {
                const el = document.getElementById(c.id);
                if (el) el.innerHTML = c.html;
            });
        }
    });
}
