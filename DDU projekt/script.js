// Globale funktioner
async function login() {
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value;
    try {
        const users = await fetchUsers();
        let user = users.find(u => u.username === username && u.password === password);
        if (user) {
            currentUser = username;
            document.getElementById("loginScreen").style.display = "none";
            document.getElementById("chatScreen").style.display = "block";
            document.getElementById("currentUserName").innerText = username;
            updateRecipientList();
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

function showCreateUser() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("createUserScreen").style.display = "block";
}

function backToLogin() {
    document.getElementById("createUserScreen").style.display = "none";
    document.getElementById("loginScreen").style.display = "block";
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
            private_key_n: userKeys.privateKey.n.toString()
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
            encrypted: encrypted.join(", "),
            hash: hash,
            folder: "inbox"
        });
        if (error) throw new Error(error.message || "Ukendt fejl ved afsendelse");
        document.getElementById("output").innerText = "Besked sendt til " + recipient + "!";
        document.getElementById("message").value = "";
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
        let encryptedText = message.encrypted.split(",").map(num => BigInt(num.trim()));
        const users = await fetchUsers();
        let currentUserData = users.find(u => u.username === currentUser);
        if (!currentUserData) throw new Error("Bruger ikke fundet!");
        let decrypted = window.decryptMessage(encryptedText, currentUserData.keys.privateKey);
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
        const { data, error } = await supabase
            .from("messages")
            .update({ folder: folder })
            .eq("id", currentMessageId)
            .select(); // Tilføj select for at få den opdaterede række
        if (error) throw new Error(error.message || "Ukendt fejl ved flytning");
        if (data && data.length > 0) {
            console.log("Besked flyttet til:", folder, data[0]);
        }
        // Opdater visningen korrekt ved at genindlæse den aktuelle mappe
        backToInbox();
        await showFolder(currentFolder); // Vent på, at folderen genindlæses
    } catch (error) {
        console.error("Fejl ved flytning af besked:", error);
        alert("Fejl ved flytning af besked: " + error.message);
    }
}

function backToInbox() {
    document.getElementById("messageView").style.display = "none";
    document.getElementById("chatScreen").style.display = "block";
}

async function switchUser() {
    let selectedUser = document.getElementById("switchUser").value;
    currentUser = selectedUser;
    document.getElementById("currentUserName").innerText = selectedUser;
    updateRecipientList();
    showFolder("inbox");
    document.getElementById("output").innerText = "Skiftet til " + selectedUser;
}

async function fetchUsers() {
    try {
        const { data, error } = await supabase.from("users").select("*");
        if (error) throw new Error(error.message || "Ukendt fejl ved hentning af brugere");
        return data.map(user => ({
            username: user.username,
            password: user.password,
            keys: {
                publicKey: { e: BigInt(user.public_key_e), n: BigInt(user.public_key_n) },
                privateKey: { d: BigInt(user.private_key_d), n: BigInt(user.private_key_n) }
            }
        }));
    } catch (error) {
        console.error("Fejl ved hentning af brugere:", error);
        return [];
    }
}

async function fetchMessages() {
    try {
        const { data, error } = await supabase.from("messages").select("*");
        if (error) throw new Error(error.message || "Ukendt fejl ved hentning af beskeder");
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

let currentFolder = "inbox";

async function showFolder(folder) {
    currentFolder = folder;
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
        messageDiv.className = "messageItem";
        messageDiv.innerHTML = `Fra: ${msg.sender}`;
        messageDiv.onclick = () => openMessage(msg);
        inboxList.appendChild(messageDiv);
    });
}

function openMessage(message) {
    currentMessageId = message.id;
    document.getElementById("chatScreen").style.display = "none";
    document.getElementById("messageView").style.display = "block";
    document.getElementById("messageSender").innerText = message.sender;
    document.getElementById("encryptedMessage").innerText = message.encrypted;
    document.getElementById("originalHash").innerText = message.hash;
    document.getElementById("decryptedOutput").innerText = "";
    document.getElementById("hashComparison").innerText = "";
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

// Initialiser Supabase
const SUPABASE_URL = "https://rwrojiienyguarwlrybu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3cm9qaWllbnlndWFyd2xyeWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzNjIzNjksImV4cCI6MjA1NjkzODM2OX0.cHaVzzBj7xwy4JJZSpdR69IwHfiXm_bMQ_lhM91F50s";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
