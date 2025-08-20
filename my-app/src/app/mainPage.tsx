import Link from "next/link";

export default function Home() {
    return (
        <div className="flex flex-col md:flex-row items-center justify-center min-h-screen bg-gray-100 px-6 md:px-12 gap-y-16 md:gap-x-24">

            <div className="md:w-1/2 text-center md:text-left space-y-6">
                <h1 className="text-6xl font-bold text-blue-600">AI Maintenance as a sevice Platform</h1>
                <p className="text-gray-700 text-2xl">
                    Journey to the edge of wonder and witness the Aurora Borealis, where nature’s most dazzling light show awaits to captivate your senses and ignite your imagination
                </p>
                <p className="text-gray-500 text-lg pt-10">
                    Plans start at THB 199/Month. Learn more about our plans and pricing below
                </p>
                <Link href="/login">
                    <button className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-md shadow-md hover:bg-blue-700 transition">
                        Login
                    </button>
                </Link>
                <Link href="/authentication/login" className="bg-white text-blue-500 px-4 py-2 rounded-md hover:bg-gray-200">Login</Link>
            </div>

        </div>
    );
}
