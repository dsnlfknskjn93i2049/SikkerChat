// Funktion til at finde den største fælles divisor (sfd)
window.gcd = function(a, b) {
    while (b !== 0n) {
        [a, b] = [b, a % b];
    }
    return a;
};

// Funktion til at finde den modulære inverse (d)
window.modInverse = function(e, phi) {
    let m0 = phi, t, q;
    let x0 = 0, x1 = 1;
    if (phi === 1) return 0;

    while (e > 1) {
        q = Math.floor(e / phi);
        t = phi;
        phi = e % phi, e = t;
        t = x0;
        x0 = x1 - q * x0;
        x1 = t;
    }

    return x1 < 0 ? x1 + m0 : x1;
};

// Generering af nøgler for en bruger
window.generateKeys = function() {
    let p = 97n, q = 113n; // Disse kunne randomiseres senere for mere sikkerhed
    let n = p * q;
    let phi = (p - 1n) * (q - 1n);

    let e = 3n;
    while (window.gcd(e, phi) !== 1n) {
        e += 2n;
    }

    let d = BigInt(window.modInverse(Number(e), Number(phi)));

    return { publicKey: { e, n }, privateKey: { d, n } };
};

// RSA Kryptering med modtagerens offentlige nøgle
window.encryptMessage = function(message, publicKey) {
    let encrypted = [];
    for (let char of message) {
        let ascii = BigInt(char.charCodeAt(0));
        let encryptedChar = (ascii ** publicKey.e) % publicKey.n;
        encrypted.push(encryptedChar);
    }
    return encrypted;
};

// RSA Dekryptering med brugerens private nøgle
window.decryptMessage = function(encrypted, privateKey) {
    let decrypted = "";
    for (let num of encrypted) {
        let decryptedChar = (num ** privateKey.d) % privateKey.n;
        decrypted += String.fromCharCode(Number(decryptedChar));
    }
    return decrypted;
};
