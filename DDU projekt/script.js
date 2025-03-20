// script.js
const SUPABASE_URL = "https://rwrojiienyguarwlrybu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3cm9qaWllbnlndWFyd2xyeWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzNjIzNjksImV4cCI6MjA1NjkzODM2OX0.cHaVzzBj7xwy4JJZSpdR69IwHfiXm_bMQ_lhM91F50s";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentFolder = "inbox";

// Standardmapper, som altid skal være til stede
const DEFAULT_FOLDERS = ["inbox", "saved", "slettet"];

// RSA-funktioner
function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) return false;
    }
    return true;
}

function generateRandomPrime(min, max) {
    let num = Math.floor(Math.random() * (max - min + 1)) + min;
    while (!isPrime(num)) {
        num++;
        if (num > max) num = min;
    }
    return BigInt(num);
}

window.gcd = function(a, b) {
    while (b !== 0n) {
        [a, b] = [b, a % b];
    }
    return a;
};

window.modInverse = function(e, phi) {
    let m0 = phi, t, q;
    let x0 = 0n, x1 = 1n;
    if (phi === 1n) return 0n;

    while (e > 1n) {
        q = e / phi;
        t = phi;
        phi = e % phi, e = t;
        t = x0;
        x0 = x1 - q * x0;
        x1 = t;
    }

    return x1 < 0n ? x1 + m0 : x1;
};

window.generateKeys = function() {
    let p = generateRandomPrime(50, 200);
    let q = generateRandomPrime(50, 200);
    while (p === q) {
        q = generateRandomPrime(50, 200);
    }

    let n = p * q;
    let phi = (p - 1n) * (q - 1n);

    let e = 3n;
    while (window.gcd(e, phi) !== 1n) {
        e += 2n;
    }

    let d = window.modInverse(e, phi);

    console.log("Genereret nøgler:", { p, q, n, e, d });
    return { publicKey: { e, n }, privateKey: { d, n } };
};

window.modPow = function(base, exponent, modulus) {
    let result = 1n;
    base = base % modulus;
    while (exponent > 0n) {
        if (exponent & 1n) result = (result * base) % modulus;
        base = (base * base) % modulus;
        exponent >>= 1n;
    }
    return result;
};

window.encryptMessage = function(message, publicKey) {
    let encrypted = [];
    for (let char of message) {
        let ascii = BigInt(char.charCodeAt(0));
        let encryptedChar = window.modPow(ascii, publicKey.e, publicKey.n);
        encrypted.push(encryptedChar);
        console.log(`Krypterer tegn '${char}' (ASCII: ${ascii}) -> ${encryptedChar}`);
    }
    return encrypted;
};

window.decryptMessage = function(encrypted, privateKey) {
    let decrypted = "";
    for (let num of encrypted) {
        let decryptedChar = window.modPow(num, privateKey.d, privateKey.n);
        decrypted += String.fromCharCode(Number(decryptedChar));
        console.log(`Dekrypterer tal ${num} -> ASCII: ${decryptedChar} -> Tegn: '${String.fromCharCode(Number(decryptedChar))}'`);
    }
    return decrypted;
};

// Debug: Tjek, om funktionerne er defineret
console.log("Er window.encryptMessage defineret?", typeof window.encryptMessage);
console.log("Er window.decryptMessage defineret?", typeof window.decryptMessage);

function showWelcomeScreen() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("createUserScreen").style.display = "none";
    document.getElementById("welcomeScreen").style.display = "flex";
}

function showLogin() {
    document.getElementById("welcomeScreen").style.display = "none";
    document.getElementById("loginScreen").style.display = "block";
}

function showCreateUser() {
    document.getElementById("welcomeScreen").style.display = "none";
    document.getElementById("createUserScreen").style.display = "block";
}

function backToLogin() {
    document.getElementById("createUserScreen").style.display = "none";
    document.getElementById("loginScreen").style.display = "block";
    document.getElementById("welcomeScreen").style.display = "none";
}

function logout() {
    currentUser = null;
    currentFolder = "inbox";
    document.getElementById("chatScreen").style.display = "none";
    document.getElementById("welcomeScreen").style.display = "flex";
}

