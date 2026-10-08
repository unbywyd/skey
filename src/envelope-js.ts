/**
 * Шифрование удалённых запросов — одним исходником для браузера и Node.
 *
 * Страница ответа, CLI и ретранслятор должны шифровать байт в байт одинаково.
 * Две реализации разошлись бы на первой же правке, поэтому код живёт строкой:
 * страница вставляет её в <script>, CLI выполняет ту же строку (см. envelope.ts).
 * Только Web Crypto — он есть и в браузере, и в Node 18+.
 *
 * Схема:
 *   — секрет запроса (32 байта) живёт во фрагменте ссылки после `#` и на сервер
 *     не уходит; из него выводятся ключ описания запроса и токен ответа;
 *   — у автора запроса пара ключей ECDH P-256, приватный остаётся в его keychain;
 *   — ответ шифруется ключом из ECDH(разовый ключ отвечающего, ключ автора)
 *     вместе с секретом ссылки. Ссылка позволяет ответить, но не прочитать
 *     ответ; сервер без секрета ссылки не может ни прочитать, ни подделать.
 */

export const ENVELOPE_JS = String.raw`(function (crypto) {
  var subtle = crypto.subtle
  var enc = new TextEncoder(), dec = new TextDecoder()
  var CURVE = { name: 'ECDH', namedCurve: 'P-256' }

  function b64u(bytes) {
    var s = ''
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  function unb64u(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/')
    while (s.length % 4) s += '='
    var bin = atob(s), out = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  function random(n) { return crypto.getRandomValues(new Uint8Array(n)) }
  function concat(a, b) { var out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out }

  async function hkdfKey(ikm, info, salt) {
    var base = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey'])
    return subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: salt || new Uint8Array(0), info: enc.encode(info) },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  }
  async function hkdfBits(ikm, info) {
    var base = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
    return new Uint8Array(await subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(info) }, base, 256))
  }
  async function seal(key, value) {
    var iv = random(12)
    var ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(JSON.stringify(value))))
    return { iv: b64u(iv), ct: b64u(ct) }
  }
  async function open(key, box) {
    var pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64u(box.iv) }, key, unb64u(box.ct))
    return JSON.parse(dec.decode(pt))
  }
  async function answerKey(shared, secret, id) {
    return hkdfKey(concat(new Uint8Array(shared), unb64u(secret)), 'skey/answer', enc.encode(id))
  }

  return {
    b64u: b64u,
    unb64u: unb64u,
    newSecret: function () { return b64u(random(32)) },

    keypair: async function () {
      var kp = await subtle.generateKey(CURVE, true, ['deriveBits'])
      return {
        pub: b64u(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))),
        priv: b64u(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))),
      }
    },

    sha256: async function (text) {
      return b64u(new Uint8Array(await subtle.digest('SHA-256', enc.encode(text))))
    },

    /** Токен, которым отвечающий доказывает серверу, что у него есть ссылка. */
    submitToken: async function (secret) { return b64u(await hkdfBits(unb64u(secret), 'skey/submit')) },

    sealMeta: async function (secret, meta) { return seal(await hkdfKey(unb64u(secret), 'skey/meta'), meta) },
    openMeta: async function (secret, box) { return open(await hkdfKey(unb64u(secret), 'skey/meta'), box) },

    sealAnswer: async function (secret, id, pub, answer) {
      var eph = await subtle.generateKey(CURVE, true, ['deriveBits'])
      var peer = await subtle.importKey('raw', unb64u(pub), CURVE, false, [])
      var shared = await subtle.deriveBits({ name: 'ECDH', public: peer }, eph.privateKey, 256)
      var box = await seal(await answerKey(shared, secret, id), answer)
      return { v: 1, id: id, epk: b64u(new Uint8Array(await subtle.exportKey('raw', eph.publicKey))), iv: box.iv, ct: box.ct }
    },

    openAnswer: async function (secret, priv, envelope) {
      var mine = await subtle.importKey('pkcs8', unb64u(priv), CURVE, false, ['deriveBits'])
      var peer = await subtle.importKey('raw', unb64u(envelope.epk), CURVE, false, [])
      var shared = await subtle.deriveBits({ name: 'ECDH', public: peer }, mine, 256)
      return open(await answerKey(shared, secret, envelope.id), envelope)
    },

    /** Ответ одной строкой — чтобы переслать вручную, когда сервер недоступен. */
    toBlob: function (envelope) { return 'skey1.' + b64u(enc.encode(JSON.stringify(envelope))) },
    fromBlob: function (text) {
      var m = /skey1\.([A-Za-z0-9_-]+)/.exec(text)
      if (!m) throw new Error('Not a skey reply.')
      return JSON.parse(dec.decode(unb64u(m[1])))
    },
  }
})`
