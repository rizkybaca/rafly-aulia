module.exports = async function handler(req, res) {
    const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!REDIS_URL || !REDIS_TOKEN) {
        return res.status(500).json({ error: 'Database belum terhubung di Vercel.' });
    }

    const headers = {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
    };

    // 1. AMBIL DAFTAR UCAPAN (GET)
    if (req.method === 'GET') {
        try {
            const response = await fetch(REDIS_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify(['LRANGE', 'ucapan_tamu', '0', '99'])
            });
            const data = await response.json();
            const wishes = (data.result || []).map(item =>
                typeof item === 'string' ? JSON.parse(item) : item
            );
            return res.status(200).json({ wishes });
        } catch (err) {
            return res.status(500).json({ error: 'Gagal mengambil data ucapan.' });
        }
    }

    // 2. SIMPAN UCAPAN BARU (POST)
    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

            const clean = (str, max) => String(str || '')
                .replace(/[\x00-\x1F\x7F]/g, '')
                .replace(/<[^>]*>/g, '')
                .trim()
                .slice(0, max);

            const name = clean(body.name, 60);
            const message = clean(body.message, 350);

            if (!name || !message) {
                return res.status(400).json({ error: 'Nama dan ucapan wajib diisi.' });
            }

            const newWish = {
                name,
                message,
                createdAt: new Date().toISOString()
            };

            const saveRes = await fetch(REDIS_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify(['LPUSH', 'ucapan_tamu', JSON.stringify(newWish)])
            });

            if (!saveRes.ok) {
                throw new Error('Upstash menolak permintaan penyimpanan');
            }

            return res.status(201).json({ success: true, wish: newWish });
        } catch (err) {
            return res.status(500).json({ error: 'Gagal menyimpan ucapan.' });
        }
    }

    return res.status(405).json({ error: 'Method tidak diizinkan.' });
};