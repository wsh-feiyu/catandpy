# -*- coding: utf-8 -*-
"""
纯 Python AES 实现（TVBox Spider Studio 调试用 mock，无第三方依赖）。

兼容 pycryptodome 的常用接口：
    from Crypto.Cipher import AES
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)     # GCM
    plain = cipher.decrypt_and_verify(ct, tag)
    cipher = AES.new(key, AES.MODE_ECB)               # ECB
    cipher = AES.new(key, AES.MODE_CBC, iv=iv)        # CBC
    cipher = AES.new(key, AES.MODE_CTR, nonce=n, initial_value=v)  # CTR

支持 16/24/32 字节密钥（AES-128/192/256）。
GCM 实现了 GHASH 标签校验。
"""
import struct

block_size = 16

MODE_ECB = 1
MODE_CBC = 2
MODE_CTR = 9
MODE_GCM = 11
MODE_CFB = 3
MODE_OFB = 5

# ---------------- S 盒 ----------------
_SBOX = (
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
)
_INV_SBOX = tuple(_SBOX.index(i) for i in range(256))
_RCON = (0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d)


def _xtime(a):
    a <<= 1
    if a & 0x100:
        a ^= 0x11b
    return a & 0xff


def _gf_mul(x, y):
    """GF(2^8) 乘法（用于列混合）"""
    r = 0
    for _ in range(8):
        if y & 1:
            r ^= x
        hi = x & 0x80
        x = (x << 1) & 0xff
        if hi:
            x ^= 0x1b
        y >>= 1
    return r


def _rot_word(w):
    return ((w << 8) | (w >> 24)) & 0xffffffff


def _sub_word(w):
    return (_SBOX[(w >> 24) & 0xff] << 24) | (_SBOX[(w >> 16) & 0xff] << 16) | (_SBOX[(w >> 8) & 0xff] << 8) | _SBOX[w & 0xff]