async function login() {
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value;
    try {
        const users = await fetchUsers();
        let user = users.find(u => u.username === username && u.password === password);
        if (user) {
            currentUser = username;
            document.getElementById("loginScreen").style.display = "none";
            document.getElementById("chatScreen").style.display = "flex";
            document.getElementById("currentUserName").innerText = username;
            updateRecipientList();
            updateFolderList();
            showFolder("inbox");
            updateUserSwitcher();
        } else {
            document.getElementById("loginOutput").innerText = "Forkert brugernavn eller adgangskode!";
        }
    } catch (error) {
        console.error("Fejl ved login:", error);
        document.getElementById("loginOutput").innerText = "Fejl ved login: " + error.message;
    }
}

async function addUser() {
    let newUser = document.getElementById("newUser").value.trim();
    let newPassword = document.getElementById("newPassword").value;
    if (!newUser || !newPassword) {
        document.getElementById("loginOutput").innerText = "Udfyld både brugernavn og adgangskode!";
        backToLogin();
        return;
    }
    try {
        const users = await fetchUsers();
        if (users.some(u => u.username === newUser)) {
            document.getElementById("loginOutput").innerText = "Brugernavn findes allerede!";
            backToLogin();
            return;
        }
        let userKeys = window.generateKeys();
        const { data, error } = await supabase.from("users").insert({
            username: newUser,
            password: newPassword,
            public_key_e: userKeys.publicKey.e.toString(),
            public_key_n: userKeys.publicKey.n.toString(),
            private_key_d: userKeys.privateKey.d.toString(),
            private_key_n: userKeys.privateKey.n.toString(),
            folders: DEFAULT_FOLDERS
        }).select();
        if (error) {
            throw new Error(error.message || "Ukendt fejl ved oprettelse");
        }
        console.log("Bruger oprettet:", data);
        document.getElementById("newUser").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("loginOutput").innerText = "Oprettelse lykkedes!";
        backToLogin();
    } catch (error) {
        console.error("Fejl ved oprettelse af bruger:", error);
        document.getElementById("loginOutput").innerText = "Fejl ved oprettelse af bruger: " + error.message;
        backToLogin();
    }
}

function showCompose() {
    document.getElementById("chatScreen").style.display = "none";
    document.getElementById("composeScreen").style.display = "block";
}

function backToChat() {
    document.getElementById("composeScreen").style.display = "none";
    document.getElementById("createFolderScreen").style.display = "none";
    document.getElementById("chatScreen").style.display = "flex";
    showFolder(currentFolder);
}

function showCreateFolder() {
    document.getElementById("chatScreen").style.display = "none";
    document.getElementById("createFolderScreen").style.display = "block";
}

async function createFolder() {
    let folderName = document.getElementById("newFolderName").value.trim();
    if (!folderName) {
        alert("Indtast et mappenavn!");
        return;
    }
    // Valider mappenavn (ingen specialtegn, kun bogstaver og tal)
    if (!/^[a-zA-Z0-9]+$/.test(folderName)) {
        alert("Mappenavnet må kun indeholde bogstaver og tal!");
        return;
    }
    try {
        const users = await fetchUsers();
        let user = users.find(u => u.username === currentUser);
        if (!user) throw new Error("Bruger ikke fundet!");
        let folders = user.folders || DEFAULT_FOLDERS;
        let newFolder = folderName.toLowerCase();
        if (folders.includes(newFolder)) {
            alert("Mappen findes allerede!");
            return;
        }
        folders.push(newFolder);
        console.log("Forsøger at opdatere folders til:", folders);
        const { data, error } = await supabase
            .from("users")
            .update({ folders: folders })
            .eq("username", currentUser)
            .select();
        if (error) throw new Error(error.message || "Ukendt fejl ved oprettelse af mappe");
        if (!data || data.length === 0) {
            throw new Error("Ingen rækker blev opdateret. Tjek RLS-policy eller brugertilladelser.");
        }
        console.log("Opdateret bruger i Supabase:", data);
        document.getElementById("newFolderName").value = "";
        alert(`Mappen "${folderName}" blev oprettet!`);
        backToChat();
        updateFolderList();
    } catch (error) {
        console.error("Fejl ved oprettelse af mappe:", error);
        alert("Fejl ved oprettelse af mappe: " + error.message);
    }
}

