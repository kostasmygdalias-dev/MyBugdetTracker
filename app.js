// ==========================================
// ΜΕΡΟΣ 1: ΣΥΝΔΕΣΗ ΜΕ SUPABASE & ΥΠΕΡ-ΤΑΧΕΙΑ ΦΟΡΤΩΣΗ
// ==========================================

// ΑΝΤΙΚΑΤΑΣΤΗΣΕ ΜΕ ΤΑ ΔΙΚΑ ΣΟΥ ΣΤΟΙΧΕΙΑ ΑΠΟ ΤΟ SUPABASE: SETTINGS -> API
const SUPABASE_URL = "https://uyapnscadjnsdivmxeqt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YXBuc2NhZGpuc2Rpdm14ZXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDI0MzksImV4cCI6MjEwMTE3ODQzOX0.idM0d0LaAnYOhoOWurNRGh_G7rRR1EZBsmPHnzTpLJE";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Φορτώνουμε ΑΜΕΣΩΣ τα παλιά δεδομένα από το cache για να μην βλέπεις λευκή οθόνη
let transactions = JSON.parse(localStorage.getItem('quantum_ledger_cache')) || [];
let recurringTemplates = JSON.parse(localStorage.getItem('quantum_recurring_cache')) || [];

// Σύνδεση με HTML στοιχεία
const transName = document.getElementById('transName');
const transAmount = document.getElementById('transAmount');
const transMonthYear = document.getElementById('transMonthYear');
const transType = document.getElementById('transType');
const addTransactionBtn = document.getElementById('addTransactionBtn');
const transactionList = document.getElementById('transactionList');

const recurName = document.getElementById('recurName');
const recurAmount = document.getElementById('recurAmount');
const recurType = document.getElementById('recurType');
const addRecurringBtn = document.getElementById('addRecurringBtn');
const recurringList = document.getElementById('recurringList');

const viewYear = document.getElementById('viewYear');
const viewMonth = document.getElementById('viewMonth');

const now = new Date();
transMonthYear.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// ⚡ ΠΡΟΗΓΜΕΝΗ ΦΟΡΤΩΣΗ: Παράλληλη και με Cache για άμεσο άνοιγμα
async function loadDataFromCloud() {
    try {
        // Τραβάμε και τους δύο πίνακες ΤΑΥΤΟΧΡΟΝΑ για να γλυτώσουμε χρόνο
        const [ledgerRes, recurRes] = await Promise.all([
            supabase.from('quantum_ledger').select('*'),
            supabase.from('quantum_recurring').select('*')
        ]);

        if (!ledgerRes.error) {
            transactions = ledgerRes.data || [];
            localStorage.setItem('quantum_ledger_cache', JSON.stringify(transactions));
        }
        if (!recurRes.error) {
            recurringTemplates = recurRes.data || [];
            localStorage.setItem('quantum_recurring_cache', JSON.stringify(recurringTemplates));
        }
    } catch (e) {
        console.log("Offline mode - Using cache data");
    }

    // Ανανέωση της οθόνης αμέσως
    updateDashboard();
}

// Λειτουργία: Ορισμός Νέας Πάγιας Εντολής στο Cloud
addRecurringBtn.addEventListener('click', async () => {
    const name = recurName.value;
    const amount = Number(recurAmount.value);
    const type = recurType.value;

    if (name === "" || amount <= 0) return alert("Συμπληρώστε σωστά τα στοιχεία!");

    // Αισιόδοξη ενημέρωση (Optimistic UI) για να φανεί αμέσως στην οθόνη χωρίς καθυστέρηση
    recurringTemplates.push({ id: Date.now(), name, amount, type });
    updateDashboard();

    const { error } = await supabase.from('quantum_recurring').insert([{ name, amount, type }]);
    
    recurName.value = "";
    recurAmount.value = "";
    await loadDataFromCloud();
});

// Λειτουργία: Προσθήκη Μεμονωμένης Συναλλαγής στο Cloud
addTransactionBtn.addEventListener('click', async () => {
    const name = transName.value;
    const amount = Number(transAmount.value);
    const monthYearValue = transMonthYear.value;
    const typeValue = transType.value;

    if (name === "" || amount <= 0 || monthYearValue === "") return alert("Συμπληρώστε όλα τα στοιχεία!");

    const [yearPart, monthPart] = monthYearValue.split('-');
    const parsedMonthIndex = (parseInt(monthPart) - 1).toString();

    // Εμφάνιση στην οθόνη ΑΜΕΣΩΣ, πριν καν απαντήσει το ίντερνετ
    transactions.push({ id: Date.now(), name, amount, year: yearPart, month: parsedMonthIndex, type: typeValue });
    updateDashboard();

    await supabase.from('quantum_ledger').insert([
        { name, amount, year: yearPart, month: parsedMonthIndex, type: typeValue }
    ]);
    
    transName.value = "";
    transAmount.value = "";
    await loadDataFromCloud();
});

