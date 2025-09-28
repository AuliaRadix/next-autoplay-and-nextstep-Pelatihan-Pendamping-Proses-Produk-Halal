# next-autoplay-and-nextstep-Pelatihan-Pendamping-Proses-Produk-Halal
Snippet JavaScript untuk situs berbasis SPA/Next.js yang mendeteksi tombol “Selanjutnya”, mengkliknya otomatis, lalu mencari iframe YouTube yang aktif, melakukan handshake (listening/onReady), dan memutar video secara aman (muted) tanpa memutus hook progres bawaan situs. Termasuk penanganan lazy-load, shadow DOM, debounce, dan retry.

Cara pakai (untuk greatedu.co.id)
Buka: https://greatedu.co.id/courses/pelatihan-pendamping-proses-produk-halal/play. 
GreatEdu
Tekan F12 → Console.
Tempel seluruh skrip → Enter.
Selesai. Saat tombol “Selanjutnya” muncul, skrip akan mengkliknya, menunggu player YouTube siap, lalu memutar video (muted).
Matikan dengan refresh halaman.