async function updateFolderList() {
    let folderList = document.getElementById("folderList");
    folderList.innerHTML = "";
    const users = await fetchUsers();
    let user = users.find(u => u.username === currentUser);
    let folders = user.folders || DEFAULT_FOLDERS;
    console.log("Hentede mapper fra Supabase:", folders);
    DEFAULT_FOLDERS.forEach(defaultFolder => {
        if (!folders.includes(defaultFolder)) {
            folders.push(defaultFolder);
        }
    });
    folders.forEach(folder => {
        let folderItem = document.createElement("div");
        folderItem.className = "folder-item";
        if (folder === currentFolder) folderItem.classList.add("active");
        folderItem.innerText = folder.charAt(0).toUpperCase() + folder.slice(1);
        folderItem.onclick = () => showFolder(folder);
        folderList.appendChild(folderItem);
    });
}

async function updateMoveToFolderList() {
    let moveToFolderSelect = document.getElementById("moveToFolder");
    moveToFolderSelect.innerHTML = "";
    const users = await fetchUsers();
    let user = users.find(u => u.username === currentUser);
    let folders = user.folders || DEFAULT_FOLDERS;
    folders.forEach(folder => {
        if (folder !== currentFolder) {
            let option = document.createElement("option");
            option.value = folder;
            option.text = folder.charAt(0).toUpperCase() + folder.slice(1);
            moveToFolderSelect.appendChild(option);
        }
    });
}

async function sendMessage() {
    try {
        let message = document.getElementById("message").value;
        let recipient = document.getElementById("recipient").value;
        if (!message) throw new Error("Ingen besked indtastet!");
        const users = await fetchUsers();
        let recipientUser = users.find(u => u.username === recipient);
        if (!recipientUser) throw new Error("Modtager ikke fundet!");
        let encrypted = window.encryptMessage(message, recipientUser.keys.publicKey);
        let hash = await generateHash(message);
        const { error } = await supabase.from("messages").insert({
            sender: currentUser,
            recipient: recipient,
            encrypted: encrypted.map(num => num.toString()),
            hash: hash,
            folder: "inbox"
        });
        if (error) throw new Error(error.message || "Ukendt fejl ved afsendelse");
        document.getElementById("output").innerText = "Besked sendt til " + recipient + "!";
        document.getElementById("message").value = "";
        backToChat();
    } catch (error) {
        console.error("Fejl ved kryptering:", error);
        document.getElementById("output").innerText = "Fejl ved kryptering: " + error.message;
    }
}

let currentMessageId = null;

async function decryptAndCompare() {
    try {
        const messages = await fetchMessages();
        const message = messages.find(msg => msg.id === currentMessageId);
        if (!message) throw new Error("Besked ikke fundet!");
        let encryptedArray = message.encrypted.map(num => BigInt(num));
        const users = await fetchUsers();
        let currentUserData = users.find(u => u.username === currentUser);
        if (!currentUserData) throw new Error("Bruger ikke fundet!");
        let decrypted = window.decryptMessage(encryptedArray, currentUserData.keys.privateKey);
        let newHash = await generateHash(decrypted);
        let originalHash = message.hash;
        document.getElementById("decryptedOutput").innerText = "Dekrypteret besked: " + decrypted;
        document.getElementById("hashComparison").innerText = 
            newHash === originalHash 
                ? "Hash-sammenligning: Matchet! Beskeden er ikke blevet ændret."
                : "Hash-sammenligning: Matchede ikke! Beskeden kan være blevet ændret.";
    } catch (error) {
        console.error("Fejl ved dekryptering:", error);
        document.getElementById("decryptedOutput").innerText = "Fejl ved dekryptering: " + error.message;
    }
}

