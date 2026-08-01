// 1. Φτιάχνουμε μια μεταβλητή για να κρατάει το συνολικό ποσό των εξόδων (ξεκινάει από το 0)
let totalExpenses = 0;

// 2. Λέμε στη JavaScript να βρει το κουμπί και τα πεδία από την HTML σελίδα μας
const addBtn = document.getElementById('addExpenseBtn');
const expenseNameInput = document.getElementById('expenseName');
const expenseAmountInput = document.getElementById('expenseAmount');
const totalDisplay = document.getElementById('totalDisplay');
const expenseList = document.getElementById('expenseList');

// 3. Λέμε στο κουμπί: "Όταν ο χρήστης σε ΠΑΤΗΣΕΙ (click), κάνε τα παρακάτω"
addBtn.addEventListener('click', function() {
    
    // Α) Παίρνουμε το κείμενο και το ποσό που έγραψε ο χρήστης
    const name = expenseNameInput.value;
    const amount = Number(expenseAmountInput.value); // Μετατρέπουμε το κείμενο σε κανονικό αριθμό

    // Β) Έλεγχος: Αν ο χρήστης ξέχασε να γράψει όνομα ή έβαλε 0 ευρώ, σταμάτα εδώ
    if (name === "" || amount <= 0) {
        alert("Παρακαλώ γράψε ένα έξοδο και ένα έγκυρο ποσό!");
        return; 
    }

    // Γ) Προσθέτουμε το νέο ποσό στα συνολικά μας έξοδα
    totalExpenses = totalExpenses + amount;

    // Δ) Ενημερώνουμε την οθόνη με το νέο σύνολο
    totalDisplay.textContent = totalExpenses;

    // Ε) Φτιάχνουμε μια νέα γραμμή στη λίστα (π.χ. "Καφές: 3.5€")
    const newRow = document.createElement('li');
    newRow.textContent = name + ": " + amount + "€";
    
    // ΣΤ) Βάζουμε αυτή τη γραμμή μέσα στο "Ιστορικό Εξόδων" στην οθόνη
    expenseList.appendChild(newRow);

    // Ζ) Αδειάζουμε τα κουτάκια για να είναι έτοιμα για το επόμενο έξοδο
    expenseNameInput.value = "";
    expenseAmountInput.value = "";
});
