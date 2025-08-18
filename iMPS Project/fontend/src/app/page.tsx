// import Image from "next/image";

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50">
      <section className="max-w-3xl mx-auto p-6">
        <h1 className="text-3xl font-bold">Hello Next.js + Tailwind 🎉</h1>
        <p className="mt-2 text-gray-600">
          หน้านี้ใช้ App Router และสไตล์ด้วยยูทิลิตี้ของ Tailwind
        </p>
        <button className="mt-6 rounded-xl px-4 py-2 bg-black text-white hover:opacity-90">
          ปุ่มตัวอย่าง
        </button>
      </section>
    </main>
  );
}