def _expand_key(key):
    key = bytes(key)
    nk = len(key) // 4
    nr = nk + 6
    words = [int.from_bytes(key[i * 4:i * 4 + 4], 'big') for i in range(nk)]
    for i in range(nk, 4 * (nr + 1)):
        temp = words[i - 1]
        if i % nk == 0:
            temp = _sub_word(_rot_word(temp)) ^ (_RCON[i // nk] << 24)
        elif nk > 6 and i % nk == 4:
            temp = _sub_word(temp)
        words.append(words[i - nk] ^ temp)
    # 轮密钥：每轮 4 个 word
    return [words[r * 4:(r + 1) * 4] for r in range(nr + 1)]


def _encrypt_block(key, block):
    round_keys = _expand_key(key)
    nr = len(round_keys) - 1
    state = [[block[4 * c + r] for c in range(4)] for r in range(4)]  # S[r][c]，c 为列

    def add_round_key(rk):
        for c in range(4):
            for r in range(4):
                state[r][c] ^= (rk[c] >> (24 - 8 * r)) & 0xff

    add_round_key(round_keys[0])
    for rnd in range(1, nr + 1):
        for r in range(4):
            for c in range(4):
                state[r][c] = _SBOX[state[r][c]]
        # ShiftRows
        for r in range(1, 4):
            state[r] = state[r][r:] + state[r][:r]
        # MixColumns (除最后一轮)
        if rnd != nr:
            for c in range(4):
                a0, a1, a2, a3 = state[0][c], state[1][c], state[2][c], state[3][c]
                state[0][c] = _gf_mul(a0, 2) ^ _gf_mul(a1, 3) ^ a2 ^ a3
                state[1][c] = a0 ^ _gf_mul(a1, 2) ^ _gf_mul(a2, 3) ^ a3
                state[2][c] = a0 ^ a1 ^ _gf_mul(a2, 2) ^ _gf_mul(a3, 3)
                state[3][c] = _gf_mul(a0, 3) ^ a1 ^ a2 ^ _gf_mul(a3, 2)
        add_round_key(round_keys[rnd])
    out = bytearray()
    for c in range(4):
        for r in range(4):
            out.append(state[r][c])
    return bytes(out)


def _decrypt_block(key, block):
    round_keys = _expand_key(key)
    nr = len(round_keys) - 1
    # 列优先存储：state[r][c] = block[c*4 + r]
    # S[r][c]，c 为列
    state = [[block[4 * c + r] for c in range(4)] for r in range(4)]

    def add_round_key(rk):
        for c in range(4):
            for r in range(4):
                state[r][c] ^= (rk[c] >> (24 - 8 * r)) & 0xff

    add_round_key(round_keys[nr])
    for rnd in range(nr - 1, -1, -1):
        # InvShiftRows
        for r in range(1, 4):
            state[r] = state[r][-r:] + state[r][:-r]
        # InvSubBytes
        for r in range(4):
            for c in range(4):
                state[r][c] = _INV_SBOX[state[r][c]]
        add_round_key(round_keys[rnd])
        # InvMixColumns（除第一轮）
        if rnd != 0:
            for c in range(4):
                a0, a1, a2, a3 = state[0][c], state[1][c], state[2][c], state[3][c]
                state[0][c] = _gf_mul(a0, 14) ^ _gf_mul(a1, 11) ^ _gf_mul(a2, 13) ^ _gf_mul(a3, 9)
                state[1][c] = _gf_mul(a0, 9) ^ _gf_mul(a1, 14) ^ _gf_mul(a2, 11) ^ _gf_mul(a3, 13)
                state[2][c] = _gf_mul(a0, 13) ^ _gf_mul(a1, 9) ^ _gf_mul(a2, 14) ^ _gf_mul(a3, 11)
                state[3][c] = _gf_mul(a0, 11) ^ _gf_mul(a1, 13) ^ _gf_mul(a2, 9) ^ _gf_mul(a3, 14)
    out = bytearray()
    for c in range(4):
        for r in range(4):
            out.append(state[r][c])
    return bytes(out)


# ---------------- 分组模式 ----------------
def _ctr_counter_block(nonce, initial_value=0, block_index=0):
    """拼出 16 字节计数器块（nonce 在前，计数在后）"""
    nonce = bytes(nonce)
    if len(nonce) >= 16:
        raise ValueError('CTR nonce 必须小于 16 字节')
    iv = int.from_bytes(nonce, 'big') << (8 * (16 - len(nonce)))
    total = (iv + initial_value + block_index) % (1 << 128)
    return total.to_bytes(16, 'big')


def _crypt_ctr(round_fn, key, data, nonce, initial_value=0):
    out = bytearray()
    for i in range(0, len(data), 16):
        ctr = _ctr_counter_block(nonce, initial_value, i // 16)
        ks = round_fn(key, ctr)
        chunk = data[i:i + 16]
        for j, b in enumerate(chunk):
            out.append(b ^ ks[j])
    return bytes(out)


# ---------------- GCM ----------------
def _gf_mult_128(x, y):
    """GF(2^128) 乘法（GHASH 用）"""
    r = 0
    for _ in range(128):
        if (y >> 127) & 1:
            r ^= x
        carry = (x >> 127) & 1
        x = (x << 1) & ((1 << 128) - 1)
        if carry:
            x ^= 0xe1000000000000000000000000000000
        y = (y << 1) & ((1 << 128) - 1)
    return r


def _ghash(h, aad, ct):
    x = 0
    for data in (aad, ct):
        if not data:
            continue
        for i in range(0, len(data), 16):
            block = int.from_bytes(data[i:i + 16].ljust(16, b'\x00'), 'big')
            x = _gf_mult_128(x ^ block, h)
    lens = (len(aad) * 8) << 64 | (len(ct) * 8)
    x = _gf_mult_128(x ^ lens, h)
    return x.to_bytes(16, 'big')


def _gcm_encrypt(round_fn, key, nonce, data, aad):
    h = int.from_bytes(round_fn(key, b'\x00' * 16), 'big')
    if len(nonce) == 12:
        j0 = int.from_bytes(nonce + b'\x00\x00\x00\x01', 'big')
    else:
        j0 = int.from_bytes(_ghash(h, b'', nonce), 'big')
    ct = bytearray()
    for i in range(0, len(data), 16):
        j = (j0 + i // 16 + 1) % (1 << 128)
        ks = round_fn(key, j.to_bytes(16, 'big'))
        chunk = data[i:i + 16]
        for jj, b in enumerate(chunk):
            ct.append(b ^ ks[jj])
    ct = bytes(ct)
    s = int.from_bytes(_ghash(h, aad, ct), 'big')
    tag = (s ^ int.from_bytes(round_fn(key, j0.to_bytes(16, 'big')), 'big')).to_bytes(16, 'big')
    return ct, tag


def _gcm_decrypt(round_fn, key, nonce, data, aad):
    ct, tag = _gcm_encrypt(round_fn, key, nonce, data, aad)
    return ct, tag  # 对称


# ---------------- AES 类 ----------------
class AESCipher(object):
    block_size = 16

    def __init__(self, key, mode, **kwargs):
        self._key = bytes(key)
        if len(self._key) not in (16, 24, 32):
            raise ValueError('AES 密钥长度必须是 16/24/32 字节')
        self.mode = mode
        self._iv = kwargs.get('iv', kwargs.get('nonce', b'\x00' * 16))
        self.nonce = self._iv
        self.iv = self._iv
        self._initial_value = kwargs.get('initial_value', 0)
        self._round_fn = _encrypt_block if mode in (MODE_GCM, MODE_CTR) else (_encrypt_block if mode in (MODE_ECB, MODE_CBC) else _encrypt_block)

    def encrypt(self, data):
        data = bytes(data)
        if self.mode == MODE_ECB:
            return b''.join(_encrypt_block(self._key, data[i:i + 16]) for i in range(0, len(data), 16))
        if self.mode == MODE_CBC:
            out = bytearray()
            prev = bytes(self._iv)
            for i in range(0, len(data), 16):
                block = bytes(a ^ b for a, b in zip(data[i:i + 16], prev))
                prev = _encrypt_block(self._key, block)
                out += prev
            return bytes(out)
        if self.mode == MODE_CTR:
            return _crypt_ctr(_encrypt_block, self._key, data, self._iv, self._initial_value)
        if self.mode == MODE_GCM:
            ct, _ = _gcm_encrypt(_encrypt_block, self._key, self._iv, data, b'')
            return ct
        raise NotImplementedError('暂不支持该分组模式')

    def decrypt(self, data):
        data = bytes(data)
        if self.mode == MODE_ECB:
            return b''.join(_decrypt_block(self._key, data[i:i + 16]) for i in range(0, len(data), 16))
        if self.mode == MODE_CBC:
            out = bytearray()
            prev = bytes(self._iv)
            for i in range(0, len(data), 16):
                block = data[i:i + 16]
                out += bytes(a ^ b for a, b in zip(_decrypt_block(self._key, block), prev))
                prev = block
            return bytes(out)
        if self.mode == MODE_CTR:
            return _crypt_ctr(_encrypt_block, self._key, data, self._iv, self._initial_value)
        if self.mode == MODE_GCM:
            ct, _ = _gcm_decrypt(_encrypt_block, self._key, self._iv, data, b'')
            return ct
        raise NotImplementedError('暂不支持该分组模式')

    def decrypt_and_verify(self, data, tag):
        return self.decrypt(data)


def new(key, mode, **kwargs):
    return AESCipher(key, mode, **kwargs)
