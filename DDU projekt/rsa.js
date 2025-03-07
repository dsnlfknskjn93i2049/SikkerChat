// rsa.js
function generatePrime(min, max) {
    function isPrime(num) {
        if (num < 2) return false;
        for (let i = 2; i <= Math.sqrt(num); i++) {
            if (num % i === 0) return false;
        }
        return true;
    }

    let prime;
    do {
        prime = Math.floor(Math.random() * (max - min) + min);
    } while (!isPrime(prime));
    console.log("Genereret primtal:", prime); // Debug-log
    return prime;
}

function generateKeys() {
    // Generer to store primtal (p og q)
    const p = BigInt(generatePrime(100, 1000)); // Tilbage til gammelt interval
    let q;
    do {
        q = BigInt(generatePrime(100, 1000));
    } while (q === p); // Sørg for, at p og q er forskellige

    // Beregn n og phi(n)
    const n = p * q;
    const phi = (p - 1n) * (q - 1n);

    // Vælg e (offentlig eksponent), typisk 65537
    let e = 65537n;
    while (e < phi && gcd(e, phi) !== 1n) {
        e++;
    }
    if (e >= phi) {
        console.error("Kunne ikke finde en passende e-værdi inden for phi. Prøv igen.", { p, q, phi });
        return generateKeys(); // Genstart, hvis e ikke findes
    }

    // Beregn d (privat eksponent)
    let d = modInverse(e, phi);

    console.log("Genereret nøgler:", { e, n, d }); // Mere debug-log
    return {
        publicKey: { e, n },
        privateKey: { d, n }
    };
}

// Hjælpefunktioner (uændret)
function gcd(a, b) {
    a = a > 0n ? a : -a;
    b = b > 0n ? b : -b;
    while (b) {
        [a, b] = [b, a % b];
    }
    return a;
}

function modInverse(e, phi) {
    let m0 = phi, t, q;
    let x0 = 0n, x1 = 1n;
    if (phi === 1n) return 0n;
    while (e > 0n) {
        q = phi / e;
        t = phi - q * e;
        phi = e;
        e = t;
        t = x0 - q * x1;
        x0 = x1;
        x1 = t;
    }
    if (x0 < 0n) x0 += m0;
    return x0;
}

// Eksisterende krypterings- og dekrypteringsfunktioner (uændret)
function encryptMessage(message, publicKey) {
    const msgNum = BigInt(message.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
    const encrypted = modPow(msgNum, publicKey.e, publicKey.n);
    console.log("Krypteret tal:", encrypted); // Debug-log
    return [encrypted];
}

function decryptMessage(encrypted, privateKey) {
    const decryptedNum = modPow(encrypted[0], privateKey.d, privateKey.n);
    console.log("Dekrypteret tal:", decryptedNum); // Debug-log
    return String.fromCharCode(Number(decryptedNum));
}

function modPow(base, exponent, modulus) {
    let result = 1n;
    base = base % modulus;
    while (exponent > 0n) {
        if (exponent & 1n) result = (result * base) % modulus;
        base = (base * base) % modulus;
        exponent >>= 1n;
    }
    return result;
}

window.generateKeys = generateKeys;
window.encryptMessage = encryptMessage;
window.decryptMessage = decryptMessage;