viewYear.addEventListener('change', updateDashboard);
viewMonth.addEventListener('change', updateDashboard);

// Λειτουργία: Διαγραφή Πάγιας Εντολής από το Cloud
window.deleteRecurring = async function(id) {
    if(confirm("Κατάργηση αυτής της πάγιας εντολής;")) {
        recurringTemplates = recurringTemplates.filter(r => r.id !== id);
        updateDashboard();
        await supabase.from('quantum_recurring').delete().eq('id', id);
        await loadDataFromCloud();
    }
};

// Λειτουργία: Αλλαγή Τιμής Πάγιου Εξόδου στο Cloud
window.editRecurringPrice = async function(id) {
    const newPrice = Number(prompt("Εισάγετε τη νέα τιμή:"));
    if (isNaN(newPrice) || newPrice <= 0) return alert("Μη έγκυρη τιμή!");

    recurringTemplates = recurringTemplates.map(r => r.id === id ? {...r, amount: newPrice} : r);
    updateDashboard();

    await supabase.from('quantum_recurring').update({ amount: newPrice }).eq('id', id);
    await loadDataFromCloud();
};

// Λειτουργία: Διαγραφή Απλής Συναλλαγής από το Cloud
window.deleteTransaction = async function(id) {
    if(confirm("Διαγραφή συναλλαγής;")) {
        transactions = transactions.filter(t => t.id !== id);
        updateDashboard();
        await supabase.from('quantum_ledger').delete().eq('id', id);
        await loadDataFromCloud();
    }
};
// ==========================================
// ΜΕΡΟΣ 2: ΜΗΧΑΝΗ ΥΠΟΛΟΓΙΣΜΩΝ & ΕΜΦΑΝΙΣΗ (UI)
// ==========================================

