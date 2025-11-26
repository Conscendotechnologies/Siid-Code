<div align="center">
<sub>

[English](../../README.md) • [Català](../ca/README.md) • [Deutsch](../de/README.md) • [Español](../es/README.md) • [Français](../fr/README.md) • [हिन्दी](../hi/README.md) • <b>Bahasa Indonesia</b> • [Italiano](../it/README.md) • [日本語](../ja/README.md)

</sub>
<sub>

[한국어](../ko/README.md) • [Nederlands](../nl/README.md) • [Polski](../pl/README.md) • [Português (BR)](../pt-BR/README.md) • [Русский](../ru/README.md) • [Türkçe](../tr/README.md) • [Tiếng Việt](../vi/README.md) • [简体中文](../zh-CN/README.md) • [繁體中文](../zh-TW/README.md)

</sub>
</div>
<br>
<div align="center">
  <h1>Siid Code</h1>
  <p align="center">
  <img src="https://via.placeholder.com/800x400/4A90E2/FFFFFF?text=Siid+Code+Demo" width="100%" alt="Siid Code Demo" />
  </p>
  <p>Terhubung dengan developer, berkontribusi ide, dan tetap terdepan dengan tools coding bertenaga AI terbaru.</p>
  
  </div>
<br>
<br>

<div align="center">

<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code" target="_blank"><img src="https://img.shields.io/badge/Download%20on%20VS%20Marketplace-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Download on VS Marketplace"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/Rate%20%26%20Review-green?style=for-the-badge" alt="Rate & Review"></a>
</div>

**Siid Code** adalah **agen coding otonom** bertenaga AI yang hidup di editor kamu. Ia dapat:

- Berkomunikasi dalam bahasa alami
- Membaca dan menulis file langsung di workspace kamu
- Menjalankan perintah terminal
- Mengotomatisasi aksi browser
- Terintegrasi dengan API/model yang kompatibel dengan OpenAI atau custom
- Menyesuaikan "kepribadian" dan kemampuannya melalui **Mode Kustom**

Baik kamu mencari partner coding yang fleksibel, arsitek sistem, atau peran khusus seperti QA engineer atau product manager, Siid Code dapat membantu kamu membangun software dengan lebih efisien.

Lihat [CHANGELOG](../../CHANGELOG.md) untuk update dan perbaikan detail.

---

## 🎉 Rilis Terbaru

Siid Code 3.25 menghadirkan fitur-fitur baru yang powerful dan peningkatan signifikan untuk meningkatkan workflow development kamu!

- **Antrian pesan** - Antrikan beberapa pesan saat Siid Code bekerja, memungkinkan kamu terus merencanakan alur kerja tanpa gangguan.
- **Perintah slash kustom** - Buat perintah slash yang dipersonalisasi untuk akses cepat ke prompt dan alur kerja yang sering digunakan dengan manajemen UI lengkap.
- **Alat Gemini lanjutan** - Fitur konteks URL dan dasar pencarian Google baru memberikan model Gemini informasi web real-time dan kemampuan penelitian lanjutan.

---

## Apa yang Bisa Dilakukan Siid Code?

- 🚀 **Generate Code** dari deskripsi bahasa alami
- 🔧 **Refactor & Debug** kode yang ada
- 📝 **Tulis & Update** dokumentasi
- 🤔 **Jawab Pertanyaan** tentang codebase kamu
- 🔄 **Otomatisasi** tugas berulang
- 🏗️ **Buat** file dan proyek baru

## Mulai Cepat

1. Install Siid Code
2. Hubungkan AI Provider Kamu
3. Coba Tugas Pertama Kamu

## Fitur Utama

### Multiple Mode

Siid Code beradaptasi dengan kebutuhan kamu dengan mode khusus:

- **Code Mode:** Untuk tugas coding umum
- **Architect Mode:** Untuk perencanaan dan kepemimpinan teknis
- **Ask Mode:** Untuk menjawab pertanyaan dan memberikan informasi
- **Debug Mode:** Untuk diagnosis masalah sistematis
- **Mode Kustom:** Buat persona khusus tak terbatas untuk audit keamanan, optimasi performa, dokumentasi, atau tugas lainnya

