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
      <div className="w-full max-w-sm mx-auto p-6 bg-white rounded-lg shadow">
        <h1 className="text-xl font-semibold mb-4">Login</h1>

        <form className="space-y-4">
          <div>
            <label htmlFor="username" className="block mb-1 text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-1 text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
            />
          </div>

          {/* <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Sign In
          </button> */}
          <div className="">
            <Link href="mainPage/about"
              className="w-full mt-4 text-center inline-block rounded-lg bg-blue-600 px-5 py-2 text-white shadow hover:bg-blue-700 transition">
              Login
            </Link>
          </div>
        </form>
      </div>

    </section>
  );
}
