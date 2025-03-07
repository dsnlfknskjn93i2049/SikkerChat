function sendMessage() {
    let message = document.getElementById("message").value;
    alert("Besked sendt: " + message);
}
document.addEventListener("DOMContentLoaded", async function () {
    if (typeof window.generateKeys !== "function") {
        console.error("Fejl: RSA-funktioner fra rsa.js er ikke indlæst!");
        document.getElementById("loginOutput").innerText = "Fejl: RSA-funktioner mangler!";
        return;
    }

    // Initialiser Supabase
    const SUPABASE_URL = "https://rwrojiienyguarwlrybu.supabase.co"; // Erstat med din URL fra Supabase
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3cm9qaWllbnlndWFyd2xyeWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzNjIzNjksImV4cCI6MjA1NjkzODM2OX0.cHaVzzBj7xwy4JJZSpdR69IwHfiXm_bMQ_lhM91F50s"; // Erstat med din Anon Key fra Supabase
    const supabase = window.createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);

    let currentUser = null;

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

    async function fetchUsers() {
        const { data, error } = await supabase.from("users").select("*");
        if (error) {
            console.error("Fejl ved hentning af brugere:", error);
            return [];
        }
        return data.map(user => ({
            username: user.username,
            password: user.password,
            keys: {
                publicKey: { e: BigInt(user.public_key_e), n: BigInt(user.public_key_n) },
                privateKey: { d: BigInt(user.private_key_d), n: BigInt(user.private_key_n) }
            }
        }));
    }

    async function fetchMessages() {
        const { data, error } = await supabase.from("messages").select("*");
        if (error) {
            console.error("Fejl ved hentning af beskeder:", error);
            return [];
        }
        return data;
    }

    window.login = async function () {
        let username = document.getElementById("username").value.trim();
        let password = document.getElementById("password").value;
        const users = await fetchUsers();
        let user = users.find(u => u.username === username && u.password === password);
        if (user) {
            currentUser = username;
            document.getElementById("loginScreen").style.display = "none";
            document.getElementById("chatScreen").style.display = "block";
            document.getElementById("currentUserName").innerText = username;
            updateRecipientList();
            updateMessageBox();
            updateUserSwitcher();
        } else {
            document.getElementById("loginOutput").innerText = "Forkert brugernavn eller adgangskode!";
        }
    };

    window.showCreateUser = function () {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("createUserScreen").style.display = "block";
    };

    window.backToLogin = function () {
        document.getElementById("createUserScreen").style.display = "none";
        document.getElementById("loginScreen").style.display = "block";
    };

    window.addUser = async function () {
        let newUser = document.getElementById("newUser").value.trim();
        let newPassword = document.getElementById("newPassword").value;
        if (!newUser || !newPassword) {
            document.getElementById("loginOutput").innerText = "Udfyld både brugernavn og adgangskode!";
            window.backToLogin();
            return;
        }
        const users = await fetchUsers();
        if (users.some(u => u.username === newUser)) {
            document.getElementById("loginOutput").innerText = "Brugernavn findes allerede!";
            window.backToLogin();
            return;
        }
        try {
            let userKeys = window.generateKeys();
            const { error } = await supabase.from("users").insert({
                username: newUser,
                password: newPassword,
                public_key_e: userKeys.publicKey.e.toString(),
                public_key_n: userKeys.publicKey.n.toString(),
                private_key_d: userKeys.privateKey.d.toString(),
                private_key_n: userKeys.privateKey.n.toString()
            });
            if (error) throw error;
            document.getElementById("newUser").value = "";
            document.getElementById("newPassword").value = "";
            document.getElementById("loginOutput").innerText = "Oprettelse lykkedes!";
            window.backToLogin();
        } catch (error) {
            console.error("Fejl ved oprettelse af bruger:", error);
            document.getElementById("loginOutput").innerText = "Fejl ved oprettelse af bruger!";
            window.backToLogin();
        }
    };

    window.sendMessage = async function () {
        try {
            let message = document.getElementById("message").value;
            let recipient = document.getElementById("recipient").value;
            if (!message) throw new Error("Ingen besked indtastet!");
            const users = await fetchUsers();
            let recipientUser = users.find(u => u.username === recipient);
            let encrypted = window.encryptMessage(message, recipientUser.keys.publicKey);
            let hash = await generateHash(message);
            const { error } = await supabase.from("messages").insert({
                sender: currentUser,
                recipient: recipient,
                encrypted: encrypted.join(", "),
                hash: hash
            });
            if (error) throw error;
            document.getElementById("output").innerText = "Besked sendt til " + recipient + "!";
            document.getElementById("message").value = "";
            updateMessageBox();
        } catch (error) {
            console.error("Fejl ved kryptering:", error);
            document.getElementById("output").innerText = "Fejl ved kryptering: " + error.message;
        }
    };

    window.decryptMessageHandler = async function () {
        try {
            let inputText = document.getElementById("message").value;
            if (!inputText) throw new Error("Ingen krypteret besked indtastet!");
            if (!inputText.includes(",")) {
                throw new Error("Ugyldigt format! Indtast en kommasepareret liste af tal (fx 123, 456)");
            }
            let encryptedText = inputText.split(",").map(num => BigInt(num.trim()));
            const users = await fetchUsers();
            let currentUserData = users.find(u => u.username === currentUser);
            let decrypted = window.decryptMessage(encryptedText, currentUserData.keys.privateKey);
            let hash = await generateHash(decrypted);
            document.getElementById("output").innerText = 
                "Dekrypteret besked: " + decrypted + "\nHash af dekrypteret besked: " + hash;
            document.getElementById("message").value = "";
            alert("Tjek hash-værdien mod den originale hash for at validere beskeden!");
        } catch (error) {
            console.error("Fejl ved dekryptering:", error);
            document.getElementById("output").innerText = "Fejl ved dekryptering: " + error.message;
        }
    };

    window.switchUser = async function () {
        let selectedUser = document.getElementById("switchUser").value;
        currentUser = selectedUser;
        document.getElementById("currentUserName").innerText = selectedUser;
        updateRecipientList();
        updateMessageBox();
        document.getElementById("output").innerText = "Skiftet til " + selectedUser;
    };

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

    async function updateMessageBox() {
        let messageBox = document.getElementById("messageBox");
        messageBox.innerHTML = "";
        const messages = await fetchMessages();
        messages.forEach(msg => {
            if (msg.recipient === currentUser) {
                messageBox.innerHTML += `<p>Fra: ${msg.sender} | Krypteret: ${msg.encrypted} | Hash: ${msg.hash}</p>`;
            }
        });
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
});