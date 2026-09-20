#!/usr/bin/env bash
# One-off seed for a demo LMS board ("KLC"). Run against local wrangler dev only.
set -euo pipefail

BASE="http://localhost:8787"
ADMIN=$(grep ADMIN_API_KEY .dev.vars | cut -d= -f2)
H="Authorization: Bearer $ADMIN"
J="Content-Type: application/json"

jf() { node -pe "JSON.parse(require('fs').readFileSync(0))$1"; }

echo "== managers =="
M1=$(curl -s -X POST "$BASE/api/admin/managers" -H "$H" -H "$J" -d '{"name":"Dewi Anggraeni"}')
M1_ID=$(echo "$M1" | jf .manager.id); M1_KEY=$(echo "$M1" | jf .access_key)
M2=$(curl -s -X POST "$BASE/api/admin/managers" -H "$H" -H "$J" -d '{"name":"Rian Saputra"}')
M2_ID=$(echo "$M2" | jf .manager.id); M2_KEY=$(echo "$M2" | jf .access_key)
echo "  Dewi Anggraeni (manager utama) key: $M1_KEY"
echo "  Rian Saputra   (co-manager)    key: $M2_KEY"

echo "== board =="
B=$(curl -s -X POST "$BASE/api/admin/boards" -H "$H" -H "$J" -d "{\"team_name\":\"KLC\",\"manager_ids\":[\"$M1_ID\",\"$M2_ID\"]}")
BID=$(echo "$B" | jf .board.id); SLUG=$(echo "$B" | jf .board.public_slug)
curl -s -X PATCH "$BASE/api/admin/boards/$BID" -H "$H" -H "$J" -d '{"is_public":true}' >/dev/null
MH="Authorization: Bearer $M1_KEY"

echo "== settings: assignees + ticket allow-list =="
curl -s -X PATCH "$BASE/api/manager/boards/$BID" -H "$MH" -H "$J" -d '{
  "assignees": ["Dewi Anggraeni", "Rian Saputra", "Putri Wulandari", "Agus Prasetyo", "Nadia Kusuma", "Fajar Nugroho"],
  "allowed_emails": ["*@klc.ac.id", "instruktur.tamu@gmail.com"]
}' >/dev/null

echo "== buckets =="
mk_bucket() { curl -s -X POST "$BASE/api/manager/boards/$BID/buckets" -H "$MH" -H "$J" -d "{\"name\":\"$1\"}" | jf .bucket.id; }
BACKLOG=$(mk_bucket "Backlog")
PROGRESS=$(mk_bucket "Dikerjakan")
REVIEW=$(mk_bucket "Review")
DONE=$(mk_bucket "Selesai")

echo "== tasks =="
mk_task() {
  local bucket=$1 title=$2 desc=$3 module=$4 target=$5 assignee=$6 priority=$7 blocked=$8 start=$9 end=${10}
  curl -s -X POST "$BASE/api/manager/boards/$BID/tasks" -H "$MH" -H "$J" -d "$(node -e '
    const [bucket_id, title, description, mod, target, assignee, priority, blocked_reason, timeline_start, timeline_end] = process.argv.slice(1);
    const body = { bucket_id, title, priority };
    if (description) body.description = description;
    if (mod) body.module = mod;
    if (target) body.target = target;
    if (assignee) body.assignee = assignee;
    if (blocked_reason) body.blocked_reason = blocked_reason;
    if (timeline_start) body.timeline_start = timeline_start;
    if (timeline_end) body.timeline_end = timeline_end;
    process.stdout.write(JSON.stringify(body));
  ' "$bucket" "$title" "$desc" "$module" "$target" "$assignee" "$priority" "$blocked" "$start" "$end")" >/dev/null
}

# Backlog
mk_task "$BACKLOG" "Integrasi Single Sign-On (SSO) kampus" "Login mahasiswa pakai akun SSO institusi, bukan akun lokal." "Autentikasi" "v2.4" "" "normal" "" "" ""
mk_task "$BACKLOG" "Ekspor nilai ke SIAKAD" "Sinkronisasi nilai akhir kelas ke sistem akademik pusat." "Nilai & Rapor" "v2.4" "" "normal" "" "" ""
mk_task "$BACKLOG" "Mode offline untuk video materi" "Cache video di device peserta untuk daerah sinyal lemah." "Pemutar Video" "v3.0" "" "low" "" "" ""

