import Link from "next/link";
export default function Page() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-2xl font-bold tracking-tight text-zinc-600">hello world</h2>
        <p className="text-zinc-600">Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore unde quis reprehenderit eius assumenda. Accusantium fuga vero consectetur nostrum. Accusantium architecto reiciendis quas facere iure ut similique quasi et ducimus?</p>
        <Link href="mainPage/about" 
              className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2 text-white shadow hover:bg-blue-700 transition">
          Go to About
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["UI เร็ว", "Respon ง่าย", "Drak mode"].map((t, i) => (
          <article key={i} className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
            <h3 className="mb-1 text-lg font-semibold text-zinc-600">{t}</h3>
            <p className="text-sm text-zinc-600">
              ใช้ คลาส utity เช่น <code>p-5</code>, <code>rounded-xl</code>, <code>shadow-sm</code>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