### Tools Pintar

Siid Code dilengkapi dengan tools powerful yang dapat:

- Membaca dan menulis file di proyek kamu
- Menjalankan perintah di terminal VS Code kamu
- Mengontrol web browser
- Menggunakan tools eksternal via MCP (Model Context Protocol)

MCP memperluas kemampuan Siid Code dengan memungkinkan kamu menambahkan tools kustom tak terbatas. Integrasikan dengan API eksternal, hubungkan ke database, atau buat tools development khusus - MCP menyediakan framework untuk memperluas fungsionalitas Siid Code sesuai kebutuhan spesifik kamu.

### Kustomisasi

Buat Siid Code bekerja sesuai cara kamu dengan:

- Custom Instructions untuk perilaku yang dipersonalisasi
- Mode Kustom untuk tugas khusus
- Model Lokal untuk penggunaan offline
- Auto-Approval Settings untuk workflow yang lebih cepat

## Sumber Daya

### Dokumentasi

- Panduan Penggunaan Dasar
- Fitur Lanjutan
- Frequently Asked Questions

### Support

- **GitHub Issues:** Laporkan [issues](https://github.com/Conscendotechnologies/Siid-Code/issues) atau request [fitur](https://github.com/Conscendotechnologies/Siid-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## Setup Lokal & Development

1. **Clone** repo:

```sh
git clone https://github.com/Conscendotechnologies/Siid-Code.git
```

2. **Install dependencies**:

```sh
pnpm install
```

3. **Jalankan extension**:

Tekan `F5` (atau **Run** → **Start Debugging**) di VSCode untuk membuka window baru dengan Siid Code berjalan.

Perubahan pada webview akan muncul langsung. Perubahan pada core extension akan memerlukan restart extension host.

Alternatifnya kamu bisa build .vsix dan install langsung di VSCode:

```sh
pnpm vsix
```

File `.vsix` akan muncul di direktori `bin/` yang bisa diinstall dengan:

```sh
code --install-extension bin/siid-code-<version>.vsix
```

Kami menggunakan [changesets](https://github.com/changesets/changesets) untuk versioning dan publishing. Cek `CHANGELOG.md` kami untuk release notes.

---

## Disclaimer

**Harap dicatat** bahwa Conscendo Technologies **tidak** membuat representasi atau jaminan apapun mengenai kode, model, atau tools lain yang disediakan atau tersedia dalam hubungannya dengan Siid Code, tools pihak ketiga terkait, atau output yang dihasilkan. Kamu menanggung **semua risiko** yang terkait dengan penggunaan tools atau output tersebut; tools tersebut disediakan atas dasar **"SEBAGAIMANA ADANYA"** dan **"SEBAGAIMANA TERSEDIA"**. Risiko tersebut dapat mencakup, tanpa terbatas pada, pelanggaran kekayaan intelektual, kerentanan atau serangan siber, bias, ketidakakuratan, kesalahan, cacat, virus, downtime, kehilangan properti atau kerusakan, dan/atau cedera pribadi. Kamu bertanggung jawab penuh atas penggunaan tools atau output tersebut (termasuk, tanpa terbatas pada, legalitas, kesesuaian, dan hasilnya).

---

## Berkontribusi

Kami menyukai kontribusi komunitas! Mulai dengan membaca [CONTRIBUTING.md](CONTRIBUTING.md) kami.

---

## License

[Apache 2.0 © 2025 Conscendo Technologies](./LICENSE)

---

**Nikmati Siid Code!** Baik kamu menggunakannya dengan ketat atau membiarkannya berjalan otonom, kami tidak sabar melihat apa yang kamu bangun. Jika kamu memiliki pertanyaan atau ide fitur, kunjungi [komunitas Reddit](https://github.com/Conscendotechnologies/Siid-Code) atau GitHub kami. Selamat coding!