# Dikerjakan
mk_task "$PROGRESS" "Bank soal & random shuffling kuis" "Soal diacak per peserta, ambil dari bank soal per topik." "Ujian & Kuis" "v2.3" "Putri Wulandari" "high" "" "2026-09-01" "2026-09-20"
mk_task "$PROGRESS" "Anti-cheat: deteksi tab keluar saat ujian" "Log setiap kali peserta pindah tab/aplikasi selama ujian berlangsung." "Ujian & Kuis" "v2.3" "Agus Prasetyo" "high" "Menunggu kepastian kebijakan privasi dari legal" "2026-09-05" "2026-09-18"
mk_task "$PROGRESS" "Progress bar penyelesaian kursus" "Persentase modul yang sudah diselesaikan per peserta." "Manajemen Kursus" "v2.3" "Nadia Kusuma" "normal" "" "2026-09-08" "2026-09-22"
mk_task "$PROGRESS" "Transcoding otomatis upload video" "Convert upload dosen ke beberapa resolusi (360p/720p/1080p)." "Pemutar Video" "v2.3" "Fajar Nugroho" "normal" "" "2026-08-20" "2026-09-10"

# Review
mk_task "$REVIEW" "Sertifikat kelulusan otomatis (PDF)" "Generate sertifikat begitu peserta lulus semua modul + nilai minimum." "Sertifikasi" "v2.2" "Rian Saputra" "normal" "" "2026-08-15" "2026-09-05"
mk_task "$REVIEW" "Notifikasi tenggat tugas via email" "Reminder H-3 dan H-1 sebelum deadline pengumpulan tugas." "Notifikasi" "v2.2" "Dewi Anggraeni" "normal" "" "2026-08-20" "2026-09-08"

# Selesai
mk_task "$DONE" "Diskusi forum per modul" "Thread diskusi terpisah untuk tiap modul kursus." "Forum Diskusi" "v2.1" "Putri Wulandari" "normal" "" "2026-07-01" "2026-07-25"
mk_task "$DONE" "Upload tugas multi-file" "Peserta bisa unggah lebih dari satu file per pengumpulan tugas." "Tugas" "v2.1" "Agus Prasetyo" "low" "" "2026-07-05" "2026-07-20"
mk_task "$DONE" "Dashboard progres instruktur" "Ringkasan progres seluruh peserta per kelas untuk dosen." "Analitik" "v2.1" "Nadia Kusuma" "normal" "" "2026-06-15" "2026-07-10"

echo "== tickets (masuk dari peserta/instruktur) =="
mk_ticket() {
  curl -s -X POST "$BASE/api/public/tickets/$SLUG" -H "$J" -d "$1" >/dev/null
}
mk_ticket '{"email":"budi.mahasiswa@klc.ac.id","title":"Video materi Modul 5 tidak bisa diputar","description":"Muncul error buffering terus di Chrome dan Firefox, sudah coba refresh berkali-kali.","module":"Pemutar Video","priority":"high"}'
mk_ticket '{"email":"instruktur.tamu@gmail.com","title":"Minta akses upload materi tambahan","description":"Saya instruktur tamu untuk kelas Statistika, butuh akses upload slide dan video.","module":"Manajemen Kursus","priority":"normal"}'
mk_ticket '{"email":"siti.dosen@klc.ac.id","title":"Fitur ekspor nilai ke Excel","description":"Butuh tombol ekspor rekap nilai kelas ke file Excel, bukan cuma PDF.","module":"Nilai & Rapor","priority":"normal"}'
mk_ticket '{"email":"andi.peserta@klc.ac.id","title":"Sertifikat salah nama","description":"Nama di sertifikat kelulusan tertukar dengan peserta lain, mohon dikoreksi.","module":"Sertifikasi","priority":"high"}'
mk_ticket '{"email":"tidak.terdaftar@luar.com","title":"Ini akan ditolak server (403)","description":"Email di luar allow-list, untuk demo penolakan otomatis."}' 2>/dev/null || true

# Terima satu tiket ke Backlog, tolak satu, sisanya biarkan open untuk demo
TICKETS=$(curl -s "$BASE/api/manager/boards/$BID/tickets" -H "$MH")
T_VIDEO=$(echo "$TICKETS" | jf '.tickets.find(t=>t.title.includes("Video materi Modul 5")).id')
T_GUEST=$(echo "$TICKETS" | jf '.tickets.find(t=>t.title.includes("materi tambahan")).id')
curl -s -X POST "$BASE/api/manager/boards/$BID/tickets/$T_VIDEO/accept" -H "$MH" >/dev/null
curl -s -X POST "$BASE/api/manager/boards/$BID/tickets/$T_GUEST/reject" -H "$MH" >/dev/null

echo
echo "=== Selesai ==="
echo "Board: KLC   id=$BID   slug=$SLUG"
echo "Link publik : http://localhost:5173/p/$SLUG  (atau /api/public/boards/$SLUG)"
echo "Link tiket  : http://localhost:5173/t/$SLUG"
echo "Manager key (Dewi, utama): $M1_KEY"
echo "Manager key (Rian, co)  : $M2_KEY"
