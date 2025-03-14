// Funktion til at tjekke om et tal er et primtal
function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) return false;
    }
    return true;
}

// Funktion til at generere et tilfældigt primtal i et interval
function generateRandomPrime(min, max) {
    let num = Math.floor(Math.random() * (max - min + 1)) + min;
    while (!isPrime(num)) {
        num++;
        if (num > max) num = min; // Start forfra, hvis vi overskrider max
    }
    return BigInt(num);
}

// Funktion til at finde største fælles divisor (sfd)
window.gcd = function(a, b) {
    while (b !== 0n) {
        [a, b] = [b, a % b];
    }
    return a;
};

// Funktion til at finde den modulære inverse (d)
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

// Generering af unikke nøgler for en bruger
window.generateKeys = function() {
    let p = generateRandomPrime(50, 200); // Juster interval efter behov
    let q = generateRandomPrime(50, 200);
    while (p === q) {
        q = generateRandomPrime(50, 200); // Sørg for forskellige primtal
    }

    let n = p * q;
    let phi = (p - 1n) * (q - 1n);

    let e = 3n;
    while (window.gcd(e, phi) !== 1n) {
        e += 2n;
    }

    let d = window.modInverse(e, phi);

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
    return encrypted; // Returnerer array af BigInt
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