function updateDashboard() {
    const selectedYear = viewYear.value;
    const selectedMonth = viewMonth.value;

    let totalIncome = 0;
    let totalExpense = 0;
    let categoryTotals = { 
        'Φαγητό/Super Market': 0, 
        'Λογαριασμοί/Ενοίκιο': 0, 
        'Διασκέδαση/Ψώνια': 0, 
        'Άλλα/Διάφορα': 0 
    };

    // Σχεδίαση Λίστας Πάγιων Εντολών στην οθόνη
    recurringList.innerHTML = "";
    recurringTemplates.forEach(recur => {
        const li = document.createElement('li');
        li.className = "compact-li";
        li.innerHTML = `
            <span>🤖 ${recur.name}: <b>${recur.amount}€</b></span>
            <div>
                <button onclick="editRecurringPrice(${recur.id})" class="edit-btn" style="background:rgba(0,255,255,0.2); border:1px solid #00ffff; color:#00ffff; padding:2px 5px; font-size:9px; border-radius:3px; margin-right:4px;">Αλλαγή</button>
                <button onclick="deleteRecurring(${recur.id})" class="delete-btn">X</button>
            </div>
        `;
        recurringList.appendChild(li);
    });

    transactionList.innerHTML = "";
    const monthNames = ["Ιαν", "Φεβ", "Μάρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"];

    // Δημιουργούμε προσωρινή λίστα για να ενώσουμε κανονικά αρχεία και πάγια
    let activeList = [...transactions];

    // ΑΥΤΟΜΑΤΗ ΕΓΧΥΣΗ ΠΑΓΙΩΝ: Υπολογισμός και "γέννηση" των πάγιων στην οθόνη
    if (selectedMonth !== 'all') {
        recurringTemplates.forEach(recur => {
            activeList.push({
                id: 'recur-' + recur.id,
                name: `[Πάγιο] ${recur.name}`,
                amount: recur.amount,
                year: selectedYear,
                month: selectedMonth,
                type: recur.type,
                isAuto: true
            });
        });
    } else {
        // Αν βλέπουμε όλο το έτος, παράγουμε τα πάγια για όλους τους 12 μήνες
        for (let m = 0; m < 12; m++) {
            recurringTemplates.forEach(recur => {
                activeList.push({
                    id: 'recur-' + recur.id + '-' + m,
                    name: `[Πάγιο] ${recur.name}`,
                    amount: recur.amount,
                    year: selectedYear,
                    month: m.toString(),
                    type: recur.type,
                    isAuto: true
                });
            });
        }
    }

    // Φιλτράρισμα και επεξεργασία της ενιαίας λίστας
    activeList.forEach(trans => {
        const matchYear = trans.year === selectedYear;
        const matchMonth = (selectedMonth === 'all') || (trans.month === selectedMonth);

        if (matchYear && matchMonth) {
            if (trans.type === 'income') {
                totalIncome += trans.amount;
            } else {
                totalExpense += trans.amount;
                if (trans.type === 'expense-food') categoryTotals['Φαγητό/Super Market'] += trans.amount;
                if (trans.type === 'expense-bills') categoryTotals['Λογαριασμοί/Ενοίκιο'] += trans.amount;
                if (trans.type === 'expense-fun') categoryTotals['Διασκέδαση/Ψώνια'] += trans.amount;
                if (trans.type === 'expense-other') categoryTotals['Άλλα/Διάφορα'] += trans.amount;
            }

            const li = document.createElement('li');
            const isIncome = trans.type === 'income';
            li.style.borderLeft = isIncome ? "4px solid #00ff88" : "4px solid #ff0055";
            if(trans.isAuto) li.style.background = "rgba(0, 255, 255, 0.02)"; 

            li.innerHTML = `
                <div>
                    <small style="color:#8a8a9e; display:block;">${monthNames[parseInt(trans.month)]} ${trans.year}</small>
                    <span>${trans.name}</span>
                </div>
                <div>
                    <b style="color: ${isIncome ? '#00ff88' : '#ff0055'}; margin-right:10px;">
                        ${isIncome ? '+' : '-'}${trans.amount}€
                    </b>
                    ${trans.isAuto ? '<span style="color:#00ffff; font-size:10px;">🤖 Auto</span>' : `<button onclick="deleteTransaction(${trans.id})" class="delete-btn">X</button>`}
                </div>
            `;
            transactionList.appendChild(li);
        }
    });

    // Υπολογισμός και εμφάνιση του Καθαρού Κέρδους
    const netProfit = totalIncome - totalExpense;
    document.getElementById('totalIncomeDisplay').textContent = totalIncome + "€";
    document.getElementById('totalExpenseDisplay').textContent = totalExpense + "€";
    document.getElementById('netProfitDisplay').textContent = netProfit + "€";
    document.getElementById('netProfitDisplay').style.color = netProfit >= 0 ? "#00ffff" : "#ff0055";

    // Σχεδίαση των στατιστικών μπαρών (Πού τα έφαγες)
    let analyticsHTML = "<h4>📊 Πού ξοδεύτηκαν τα χρήματα:</h4>";
    if (totalExpense === 0) {
        analyticsHTML += "<p style='margin:0;'>Δεν υπάρχουν έξοδα.</p>";
    } else {
        for (let cat in categoryTotals) {
            const catAmount = categoryTotals[cat];
            const percentage = ((catAmount / totalExpense) * 100).toFixed(0);
            if (catAmount > 0) {
                analyticsHTML += `
                    <div style="margin-bottom: 8px;">
                        <div style="display:flex; justify-content:space-between; font-size:11px;">
                            <span>${cat}</span>
                            <span><b>${catAmount}€</b> (${percentage}%)</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); border-radius:5px; height: 5px; width: 100%; margin-top:3px;">
                            <div style="background: linear-gradient(90deg, #ff007f, #00ffff); height: 100%; width: ${percentage}%; border-radius:5px;"></div>
                        </div>
                    </div>
                `;
            }
        }
    }
    document.getElementById('analyticsContent').innerHTML = analyticsHTML;
}

// Λειτουργία για την αυτόματη συμπλήρωση μέσω των Quick Tags (Μεμονωμένα)
document.querySelectorAll('.tag-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        transName.value = e.target.getAttribute('data-name');
        transType.value = e.target.getAttribute('data-category');
        transAmount.focus();
    });
});

// Λειτουργία για την αυτόματη συμπλήρωση μέσω των Quick Tags (Πάγια)
document.querySelectorAll('.recur-tag-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        recurName.value = e.target.getAttribute('data-name');
        recurType.value = e.target.getAttribute('data-category');
        recurAmount.focus();
    });
});

// Εκκίνηση της οθόνης με άμεση σχεδίαση από Cache (Και ανανέωση στο παρασκήνιο)
updateDashboard();
loadDataFromCloud();