async function moveMessage(folder) {
    try {
        if (!currentMessageId) throw new Error("Ingen besked valgt!");
        if (!folder) throw new Error("Vælg en mappe at flytte til!");
        const { data, error } = await supabase
            .from("messages")
            .update({ folder: folder })
            .eq("id", currentMessageId)
            .select();
        if (error) throw new Error(error.message || "Ukendt fejl ved flytning");
        if (data && data.length > 0) {
            console.log("Besked flyttet til:", folder, data[0]);
            alert(`Beskeden blev flyttet til "${folder.charAt(0).toUpperCase() + folder.slice(1)}"!`);
        }
        backToInbox();
        await showFolder(currentFolder);
    } catch (error) {
        console.error("Fejl ved flytning af besked:", error);
        alert("Fejl ved flytning af besked: " + error.message);
    }
}

function backToInbox() {
    document.getElementById("messageView").style.display = "none";
}

async function switchUser() {
    let selectedUser = document.getElementById("switchUser").value;
    currentUser = selectedUser;
    document.getElementById("currentUserName").innerText = selectedUser;
    updateRecipientList();
    updateFolderList();
    showFolder("inbox");
}

async function fetchUsers() {
    try {
        const { data, error } = await supabase.from("users").select("*");
        if (error) throw error;
        return data.map(user => ({
            username: user.username,
            password: user.password,
            keys: {
                publicKey: { e: BigInt(user.public_key_e), n: BigInt(user.public_key_n) },
                privateKey: { d: BigInt(user.private_key_d), n: BigInt(user.private_key_n) }
            },
            folders: user.folders || DEFAULT_FOLDERS
        }));
    } catch (error) {
        console.error("Fejl ved hentning af brugere:", error);
        return [];
    }
}

async function fetchMessages() {
    try {
        const { data, error } = await supabase.from("messages").select("*");
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Fejl ved hentning af beskeder:", error);
        return [];
    }
}

async function updateRecipientList() {
    let recipientSelect = document.getElementById("recipient");
    recipientSelect.innerHTML = "";
    const users = await fetchUsers();
    users.forEach(user => {
        if (user.username !== currentUser) {
            let option = document.createElement("option");
            option.value = user.username;
            option.text = user.username.charAt(0).toUpperCase() + user.username.slice(1);
            recipientSelect.appendChild(option);
        }
    });
}

async function showFolder(folder) {
    currentFolder = folder;
    document.getElementById("messageView").style.display = "none";
    updateFolderList();
    let inboxList = document.getElementById("inboxList");
    inboxList.innerHTML = "";
    const messages = await fetchMessages();
    const filteredMessages = messages.filter(msg => msg.recipient === currentUser && msg.folder === folder);
    if (filteredMessages.length === 0) {
        inboxList.innerHTML = "<p>Ingen beskeder i denne mappe.</p>";
        return;
    }
    filteredMessages.forEach(msg => {
        let messageDiv = document.createElement("div");
        messageDiv.className = "message-item";
        let preview = msg.encrypted.slice(0, 5).join(", ") + "...";
        messageDiv.innerHTML = `
            <div>Fra: ${msg.sender}</div>
            <div>${preview}</div>
        `;
        messageDiv.onclick = () => openMessage(msg);
        inboxList.appendChild(messageDiv);
    });
}

function openMessage(message) {
    currentMessageId = message.id;
    document.getElementById("messageView").style.display = "block";
    document.getElementById("messageSender").innerText = message.sender;
    document.getElementById("encryptedMessage").innerText = message.encrypted.join(", ");
    document.getElementById("originalHash").innerText = message.hash;
    document.getElementById("decryptedOutput").innerText = "";
    document.getElementById("hashComparison").innerText = "";
    updateMoveToFolderList();
}

async function updateUserSwitcher() {
    let switcher = document.getElementById("switchUser");
    switcher.innerHTML = "";
    const users = await fetchUsers();
    users.forEach(user => {
        let option = document.createElement("option");
        option.value = user.username;
        option.text = user.username.charAt(0).toUpperCase() + user.username.slice(1);
        if (user.username === currentUser) {
            option.selected = true;
        }
        switcher.appendChild(option);
    });
}

async function generateHash(message) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        return hashHex;
    } catch (error) {
        console.error("Fejl i hash-generering:", error);
        throw error;
    }
}

// Lyt efter "Enter" på login-skærmen
document.getElementById("username").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        login();
    }
});

document.getElementById("password").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        login();
    }
});

// Lyt efter "Enter" i beskedfeltet
document.getElementById("message").addEventListener("keypress", function(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
